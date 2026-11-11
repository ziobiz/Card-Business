/**
 * 1번 모델: Wirex 법인 1개 + 내부 조직(orgId) 매핑.
 * Wirex에는 파트너/부서가 전달되지 않고, 우리 DB에만 소속을 남긴다.
 */
import { Router } from 'express';
import { requireActor } from '../auth.js';
import {
  WirexError,
  corpGet,
  corpPost,
  corpPut,
} from '../clients/corporateClient.js';
import { patchCorp, readCorp } from '../corpStore.js';
import {
  descendantIds,
  hashPassword,
  money,
  orgStats,
  readDb,
  reserveFits,
  writeDb,
  type BizCard,
  type CardPurpose,
  type SpendMode,
} from '../orgStore.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function canStaff(actor: { role: string }) {
  return actor.role === 'hq' || actor.role === 'org';
}

function canManageOrg(actor: { role: string; orgId: string }, orgId: string) {
  if (actor.role === 'hq') return true;
  return descendantIds(readDb(), actor.orgId).has(orgId);
}

function fail(res: { status: (n: number) => { json: (b: unknown) => void } }, e: unknown) {
  if (e instanceof WirexError) {
    const sticky = !/Capability is not active/i.test(e.message);
    if (sticky) patchCorp({ lastError: e.message });
    return res.status(e.status >= 400 && e.status < 600 ? e.status : 502).json({
      error: 'wirex_error',
      message: e.message,
      detail: e.body,
    });
  }
  const message = e instanceof Error ? e.message : 'biz_failed';
  return res.status(400).json({ error: message, message });
}

function wirexIdOf(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const row = data as Record<string, unknown>;
  return String(row.id || row.card_id || (row.card as { id?: string } | undefined)?.id || '');
}

async function resolveDeliveryId(options: {
  type: 'virtual' | 'plastic';
  country: string;
  tokenAddress?: string;
  deliveryId?: number;
  deliveryProvider?: string;
}) {
  let deliveryId = options.deliveryId;
  let feeToken: string | null = options.tokenAddress || null;
  if (deliveryId && !Number.isNaN(deliveryId) && deliveryId > 0) {
    return { deliveryId, feeToken };
  }
  type FeeQuote = { estimated_payment_amounts?: Array<{ token_address?: string; token_symbol?: string }> };
  let fees: FeeQuote | null = null;
  try {
    fees = (await corpGet(`/api/v1/cards/${options.type}/fees/${options.country}`)) as FeeQuote;
  } catch (feeErr) {
    if (!(feeErr instanceof WirexError && feeErr.status === 400)) throw feeErr;
  }
  if (!fees) return { deliveryId: undefined as number | undefined, feeToken };
  if (!feeToken) {
    const amounts = fees.estimated_payment_amounts || [];
    const prefer = ['USDC', 'WUSD', 'USDT', 'CUSD'];
    const picked =
      amounts.find((row) => prefer.includes(String(row.token_symbol || ''))) || amounts[0];
    feeToken = picked?.token_address ? String(picked.token_address) : null;
  }
  if (!feeToken) throw new Error('card_fee_token_missing');
  const paymentBody: Record<string, unknown> = { token_address: feeToken };
  if (options.type === 'plastic') paymentBody.delivery_provider = options.deliveryProvider || 'DHL';
  const paid = (await corpPost(`/api/v2/cards/${options.type}/fees/${options.country}/payment`, paymentBody)) as {
    delivery_id?: number | string;
  };
  if (paid?.delivery_id == null) throw new Error('card_delivery_id_missing');
  return { deliveryId: Number(paid.delivery_id), feeToken };
}

function mapWirexStatus(raw: string | undefined): BizCard['status'] {
  const s = String(raw || '').toLowerCase();
  if (s === 'blocked') return 'blocked';
  if (s === 'closed') return 'closed';
  if (s === 'requested') return 'requested';
  if (s === 'notactivated' || s === 'not_activated') return 'not_activated';
  return 'active';
}

function enrichCard(db: ReturnType<typeof readDb>, card: BizCard) {
  const org = db.orgs.find((o) => o.id === card.orgId);
  const user = card.userId ? db.accounts.find((a) => a.id === card.userId) : undefined;
  return {
    ...card,
    orgName: org?.name || '',
    orgLevel: org?.level || '',
    orgCode: card.orgCode || org?.id || '',
    userName: user ? (user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email) : '',
    userEmail: user?.email || '',
  };
}

