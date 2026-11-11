import { Router } from 'express';
import { requireActor } from '../auth.js';
import { config, wirexCorporate } from '../config.js';
import {
  WirexError,
  corpGet,
  corpPost,
  corpPut,
  fetchCorporateConfig,
  fetchPartnerToken,
  getPartnerToken,
  loginCorporation,
  registerCorporation,
} from '../clients/corporateClient.js';
import { patchCorp, publicCorp, readCorp } from '../corpStore.js';
import {
  createCorporationOnChain,
  generateOwnerWallet,
  importOwnerWallet,
  onchainOverview,
  readCorporationOnChain,
} from '../onchain/corporateOnchain.js';

const router = Router();

function canManage(actor: { role: string; orgId: string }) {
  return actor.role === 'hq' || actor.role === 'org';
}

function fail(res: { status: (n: number) => { json: (b: unknown) => void } }, e: unknown) {
  if (e instanceof WirexError) {
    // KYB 전 카드 capability 거절은 예상 동작이라 상단 '최근 오류'에 고정하지 않는다.
    const sticky = !/Capability is not active/i.test(e.message);
    if (sticky) patchCorp({ lastError: e.message });
    return res.status(e.status >= 400 && e.status < 600 ? e.status : 502).json({
      error: 'wirex_error',
      message: e.message,
      detail: e.body,
    });
  }
  const message = e instanceof Error ? e.message : 'corporate_failed';
  patchCorp({ lastError: message });
  return res.status(400).json({ error: message, message });
}

router.get('/workspace', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });

  const profile = publicCorp();
  const out: Record<string, unknown> = {
    profile,
    apiBase: wirexCorporate.apiBase,
    chainId: wirexCorporate.chainId,
    partnerIdSet: Boolean(wirexCorporate.partnerId),
    credentialsSet: Boolean(wirexCorporate.clientId && wirexCorporate.clientSecret),
    mock: config.useMockWirex,
    steps: {
      partner: false,
      onChain: profile.onChainDone && Boolean(profile.corporationAddress && profile.ownerWallet),
      register: Boolean(profile.registeredAt),
      login: Boolean(profile.corporationTokenReady),
      kyb: profile.verificationStatus === 'Approved',
    },
  };

  try {
    const summary = await fetchCorporateConfig();
    out.configReachable = true;
    out.chainName = summary.chainName;
  } catch (e) {
    out.configReachable = false;
    out.configError = (e as Error).message;
  }

  if (wirexCorporate.clientId && wirexCorporate.clientSecret && !config.useMockWirex) {
    const token = await fetchPartnerToken();
    out.tokenOk = token.ok;
    out.steps = { ...(out.steps as object), partner: token.ok };
    if (!token.ok) out.tokenError = token.error;
  } else if (config.useMockWirex) {
    out.tokenOk = true;
    out.steps = { ...(out.steps as object), partner: true };
    out.note = 'USE_MOCK_WIREX=true';
  } else {
    out.tokenOk = false;
    out.tokenError = 'WIREX_CLIENT_ID / WIREX_CLIENT_SECRET 가 없습니다.';
  }

  if (profile.corporationTokenReady) {
    try {
      const corp = await corpGet('/api/v1/corporations');
      out.corporation = corp;
      const status = (corp as { verification_status?: string }).verification_status;
      const levels = (corp as { verification_levels?: Array<{ level?: string; status?: string }> }).verification_levels || [];
      const sddApproved = levels.some((row) => row.level === 'SDD' && row.status === 'Approved');
      const kybDone = status === 'Approved' || sddApproved;
      if (status) patchCorp({ verificationStatus: status });
      out.profile = publicCorp();
      out.steps = {
        ...(out.steps as object),
        login: true,
        kyb: kybDone,
      };
    } catch (e) {
      out.corporationError = e instanceof Error ? e.message : 'corporation_read_failed';
    }
  }

  res.json(out);
});

