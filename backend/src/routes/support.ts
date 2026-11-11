import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config, wirexCorporate } from '../config.js';
import { fetchCorporateConfig, fetchPartnerToken } from '../clients/corporateClient.js';
import { publicCorp } from '../corpStore.js';
import {
  ESCALATION_CHECKLIST,
  SUPPORT_CAPABILITIES,
  VERIFICATION_TEMPLATES,
} from '../supportCatalog.js';
import { readDb, type Role } from '../orgStore.js';

const router = Router();

type Actor = { sub: string; role: Role; orgId: string; email: string; purpose?: string };

function actorOf(req: { header: (name: string) => string | undefined }): Actor | null {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret) as Actor;
  } catch {
    return null;
  }
}

function requireActor(req: Parameters<typeof actorOf>[0], res: { status: (code: number) => { json: (body: unknown) => void } }) {
  const actor = actorOf(req);
  if (!actor || (actor.purpose && actor.purpose !== 'session')) {
    res.status(401).json({ error: 'login_required' });
    return null;
  }
  if (actor.role === 'user') {
    res.status(403).json({ error: 'staff_forbidden' });
    return null;
  }
  return actor;
}

router.get('/capabilities', (req, res) => {
  if (!requireActor(req, res)) return;
  res.json({
    source: 'Wirex Partner Support Portal Guide 2026',
    product: 'card-business',
    note: 'Support Portal(User ID)과 Corporate API(법인)는 다릅니다. 아래 status가 우리 쪽에서 할 수 있는 범위입니다.',
    capabilities: SUPPORT_CAPABILITIES,
    templates: VERIFICATION_TEMPLATES,
    escalation: ESCALATION_CHECKLIST,
  });
});

router.get('/wirex-status', async (req, res) => {
  if (!requireActor(req, res)) return;
  const out: Record<string, unknown> = {
    apiBase: wirexCorporate.apiBase,
    chainId: wirexCorporate.chainId,
    credentialsSet: Boolean(wirexCorporate.clientId && wirexCorporate.clientSecret),
    partnerIdSet: Boolean(wirexCorporate.partnerId),
    mock: config.useMockWirex,
    corporationTokenReady: publicCorp().corporationTokenReady,
    corporationTokenHint: publicCorp().corporationTokenReady
      ? '법인 토큰이 있습니다. 카드·직원 API를 법인관리에서 호출할 수 있습니다.'
      : '법인 토큰(corporations/login)이 있어야 카드·명세서를 실호출합니다. 법인관리에서 온보딩을 진행하세요.',
  };
  try {
    const summary = await fetchCorporateConfig();
    out.configReachable = true;
    if (summary.chainName) out.chainName = summary.chainName;
    if (summary.chainId) out.reportedChainId = summary.chainId;
  } catch (e) {
    out.configReachable = false;
    out.configError = (e as Error).message;
  }
  if (!wirexCorporate.clientId || !wirexCorporate.clientSecret) {
    out.tokenOk = false;
    out.tokenError = 'WIREX_CLIENT_ID / WIREX_CLIENT_SECRET 가 없습니다.';
    return res.json(out);
  }
  if (config.useMockWirex) {
    out.tokenOk = false;
    out.note = 'USE_MOCK_WIREX=true. 키를 넣은 뒤 false 로 바꾸세요.';
    return res.json(out);
  }
  const token = await fetchPartnerToken();
  out.tokenOk = token.ok;
  if (!token.ok) out.tokenError = token.error;
  else out.tokenPreview = token.preview;
  res.json(out);
});

router.get('/lookup', (req, res) => {
  if (!requireActor(req, res)) return;
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: 'query_required' });

  const db = readDb();
  const accounts = db.accounts.filter((account) => {
    const hay = `${account.id} ${account.email} ${account.name}`.toLowerCase();
    return hay.includes(q);
  });
  const cards = db.cards.filter((card) => {
    const user = db.accounts.find((account) => account.id === card.userId);
    const hay = `${card.id} ${card.name} ${card.userId} ${user?.email || ''} ${user?.name || ''}`.toLowerCase();
    return hay.includes(q);
  });

  res.json({
    query: q,
    mode: 'local_org_store',
    hint: 'Support Portal의 User ID 검색과 다릅니다. Corporate 실연동 전에는 로컬 조직·카드 사용자만 찾습니다.',
    users: accounts.map((account) => {
      const org = db.orgs.find((row) => row.id === account.orgId);
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        orgId: account.orgId,
        orgName: org?.name || '',
        status: account.role === 'user' ? 'ACTIVE' : account.role.toUpperCase(),
      };
    }),
    cards: cards.map((card) => {
      const user = db.accounts.find((account) => account.id === card.userId);
      const org = db.orgs.find((row) => row.id === card.orgId);
      return {
        id: card.id,
        name: card.name,
        format: card.format,
        status: card.status,
        cardLimit: card.cardLimit ?? null,
        userId: card.userId,
        userName: user?.name || '',
        userEmail: user?.email || '',
        orgName: org?.name || '',
        createdAt: card.createdAt,
      };
    }),
  });
});

router.post('/statements/preview', (req, res) => {
  if (!requireActor(req, res)) return;
  const start = Number(req.body?.start);
  const end = Number(req.body?.end);
  const chainId = Number(req.body?.chainId || wirexCorporate.chainId);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
    return res.status(400).json({ error: 'invalid_range' });
  }
  if (start >= end) return res.status(400).json({ error: 'invalid_range' });
  const sixMonths = 180 * 24 * 60 * 60;
  if (end - start > sixMonths) return res.status(400).json({ error: 'range_exceeds_6_months' });

  res.json({
    ok: false,
    ready: false,
    endpoint: 'POST /api/v1/activity/statement/full',
    request: { start, end, chainId },
    reason: 'corporation_token_required',
    message: '법인 토큰이 준비되면 이 요청을 Wirex로 전달합니다. 지금은 기간·체인 검증만 통과했습니다.',
  });
});

export default router;