/** 회원(개인기명 대상) 목록 */
router.get('/members', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const db = readDb();
  const scope = descendantIds(db, actor.orgId);
  const orgId = String(req.query.orgId || '');
  let users = db.accounts.filter((a) => a.role === 'user' && scope.has(a.orgId));
  if (orgId) users = users.filter((a) => a.orgId === orgId);
  res.json({
    members: users.map((a) => {
      const org = db.orgs.find((o) => o.id === a.orgId);
      return {
        id: a.id,
        orgId: a.orgId,
        orgName: org?.name || '',
        orgCode: org?.id || '',
        name: a.name,
        firstName: a.firstName || '',
        lastName: a.lastName || '',
        email: a.email,
        phone: a.phone || '',
        wirexEmployeeId: a.wirexEmployeeId || '',
        spendMode: a.spendMode || 'shared',
      };
    }),
    orgs: db.orgs.filter((o) => scope.has(o.id)).map((o) => ({ id: o.id, name: o.name, level: o.level, parentId: o.parentId })),
  });
});

/** 회원 등록 (우리 DB). Wirex employee는 카드 발급 시 생성·연결 */
router.post('/members', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const orgId = String(req.body?.orgId || '');
  const firstName = String(req.body?.firstName || req.body?.first_name || '').trim();
  const lastName = String(req.body?.lastName || req.body?.last_name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim();
  const password = String(req.body?.password || '');
  if (!orgId) return res.status(400).json({ error: 'org_required' });
  if (!firstName || !lastName) return res.status(400).json({ error: 'name_required' });
  if (!emailPattern.test(email)) return res.status(400).json({ error: 'email_invalid' });
  if (!phone) return res.status(400).json({ error: 'phone_required' });
  const db = readDb();
  const org = db.orgs.find((o) => o.id === orgId);
  if (!org || !canManageOrg(actor, org.id)) return res.status(403).json({ error: 'account_forbidden' });
  if (org.level === 'hq') return res.status(400).json({ error: 'user_level' });
  if (db.accounts.some((a) => a.email === email)) return res.status(400).json({ error: 'email_exists' });
  const spendMode: SpendMode = req.body?.spendMode === 'prefunded' ? 'prefunded' : 'shared';
  const name = `${firstName} ${lastName}`.trim();
  const row = {
    id: crypto.randomUUID(),
    role: 'user' as const,
    orgId,
    name,
    email,
    passwordHash: hashPassword(password.length >= 8 ? password : `Tmp${crypto.randomUUID().slice(0, 8)}!`),
    firstName,
    lastName,
    phone,
    spendMode,
  };
  db.accounts.push(row);
  writeDb(db);
  res.status(201).json({
    ok: true,
    member: {
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      firstName,
      lastName,
      email,
      phone,
      spendMode,
    },
  });
});

/** 발급 내역 (내부 장부) */
router.get('/issued-cards', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const db = readDb();
  const scope = descendantIds(db, actor.orgId);
  const orgId = String(req.query.orgId || '');
  let cards = db.cards.filter((c) => scope.has(c.orgId));
  if (orgId) cards = cards.filter((c) => c.orgId === orgId);
  cards = [...cards].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({
    cards: cards.map((c) => enrichCard(db, c)),
    orgs: db.orgs.filter((o) => scope.has(o.id)).map((o) => ({ id: o.id, name: o.name, level: o.level, parentId: o.parentId })),
  });
});

/** 사용 내역 (내부 spends, org 필터) */
router.get('/spend-history', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const db = readDb();
  const scope = descendantIds(db, actor.orgId);
  const orgId = String(req.query.orgId || '');
  let spends = db.spends.filter((s) => scope.has(s.orgId));
  if (orgId) spends = spends.filter((s) => s.orgId === orgId);
  spends = [...spends].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({
    spends: spends.map((s) => {
      const org = db.orgs.find((o) => o.id === s.orgId);
      const card = db.cards.find((c) => c.id === s.cardId);
      return {
        ...s,
        orgName: org?.name || '',
        orgCode: org?.id || '',
        cardName: card?.name || '',
        wirexCardId: card?.wirexCardId || '',
      };
    }),
    orgs: db.orgs.filter((o) => scope.has(o.id)).map((o) => ({ id: o.id, name: o.name, level: o.level })),
  });
});

async function ensureWirexEmployee(member: {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  wirexEmployeeId?: string;
  name: string;
}): Promise<string> {
  if (member.wirexEmployeeId) return member.wirexEmployeeId;
  const roles = (await corpGet('/api/v1/roles')) as { roles?: Array<{ id: string }> };
  const roleId = roles.roles?.[0]?.id;
  if (!roleId) throw new Error('wirex_role_missing');
  const first = member.firstName || member.name.split(/\s+/)[0] || 'User';
  const last = member.lastName || member.name.split(/\s+/).slice(1).join(' ') || 'Card';
  const phone = member.phone || '+820000000000';
  await corpPost('/api/v1/employees/invite', {
    first_name: first,
    last_name: last,
    email: member.email,
    phone,
    role_id: roleId,
  });
  const listed = (await corpGet('/api/v1/employees')) as { employees?: Array<{ id: string; email?: string }> };
  const found = (listed.employees || []).find((e) => e.email?.toLowerCase() === member.email.toLowerCase());
  if (!found?.id) throw new Error('employee_create_lookup_failed');
  const db = readDb();
  const row = db.accounts.find((a) => a.id === member.id);
  if (row) {
    row.wirexEmployeeId = found.id;
    writeDb(db);
  }
  return found.id;
}