router.put('/profile', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  const body = req.body as Partial<{
    ownerWallet: string;
    ownerEmail: string;
    corporationAddress: string;
    corporationName: string;
    registrationNumber: string;
    registrationCountry: string;
    chainId: number;
    onChainDone: boolean;
  }>;
  const next = patchCorp({
    ownerWallet: String(body.ownerWallet || '').trim(),
    ownerEmail: String(body.ownerEmail || '').trim().toLowerCase(),
    corporationAddress: String(body.corporationAddress || '').trim(),
    corporationName: String(body.corporationName || '').trim(),
    registrationNumber: String(body.registrationNumber || '').trim().toUpperCase(),
    registrationCountry: String(body.registrationCountry || '').trim().toUpperCase(),
    chainId: Number(body.chainId || wirexCorporate.chainId),
    onChainDone: Boolean(body.onChainDone),
    lastError: '',
  });
  res.json({ profile: publicCorp(next) });
});

router.post('/partner-token', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const token = await getPartnerToken(true);
    res.json({ ok: true, preview: `${token.slice(0, 12)}…`, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/register', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const saved = readCorp();
    const body = req.body as Partial<typeof saved>;
    const input = {
      corporationAddress: String(body.corporationAddress || saved.corporationAddress).trim(),
      corporationName: String(body.corporationName || saved.corporationName).trim(),
      registrationNumber: String(body.registrationNumber || saved.registrationNumber).trim().toUpperCase(),
      registrationCountry: String(body.registrationCountry || saved.registrationCountry).trim().toUpperCase(),
      ownerWallet: String(body.ownerWallet || saved.ownerWallet).trim(),
      ownerEmail: String(body.ownerEmail || saved.ownerEmail).trim().toLowerCase(),
      chainId: Number(body.chainId || saved.chainId || wirexCorporate.chainId),
    };
    if (!input.corporationAddress || !input.ownerWallet || !input.ownerEmail) {
      return res.status(400).json({ error: 'corporation_profile_incomplete' });
    }
    if (!input.corporationName || !input.registrationNumber || !input.registrationCountry) {
      return res.status(400).json({ error: 'corporation_legal_required' });
    }
    patchCorp({ ...input, onChainDone: true });
    await registerCorporation(input);
    patchCorp({ registeredAt: new Date().toISOString(), lastError: '' });
    res.json({ ok: true, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/login', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const saved = readCorp();
    const body = req.body as Partial<typeof saved>;
    const input = {
      corporationAddress: String(body.corporationAddress || saved.corporationAddress).trim(),
      ownerWallet: String(body.ownerWallet || saved.ownerWallet).trim(),
      ownerEmail: String(body.ownerEmail || saved.ownerEmail).trim().toLowerCase(),
      chainId: Number(body.chainId || saved.chainId || wirexCorporate.chainId),
    };
    if (!input.corporationAddress || !input.ownerWallet || !input.ownerEmail) {
      return res.status(400).json({ error: 'corporation_profile_incomplete' });
    }
    await loginCorporation(input);
    res.json({ ok: true, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/corporation', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const data = await corpGet('/api/v1/corporations');
    const status = (data as { verification_status?: string }).verification_status;
    if (status) patchCorp({ verificationStatus: status });
    res.json({ corporation: data, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/kyb/level-token', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const level = String((req.body as { verification_level?: string }).verification_level || 'SDD');
    const data = await corpPost('/api/v1/corporations/level-token', { verification_level: level });
    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

router.get('/roles', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const data = await corpGet('/api/v1/roles');
    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

router.get('/employees', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const q = new URLSearchParams();
    if (req.query.page_number) q.set('page_number', String(req.query.page_number));
    if (req.query.page_size) q.set('page_size', String(req.query.page_size));
    const suffix = q.toString() ? `?${q}` : '';
    const data = await corpGet(`/api/v1/employees${suffix}`);
    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

router.post('/employees/invite', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const body = req.body as Record<string, unknown>;
    const data = await corpPost('/api/v1/employees/invite', {
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      role_id: body.role_id,
      phone: body.phone,
      department: body.department || undefined,
      job_title: body.job_title || undefined,
    });
    res.json({ ok: true, ...((data && typeof data === 'object') ? data : {}) });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/employees/search', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const term = String(req.query.term || '').trim();
    if (term.length < 2) return res.status(400).json({ error: 'search_term_short' });
    const q = new URLSearchParams({ term });
    if (req.query.page_number) q.set('page_number', String(req.query.page_number));
    if (req.query.page_size) q.set('page_size', String(req.query.page_size));
    const data = await corpGet(`/api/v1/employees/search?${q.toString()}`);
    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

router.get('/cards', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const data = await corpGet('/api/v1/cards');
    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

router.get('/cards/fees/:type/:country', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const type = String(req.params.type || 'virtual').toLowerCase();
    const country = String(req.params.country || readCorp().registrationCountry || 'KR').toUpperCase();
    const data = await corpGet(`/api/v1/cards/${type}/fees/${country}`);
    res.json({ feesRequired: true, country, type, ...(data as object) });
  } catch (e) {
    if (e instanceof WirexError && e.status === 400) {
      return res.json({ feesRequired: false, country: String(req.params.country || '').toUpperCase(), type: req.params.type });
    }
    fail(res, e);
  }
});

async function resolveCardDeliveryId(options: {
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
  type FeeQuote = {
    estimated_payment_amounts?: Array<{ token_address?: string; token_symbol?: string }>;
  };
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
      amounts.find((row: { token_symbol?: string }) => prefer.includes(String(row.token_symbol || ''))) || amounts[0];
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

router.post('/cards/virtual', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const body = req.body as Record<string, unknown>;
    const saved = readCorp();
    const country = String(body.country || saved.registrationCountry || 'KR').toUpperCase();
    const payload: Record<string, unknown> = {
      card_name: body.card_name,
      name_on_card: body.name_on_card,
    };
    if (body.employee_id) payload.employee_id = body.employee_id;
    const resolved = await resolveCardDeliveryId({
      type: 'virtual',
      country,
      tokenAddress: body.token_address ? String(body.token_address) : undefined,
      deliveryId: body.delivery_id ? Number(body.delivery_id) : undefined,
    });
    if (resolved.deliveryId != null && resolved.deliveryId > 0) payload.delivery_id = resolved.deliveryId;
    const data = await corpPost('/api/v2/cards/virtual', payload);
    patchCorp({ lastError: '' });
    res.json({
      ...(data as object),
      delivery_id: resolved.deliveryId ?? null,
      country,
      token_address: resolved.feeToken,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/cards/plastic', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const body = req.body as Record<string, unknown> & {
      delivery_address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
    };
    const saved = readCorp();
    const address = body.delivery_address || {};
    const country = String(address.country || body.country || saved.registrationCountry || 'KR').toUpperCase();
    if (!address.line1 || !address.city || !address.postal_code || !country) {
      return res.status(400).json({ error: 'plastic_delivery_address_required' });
    }
    const deliveryProvider = String(body.delivery_provider || 'DHL');
    const payload: Record<string, unknown> = {
      card_name: body.card_name,
      name_on_card: body.name_on_card,
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
    if (body.employee_id) payload.employee_id = body.employee_id;
    const resolved = await resolveCardDeliveryId({
      type: 'plastic',
      country,
      tokenAddress: body.token_address ? String(body.token_address) : undefined,
      deliveryId: body.delivery_id ? Number(body.delivery_id) : undefined,
      deliveryProvider,
    });
    if (resolved.deliveryId != null && resolved.deliveryId > 0) payload.delivery_id = resolved.deliveryId;
    const data = await corpPost('/api/v2/cards/plastic', payload);
    patchCorp({ lastError: '' });
    res.json({
      ...(data as object),
      delivery_id: resolved.deliveryId ?? null,
      country,
      token_address: resolved.feeToken,
    });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/cards/:id/limit', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const body = req.body as {
      daily_limit?: number;
      monthly_limit?: number;
      transaction_limit?: number;
      lifetime_remaining?: number;
    };
    // Wirex lifetime 은 API로 설정 불가(-1 고정). 남은 평생 한도가 있으면 daily_limit 상한으로 반영.
    let daily = body.daily_limit ?? -1;
    if (typeof body.lifetime_remaining === 'number' && body.lifetime_remaining >= 0) {
      if (daily < 0 || daily > body.lifetime_remaining) daily = body.lifetime_remaining;
    }
    await corpPut(`/api/v1/cards/${req.params.id}/limit`, {
      daily_limit: daily,
      monthly_limit: body.monthly_limit ?? -1,
      transaction_limit: body.transaction_limit ?? -1,
    });
    res.json({ ok: true, daily_limit: daily });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/cards/:id/block', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    await corpPut(`/api/v1/cards/${req.params.id}/block`);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/cards/:id/unblock', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    await corpPut(`/api/v1/cards/${req.params.id}/unblock`);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/cards/:id/close', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    await corpPut(`/api/v1/cards/${req.params.id}/close`);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/activities', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const q = new URLSearchParams();
    q.set('page_number', String(req.query.page_number || '0'));
    q.set('page_size', String(req.query.page_size || '50'));
    if (req.query.subject) q.set('subject', String(req.query.subject));
    const data = await corpGet(`/api/v1/activity/feed?${q.toString()}`);
    const list = Array.isArray((data as { data?: unknown[] }).data)
      ? (data as { data: unknown[] }).data
      : Array.isArray(data)
        ? data
        : [];
    res.json({ ...(typeof data === 'object' && data ? data : {}), activities: list });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/wallets', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const data = await corpGet('/api/v1/wallets');
    res.json(data);
  } catch (e) {
    fail(res, e);
  }
});

router.get('/onchain', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const overview = await onchainOverview();
    res.json({ ...overview, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/onchain/owner/generate', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const row = generateOwnerWallet();
    res.json({
      address: row.address,
      privateKeyOnce: row.privateKeyOnce,
      warning: 'privateKeyOnce 는 이번 응답에만 보입니다. 안전한 곳에 보관하세요.',
      profile: publicCorp(),
    });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/onchain/owner/import', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const key = String((req.body as { privateKey?: string }).privateKey || '');
    if (!key) return res.status(400).json({ error: 'private_key_required' });
    const row = importOwnerWallet(key);
    res.json({ address: row.address, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/onchain/corporation/:address', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const row = await readCorporationOnChain(req.params.address);
    if (row.exists) {
      patchCorp({
        corporationAddress: row.corporationAddress,
        ownerWallet: row.creator,
        onChainDone: true,
      });
    }
    res.json({ corporation: row, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/onchain/create', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const saved = readCorp();
    const address = String((req.body as { corporationAddress?: string }).corporationAddress || saved.corporationAddress || '');
    if (!address) return res.status(400).json({ error: 'corporation_address_required' });
    patchCorp({ corporationAddress: address });
    const row = await createCorporationOnChain(address);
    res.json({ ...row, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/onchain/deploy', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const { deployAndRegisterCorporationWallet } = await import('../onchain/deployCorporationWallet.js');
    const body = req.body as { ownerPrivateKey?: string; ownerEmail?: string };
    const saved = readCorp();
    const email = String(body.ownerEmail || saved.ownerEmail || actor.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'owner_email_required' });
    const deployed = await deployAndRegisterCorporationWallet({
      ownerPrivateKey: body.ownerPrivateKey as `0x${string}` | undefined,
      ownerEmail: email,
    });
    patchCorp({
      ownerEmail: email,
      corporationAddress: deployed.corporationAddress,
      ownerWallet: deployed.ownerAddress,
      onChainDone: Boolean(deployed.corporation?.exists),
    });
    res.json({ ok: true, ...deployed, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/onboard/full', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const { deployAndRegisterCorporationWallet } = await import('../onchain/deployCorporationWallet.js');
    const saved = readCorp();
    const body = req.body as Partial<typeof saved> & { ownerPrivateKey?: string };
    const legal = {
      corporationName: String(body.corporationName || saved.corporationName || '').trim(),
      registrationNumber: String(body.registrationNumber || saved.registrationNumber || '').trim().toUpperCase(),
      registrationCountry: String(body.registrationCountry || saved.registrationCountry || '').trim().toUpperCase(),
      ownerEmail: String(body.ownerEmail || saved.ownerEmail || actor.email || '').trim().toLowerCase(),
    };
    if (!legal.corporationName || !legal.registrationNumber || !legal.registrationCountry) {
      return res.status(400).json({ error: 'corporation_legal_required' });
    }
    if (!legal.ownerEmail) return res.status(400).json({ error: 'owner_email_required' });

    patchCorp({
      corporationName: legal.corporationName,
      registrationNumber: legal.registrationNumber,
      registrationCountry: legal.registrationCountry,
      ownerEmail: legal.ownerEmail,
    });

    let corporationAddress = String(body.corporationAddress || saved.corporationAddress || '').trim();
    let ownerWallet = String(body.ownerWallet || saved.ownerWallet || '').trim();
    let deployed: Awaited<ReturnType<typeof deployAndRegisterCorporationWallet>> | null = null;

    let onchain = corporationAddress ? await readCorporationOnChain(corporationAddress).catch(() => null) : null;
    if (!onchain?.exists) {
      deployed = await deployAndRegisterCorporationWallet({
        ownerPrivateKey: body.ownerPrivateKey as `0x${string}` | undefined,
        ownerEmail: legal.ownerEmail,
      });
      corporationAddress = deployed.corporationAddress;
      ownerWallet = deployed.ownerAddress;
      onchain = deployed.corporation;
    }

    if (!onchain?.exists) {
      return res.status(400).json({
        error: 'onchain_corporation_missing',
        message: '온체인 법인 생성이 완료되지 않았습니다.',
        deployed,
        corporation: onchain,
      });
    }

    const input = {
      corporationAddress,
      corporationName: legal.corporationName,
      registrationNumber: legal.registrationNumber,
      registrationCountry: legal.registrationCountry,
      ownerWallet: onchain.creator || ownerWallet,
      ownerEmail: legal.ownerEmail,
      chainId: Number(body.chainId || saved.chainId || wirexCorporate.chainId),
    };
    patchCorp({ ...input, onChainDone: true });
    await registerCorporation(input);
    patchCorp({ registeredAt: new Date().toISOString() });
    await loginCorporation({
      corporationAddress: input.corporationAddress,
      ownerWallet: input.ownerWallet,
      ownerEmail: input.ownerEmail,
      chainId: input.chainId,
    });
    let corporation = null;
    try {
      corporation = await corpGet('/api/v1/corporations');
    } catch {
      corporation = null;
    }
    res.json({
      ok: true,
      deployed,
      onchain,
      corporation,
      profile: publicCorp(),
    });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/onboard/api', async (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || !canManage(actor)) return res.status(403).json({ error: 'staff_forbidden' });
  try {
    const saved = readCorp();
    const body = req.body as Partial<typeof saved>;
    const input = {
      corporationAddress: String(body.corporationAddress || saved.corporationAddress).trim(),
      corporationName: String(body.corporationName || saved.corporationName).trim(),
      registrationNumber: String(body.registrationNumber || saved.registrationNumber).trim().toUpperCase(),
      registrationCountry: String(body.registrationCountry || saved.registrationCountry).trim().toUpperCase(),
      ownerWallet: String(body.ownerWallet || saved.ownerWallet).trim(),
      ownerEmail: String(body.ownerEmail || saved.ownerEmail).trim().toLowerCase(),
      chainId: Number(body.chainId || saved.chainId || wirexCorporate.chainId),
    };
    if (!input.corporationAddress || !input.ownerWallet || !input.ownerEmail) {
      return res.status(400).json({ error: 'corporation_profile_incomplete' });
    }
    if (!input.corporationName || !input.registrationNumber || !input.registrationCountry) {
      return res.status(400).json({ error: 'corporation_legal_required' });
    }
    const onchain = await readCorporationOnChain(input.corporationAddress);
    if (!onchain.exists) {
      return res.status(400).json({
        error: 'onchain_corporation_missing',
        message: '온체인에 법인이 없습니다. createCorporationForCorporateWallet 이후 다시 시도하세요.',
        corporation: onchain,
      });
    }
    patchCorp({ ...input, onChainDone: true, ownerWallet: onchain.creator || input.ownerWallet });
    await registerCorporation({ ...input, ownerWallet: onchain.creator || input.ownerWallet });
    patchCorp({ registeredAt: new Date().toISOString() });
    await loginCorporation({
      corporationAddress: input.corporationAddress,
      ownerWallet: onchain.creator || input.ownerWallet,
      ownerEmail: input.ownerEmail,
      chainId: input.chainId,
    });
    let corporation = null;
    try {
      corporation = await corpGet('/api/v1/corporations');
    } catch {
      corporation = null;
    }
    res.json({ ok: true, onchain, corporation, profile: publicCorp() });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