router.post('/issued-cards/virtual', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const body = req.body as Record<string, unknown>;
    const orgId = String(body.orgId || '');
    const purpose: CardPurpose = body.purpose === 'personal' ? 'personal' : 'company';
    const cardName = String(body.card_name || body.name || '').trim();
    if (!orgId) return res.status(400).json({ error: 'org_required' });
    if (!cardName) return res.status(400).json({ error: 'card_name' });
    const db = readDb();
    const org = db.orgs.find((o) => o.id === orgId);
    if (!org || !canManageOrg(actor, org.id)) return res.status(403).json({ error: 'org_forbidden' });
    if (orgStats(db, org).remainingCards < 1) return res.status(400).json({ error: 'cards_empty' });

    let userId = '';
    let wirexEmployeeId: string | undefined;
    let nameOnCard = String(body.name_on_card || '').trim();
    if (purpose === 'personal') {
      userId = String(body.userId || '');
      const member = db.accounts.find((a) => a.id === userId && a.role === 'user' && a.orgId === orgId);
      if (!member) return res.status(400).json({ error: 'user_required' });
      wirexEmployeeId = await ensureWirexEmployee(member);
      nameOnCard = '';
    } else if (!nameOnCard) {
      return res.status(400).json({ error: 'name_on_card_required' });
    }

    const spendMode: SpendMode = body.spendMode === 'prefunded' ? 'prefunded' : 'shared';
    const cardLimit = Number(body.cardLimit ?? 100);
    const reserveError = reserveFits(db, org, spendMode, cardLimit);
    if (reserveError) return res.status(400).json({ error: reserveError });

    const saved = readCorp();
    const country = String(body.country || saved.registrationCountry || 'KR').toUpperCase();
    const payload: Record<string, unknown> = { card_name: cardName };
    if (purpose === 'company') payload.name_on_card = nameOnCard;
    if (wirexEmployeeId) payload.employee_id = wirexEmployeeId;
    const resolved = await resolveDeliveryId({
      type: 'virtual',
      country,
      tokenAddress: body.token_address ? String(body.token_address) : undefined,
      deliveryId: body.delivery_id ? Number(body.delivery_id) : undefined,
    });
    if (resolved.deliveryId != null && resolved.deliveryId > 0) payload.delivery_id = resolved.deliveryId;
    const data = await corpPost('/api/v2/cards/virtual', payload);
    const wirexCardId = wirexIdOf(data) || crypto.randomUUID();
    patchCorp({ lastError: '' });

    const card: BizCard = {
      id: crypto.randomUUID(),
      orgId: org.id,
      userId,
      name: cardName,
      format: 'virtual',
      status: 'active',
      spendMode,
      cardLimit: money(cardLimit),
      createdAt: new Date().toISOString(),
      wirexCardId,
      purpose,
      wirexEmployeeId,
      nameOnCard: purpose === 'company' ? nameOnCard : undefined,
      orgCode: org.id,
    };
    db.cards.push(card);
    writeDb(db);
    res.status(201).json({ ok: true, card: enrichCard(readDb(), card), wirex: data });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/issued-cards/plastic', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const body = req.body as Record<string, unknown> & {
      delivery_address?: Record<string, string>;
    };
    const orgId = String(body.orgId || '');
    const purpose: CardPurpose = body.purpose === 'personal' ? 'personal' : 'company';
    const cardName = String(body.card_name || body.name || '').trim();
    if (!orgId) return res.status(400).json({ error: 'org_required' });
    if (!cardName) return res.status(400).json({ error: 'card_name' });
    const address = body.delivery_address || {};
    const db = readDb();
    const org = db.orgs.find((o) => o.id === orgId);
    if (!org || !canManageOrg(actor, org.id)) return res.status(403).json({ error: 'org_forbidden' });
    if (orgStats(db, org).remainingCards < 1) return res.status(400).json({ error: 'cards_empty' });

    let userId = '';
    let wirexEmployeeId: string | undefined;
    let nameOnCard = String(body.name_on_card || '').trim();
    if (purpose === 'personal') {
      userId = String(body.userId || '');
      const member = db.accounts.find((a) => a.id === userId && a.role === 'user' && a.orgId === orgId);
      if (!member) return res.status(400).json({ error: 'user_required' });
      wirexEmployeeId = await ensureWirexEmployee(member);
      nameOnCard = '';
    } else if (!nameOnCard) {
      return res.status(400).json({ error: 'name_on_card_required' });
    }

    const spendMode: SpendMode = body.spendMode === 'prefunded' ? 'prefunded' : 'shared';
    const cardLimit = Number(body.cardLimit ?? 100);
    const reserveError = reserveFits(db, org, spendMode, cardLimit);
    if (reserveError) return res.status(400).json({ error: reserveError });

    const saved = readCorp();
    const country = String(address.country || body.country || saved.registrationCountry || 'KR').toUpperCase();
    if (!address.line1 || !address.city || !address.postal_code || !country) {
      return res.status(400).json({ error: 'plastic_delivery_address_required' });
    }
    const deliveryProvider = String(body.delivery_provider || 'DHL');
    const payload: Record<string, unknown> = {
      card_name: cardName,
      delivery_provider: deliveryProvider,
      delivery_address: {
        line1: String(address.line1 || ''),
        line2: String(address.line2 || ''),
        city: String(address.city || ''),
        state: String(address.state || ''),
        postal_code: String(address.postal_code || ''),
        country,
      },
    };
    if (purpose === 'company') payload.name_on_card = nameOnCard;
    if (wirexEmployeeId) payload.employee_id = wirexEmployeeId;
    const resolved = await resolveDeliveryId({
      type: 'plastic',
      country,
      tokenAddress: body.token_address ? String(body.token_address) : undefined,
      deliveryId: body.delivery_id ? Number(body.delivery_id) : undefined,
      deliveryProvider,
    });
    if (resolved.deliveryId != null && resolved.deliveryId > 0) payload.delivery_id = resolved.deliveryId;
    const data = await corpPost('/api/v2/cards/plastic', payload);
    const wirexCardId = wirexIdOf(data) || crypto.randomUUID();
    patchCorp({ lastError: '' });

    const card: BizCard = {
      id: crypto.randomUUID(),
      orgId: org.id,
      userId,
      name: cardName,
      format: 'plastic',
      status: 'not_activated',
      spendMode,
      cardLimit: money(cardLimit),
      createdAt: new Date().toISOString(),
      wirexCardId,
      purpose,
      wirexEmployeeId,
      nameOnCard: purpose === 'company' ? nameOnCard : undefined,
      orgCode: org.id,
    };
    db.cards.push(card);
    writeDb(db);
    res.status(201).json({ ok: true, card: enrichCard(readDb(), card), wirex: data });
  } catch (e) {
    fail(res, e);
  }
});

function findManagedCard(actor: { orgId: string; role: string }, localId: string) {
  const db = readDb();
  const card = db.cards.find((c) => c.id === localId);
  if (!card || !canManageOrg(actor, card.orgId)) return null;
  return { db, card };
}

router.put('/issued-cards/:id/limit', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const found = findManagedCard(actor, req.params.id);
  if (!found) return res.status(404).json({ error: 'card_missing' });
  try {
    const body = req.body as { daily_limit?: number; monthly_limit?: number; transaction_limit?: number };
    const daily = body.daily_limit ?? -1;
    const monthly = body.monthly_limit ?? -1;
    const perTx = body.transaction_limit ?? -1;
    if (found.card.wirexCardId) {
      await corpPut(`/api/v1/cards/${found.card.wirexCardId}/limit`, {
        daily_limit: daily,
        monthly_limit: monthly,
        transaction_limit: perTx,
      });
    }
    found.card.dailyLimit = daily;
    found.card.monthlyLimit = monthly;
    found.card.transactionLimit = perTx;
    writeDb(found.db);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/issued-cards/:id/block', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const found = findManagedCard(actor, req.params.id);
  if (!found) return res.status(404).json({ error: 'card_missing' });
  try {
    if (found.card.wirexCardId) await corpPut(`/api/v1/cards/${found.card.wirexCardId}/block`);
    found.card.status = 'blocked';
    writeDb(found.db);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/issued-cards/:id/unblock', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const found = findManagedCard(actor, req.params.id);
  if (!found) return res.status(404).json({ error: 'card_missing' });
  try {
    if (found.card.wirexCardId) await corpPut(`/api/v1/cards/${found.card.wirexCardId}/unblock`);
    found.card.status = 'active';
    writeDb(found.db);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/issued-cards/:id/close', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canStaff(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const found = findManagedCard(actor, req.params.id);
  if (!found) return res.status(404).json({ error: 'card_missing' });
  try {
    if (found.card.wirexCardId) await corpPut(`/api/v1/cards/${found.card.wirexCardId}/close`);
    found.card.status = 'closed';
    writeDb(found.db);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
