import { Router } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { config, wirexCorporate } from '../config.js';
import { brandDir, brandKinds, removeBrandFile, saveBrandImage, type BrandKind } from '../brandFiles.js';
import { generateOtpSecret, otpAuthUrl, verifyTotp } from '../lib/totp.js';
import {
  chargeFits,
  checkPassword,
  chainOf,
  childrenOf,
  descendantIds,
  feeLines,
  fundedFloor,
  fundingFits,
  hashPassword,
  issuedCount,
  money,
  monthKey,
  orgStats,
  rateNum,
  readDb,
  reserveFits,
  roleMenus,
  splitFees,
  usedAmount,
  writeDb,
  MENU_IDS,
  type BizCard,
  type BrandMode,
  type FundingMode,
  type Org,
  type OrgLevel,
  type Rate,
  type OrgProfile,
  type Role,
  type SpendMode,
  type StaffRole,
} from '../orgStore.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const nextLevel: Partial<Record<OrgLevel, OrgLevel>> = { hq: 'large', large: 'middle', middle: 'small' };
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Actor = { sub: string; role: Role; orgId: string; email: string; purpose?: string };

const loginFails = new Map<string, { n: number; until: number }>();

function clientIp(req: { header: (name: string) => string | undefined; socket: { remoteAddress?: string } }) {
  const fwd = req.header('x-forwarded-for') || '';
  const raw = (fwd.split(',')[0] || req.socket.remoteAddress || '').trim();
  return raw.replace(/^::ffff:/, '') || '0.0.0.0';
}

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

function sign(account: { id: string; role: Role; orgId: string; email: string }, purpose = 'session', expiresIn: jwt.SignOptions['expiresIn'] = '12h') {
  const actor: Actor = { sub: account.id, role: account.role, orgId: account.orgId, email: account.email, purpose };
  return jwt.sign(actor, config.jwtSecret, { expiresIn });
}

function requireActor(req: Parameters<typeof actorOf>[0], res: { status: (code: number) => { json: (body: unknown) => void } }) {
  const actor = actorOf(req);
  if (!actor || (actor.purpose && actor.purpose !== 'session')) {
    res.status(401).json({ error: 'login_required' });
    return null;
  }
  return actor;
}

function canManage(actor: Actor, orgId: string) {
  if (actor.role === 'user') return false;
  if (actor.role === 'hq') return true;
  return descendantIds(readDb(), actor.orgId).has(orgId);
}

function publicAccount(account: { id: string; role: Role; orgId: string; name: string; email: string; otpSecret?: string; staffRole?: StaffRole; primary?: boolean; spendMode?: SpendMode }) {
  return {
    id: account.id,
    role: account.role,
    orgId: account.orgId,
    name: account.name,
    email: account.email,
    otpEnabled: Boolean(account.otpSecret),
    staffRole: account.role === 'org' ? account.staffRole || 'admin' : account.staffRole,
    primary: Boolean(account.primary),
    spendMode: account.spendMode === 'prefunded' ? 'prefunded' : 'shared',
  };
}

function staffRank(actor: Actor): StaffRole | 'hq' {
  if (actor.role === 'hq') return 'hq';
  const account = readDb().accounts.find((item) => item.id === actor.sub);
  return account?.staffRole || 'admin';
}

function allowStaff(actor: Actor, roles: Array<StaffRole | 'hq'>) {
  return roles.includes(staffRank(actor));
}

function readFunding(body: unknown): { mode: FundingMode; prefundedBudget: number; error?: undefined } | { error: string; mode?: undefined; prefundedBudget?: undefined } {
  const src = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const raw = src.fundingMode;
  const mode: FundingMode = raw === 'prefunded' || raw === 'split' || raw === 'shared' ? raw : 'shared';
  const prefundedBudget = src.prefundedBudget == null || src.prefundedBudget === '' ? 0 : Number(src.prefundedBudget);
  if (!Number.isFinite(prefundedBudget) || prefundedBudget < 0) return { error: 'prefunded_min' };
  if (mode === 'split' && prefundedBudget <= 0) return { error: 'prefunded_min' };
  return { mode, prefundedBudget: money(prefundedBudget) };
}

const imageKeys = ['logoUrl', 'loginLogoUrl', 'loginBackgroundUrl', 'faviconUrl'] as const;
const textKeys = ['brandName', 'siteName', 'footerText', 'slug', 'customDomain', 'accentColor'] as const;

function imageOk(url: string) {
  if (!url) return true;
  if (url.startsWith('/api/brand-files/') || (url.startsWith('/') && !url.startsWith('//'))) return true;
  return /^https?:\/\//.test(url);
}

function readBrand(db: ReturnType<typeof readDb>, selfId: string, value: unknown): { fields: Partial<Org>; error?: undefined } | { error: string; fields?: undefined } {
  const src = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const fields: Partial<Org> = {};
  if ('brandMode' in src) fields.brandMode = src.brandMode === 'custom' ? 'custom' : 'follow';
  if ('brandName' in src) fields.brandName = String(src.brandName ?? '').trim().slice(0, 80);
  if ('siteName' in src) fields.siteName = String(src.siteName ?? '').trim().slice(0, 100);
  if ('footerText' in src) fields.footerText = String(src.footerText ?? '').trim().slice(0, 300);
  if ('accentColor' in src) {
    const accentColor = String(src.accentColor ?? '').trim();
    if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor)) return { error: 'accent_invalid' };
    fields.accentColor = accentColor;
  }
  for (const key of imageKeys) {
    if (!(key in src)) continue;
    const url = String(src[key] ?? '').trim().slice(0, 300);
    if (!imageOk(url)) return { error: 'logo_invalid' };
    fields[key] = url;
  }
  if ('slug' in src) {
    const slug = String(src.slug ?? '').trim().toLowerCase();
    if (slug && !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) return { error: 'slug_invalid' };
    if (slug && db.orgs.some((org) => org.id !== selfId && (org.slug || '').toLowerCase() === slug)) return { error: 'slug_exists' };
    fields.slug = slug;
  }
  if ('customDomain' in src) {
    const customDomain = String(src.customDomain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    if (customDomain && (customDomain.length > 253 || !/^[a-z0-9.-]+$/.test(customDomain))) return { error: 'domain_invalid' };
    if (customDomain && db.orgs.some((org) => org.id !== selfId && (org.customDomain || '').toLowerCase() === customDomain)) return { error: 'domain_exists' };
    fields.customDomain = customDomain;
  }
  return { fields };
}

function applyBrand(org: Org, fields: Partial<Org>) {
  if (org.level === 'hq') fields.brandMode = 'custom';
  for (const key of imageKeys) {
    const next = fields[key];
    const previous = String(org[key] || '');
    if (next !== undefined && next !== previous) removeBrandFile(org.id, previous);
  }
  const keys = ['brandMode', ...textKeys, ...imageKeys] as const;
  for (const key of keys) {
    if (fields[key] !== undefined) org[key] = fields[key] as never;
  }
}

function readProfile(value: unknown): OrgProfile {
  const src = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = (key: string, max = 160) => String(src[key] ?? '').trim().slice(0, max);
  const use = text('useYn', 1);
  return {
    bizNo: text('bizNo', 40),
    bizType: text('bizType'),
    industry: text('industry'),
    ceoName: text('ceoName'),
    mobile: text('mobile', 40),
    phone: text('phone', 40),
    fax: text('fax', 40),
    email: text('email', 120),
    zip: text('zip', 20),
    address: text('address', 200),
    addressDetail: text('addressDetail', 200),
    salesInfo: text('salesInfo', 40),
    useYn: use === 'N' || use === 'S' ? use : 'Y',
    homepage: text('homepage', 200),
    product: text('product'),
    settleName: text('settleName'),
    settlePhone: text('settlePhone', 40),
    wallet: text('wallet', 200),
    network: text('network', 40),
  };
}

function brandModeOf(org: Org): BrandMode {
  if (org.level === 'hq') return 'custom';
  return org.brandMode === 'custom' ? 'custom' : 'follow';
}

function brandSource(db: ReturnType<typeof readDb>, org: Org) {
  const seen = new Set<string>();
  let current: Org | undefined = org;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (brandModeOf(current) === 'custom') return current;
    current = current.parentId ? db.orgs.find((item) => item.id === current?.parentId) : undefined;
  }
  return org;
}

function shownBrand(db: ReturnType<typeof readDb>, org: Org) {
  const source = brandSource(db, org);
  const chain = chainOf(db, source.id);
  const pick = (read: (node: Org) => string | undefined) => {
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const value = (read(chain[index]) || '').trim();
      if (value) return value;
    }
    return '';
  };
  const brandName = pick((node) => node.brandName) || source.name || 'ICOCARD';
  const logoUrl = pick((node) => node.logoUrl);
  const loginLogoUrl = pick((node) => node.loginLogoUrl) || logoUrl;
  return {
    brandMode: brandModeOf(org),
    brandName,
    logoUrl,
    loginLogoUrl,
    loginBackgroundUrl: pick((node) => node.loginBackgroundUrl),
    faviconUrl: pick((node) => node.faviconUrl),
    siteName: pick((node) => node.siteName) || brandName,
    footerText: pick((node) => node.footerText),
    accentColor: pick((node) => node.accentColor),
  };
}

function storedBrand(org: Org) {
  return {
    brandMode: brandModeOf(org),
    brandName: org.brandName || '',
    logoUrl: org.logoUrl || '',
    loginLogoUrl: org.loginLogoUrl || '',
    loginBackgroundUrl: org.loginBackgroundUrl || '',
    faviconUrl: org.faviconUrl || '',
    siteName: org.siteName || '',
    footerText: org.footerText || '',
    slug: org.slug || '',
    customDomain: org.customDomain || '',
    accentColor: org.accentColor || '',
  };
}

function sessionBody(account: { id: string; role: Role; orgId: string; name: string; email: string; otpSecret?: string; spendMode?: SpendMode; staffRole?: StaffRole }, org?: Org) {
  const db = readDb();
  const brand = org ? shownBrand(db, org) : { brandMode: 'custom' as const, brandName: 'ICOCARD', logoUrl: '', loginLogoUrl: '', loginBackgroundUrl: '', faviconUrl: '', siteName: 'ICOCARD', footerText: '', accentColor: '' };
  return {
    token: sign(account),
    account: {
      ...publicAccount(account),
      orgName: org?.name ?? '',
      level: org?.level ?? 'hq',
      ...brand,
      menus: account.role === 'hq' ? [...MENU_IDS] : roleMenus(db)[account.staffRole || 'admin'],
    },
  };
}

router.get('/brand', (req, res) => {
  const host = String(req.query.host ?? '').trim().toLowerCase().split(':')[0];
  const db = readDb();
  const org = db.orgs.find((item) => {
    const domain = (item.customDomain || '').trim().toLowerCase();
    if (domain && domain === host) return true;
    const slug = (item.slug || '').trim().toLowerCase();
    return Boolean(slug) && (host === slug || host.startsWith(`${slug}.`));
  });
  const brand = org ? shownBrand(db, org) : { brandName: 'ICOCARD', logoUrl: '', loginLogoUrl: '', loginBackgroundUrl: '', faviconUrl: '', siteName: 'ICOCARD', footerText: '', accentColor: '', brandMode: 'custom' as const };
  res.json({
    ...brand,
    name: brand.brandName,
    slug: org?.slug || '',
    matched: Boolean(org),
  });
});

router.get('/orgs/:id/brand', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'operator_only' });
  const orgId = String(req.params.id || '');
  if (!canManage(actor, orgId)) return res.status(403).json({ error: 'org_forbidden' });
  const db = readDb();
  const org = db.orgs.find((item) => item.id === orgId);
  if (!org) return res.status(404).json({ error: 'org_missing' });
  res.json({ stored: storedBrand(org), shown: shownBrand(db, org) });
});

router.post('/orgs/:id/brand-file', (req, res) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ error: 'file_size' });
    const actor = requireActor(req, res);
    if (!actor || !allowStaff(actor, ['hq', 'admin'])) return res.status(403).json({ error: 'staff_forbidden' });
    const orgId = String(req.params.id || '');
    if (!canManage(actor, orgId)) return res.status(403).json({ error: 'org_forbidden' });
    const kind = String(req.body?.kind || '') as BrandKind;
    if (!(kind in brandKinds)) return res.status(400).json({ error: 'file_required' });
    const file = req.file;
    if (!file?.buffer?.length) return res.status(400).json({ error: 'file_required' });
    const saved = saveBrandImage(orgId, kind, file.buffer);
    if ('error' in saved) return res.status(400).json({ error: saved.error });
    const db = readDb();
    const org = db.orgs.find((item) => item.id === orgId);
    if (!org) return res.status(404).json({ error: 'org_missing' });
    applyBrand(org, { [brandKinds[kind].field]: saved.url, brandMode: 'custom' });
    writeDb(db);
    res.json({ url: saved.url, stored: storedBrand(org), shown: shownBrand(db, org) });
  });
});

router.post('/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const lock = loginFails.get(email);
  if (lock && lock.until > Date.now()) return res.status(429).json({ error: 'login_locked' });
  const db = readDb();
  const account = db.accounts.find((item) => item.email === email);
  if (!account || !checkPassword(password, account.passwordHash)) {
    const base = lock && lock.until && lock.until <= Date.now() ? 0 : lock?.n ?? 0;
    const n = base + 1;
    loginFails.set(email, { n, until: n >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
    return res.status(401).json({ error: 'login_bad' });
  }
  loginFails.delete(email);
  const org = db.orgs.find((item) => item.id === account.orgId);
  if (account.role === 'user' || !config.otpEnabled) return res.json(sessionBody(account, org));
  if (!account.otpSecret) {
    return res.json({ mustSetupOtp: true, enrollToken: sign(account, 'otp_enroll', '15m') });
  }
  res.json({ otpRequired: true, pendingToken: sign(account, 'otp_pending', '10m') });
});

router.post('/auth/otp/setup', (req, res) => {
  const actor = actorOf(req);
  if (!actor || actor.purpose !== 'otp_enroll') return res.status(401).json({ error: 'login_required' });
  const db = readDb();
  const account = db.accounts.find((item) => item.id === actor.sub);
  if (!account) return res.status(401).json({ error: 'login_required' });
  if (account.otpSecret) return res.status(400).json({ error: 'otp_exists' });
  const secret = account.otpPending || generateOtpSecret();
  account.otpPending = secret;
  writeDb(db);
  res.json({ secret, otpauth: otpAuthUrl(account.email, secret) });
});

router.post('/auth/otp/confirm', (req, res) => {
  const actor = actorOf(req);
  if (!actor || actor.purpose !== 'otp_enroll') return res.status(401).json({ error: 'login_required' });
  const code = String(req.body?.code ?? '');
  const db = readDb();
  const account = db.accounts.find((item) => item.id === actor.sub);
  const org = db.orgs.find((item) => item.id === account?.orgId);
  if (!account?.otpPending || !verifyTotp(account.otpPending, code)) return res.status(401).json({ error: 'otp_bad' });
  account.otpSecret = account.otpPending;
  delete account.otpPending;
  writeDb(db);
  res.json(sessionBody(account, org));
});

router.post('/auth/otp/verify', (req, res) => {
  const actor = actorOf(req);
  if (!actor || actor.purpose !== 'otp_pending') return res.status(401).json({ error: 'login_required' });
  const code = String(req.body?.code ?? '');
  const db = readDb();
  const account = db.accounts.find((item) => item.id === actor.sub);
  const org = db.orgs.find((item) => item.id === account?.orgId);
  if (!account?.otpSecret || !verifyTotp(account.otpSecret, code)) return res.status(401).json({ error: 'otp_bad' });
  res.json(sessionBody(account, org));
});

router.post('/auth/password', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;
  const current = String(req.body?.current ?? '');
  const next = String(req.body?.next ?? '');
  if (next.length < 8) return res.status(400).json({ error: 'password_short' });
  const db = readDb();
  const account = db.accounts.find((item) => item.id === actor.sub);
  if (!account || !checkPassword(current, account.passwordHash)) return res.status(400).json({ error: 'password_bad' });
  account.passwordHash = hashPassword(next);
  writeDb(db);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor) return;
  const db = readDb();
  const account = db.accounts.find((item) => item.id === actor.sub);
  const org = db.orgs.find((item) => item.id === actor.orgId);
  if (!account || !org) return res.status(401).json({ error: 'login_required' });
  res.json({
    account: {
      ...publicAccount(account),
      orgName: org.name,
      level: org.level,
      ...shownBrand(db, org),
      menus: account.role === 'hq' ? [...MENU_IDS] : roleMenus(db)[account.staffRole || 'admin'],
    },
    ip: clientIp(req),
    feeRate: db.feeRate,
  });
});

router.get('/access', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'operator_only' });
  const db = readDb();
  res.json({
    catalog: MENU_IDS,
    menus: roleMenus(db),
    canEdit: actor.role === 'hq',
  });
});

router.put('/access', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role !== 'hq') return res.status(403).json({ error: 'hq_only' });
  const db = readDb();
  const incoming = req.body?.menus && typeof req.body.menus === 'object' ? req.body.menus as Record<string, unknown> : null;
  if (!incoming) return res.status(400).json({ error: 'menus_required' });
  const roles: StaffRole[] = ['admin', 'accountant', 'general', 'operator'];
  const next: Partial<Record<StaffRole, string[]>> = {};
  for (const role of roles) {
    const list = Array.isArray(incoming[role]) ? incoming[role].map((id) => String(id)) : [];
    const picked = list.filter((id) => (MENU_IDS as readonly string[]).includes(id));
    if (!picked.includes('dashboard')) picked.unshift('dashboard');
    next[role] = picked;
  }
  db.menuAccess = next;
  writeDb(db);
  res.json({ ok: true, menus: roleMenus(db) });
});

router.get('/platform', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'operator_only' });
  const db = readDb();
  const root = db.orgs.find((org) => org.id === actor.orgId);
  if (!root) return res.status(404).json({ error: 'org_missing' });
  const scope = descendantIds(db, root.id);
  const base = 'business.icocard.net';
  res.json({
    publicHost: base,
    chainId: wirexCorporate.chainId,
    apiBase: wirexCorporate.apiBase,
    orgs: db.orgs.filter((org) => scope.has(org.id)).map((org) => {
      const domain = (org.customDomain || '').trim().toLowerCase();
      const slug = (org.slug || '').trim().toLowerCase();
      const host = domain || (slug ? `${slug}.${base}` : base);
      return {
        id: org.id,
        name: org.name,
        level: org.level,
        slug,
        customDomain: domain,
        loginHost: host,
      };
    }),
  });
});

function tree(db: ReturnType<typeof readDb>, org: Org): Record<string, unknown> {
  return {
    ...orgStats(db, org),
    children: childrenOf(db, org.id).map((child) => tree(db, child)),
  };
}

router.get('/overview', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'operator_only' });
  const db = readDb();
  const root = db.orgs.find((org) => org.id === actor.orgId);
  if (!root) return res.status(404).json({ error: 'org_missing' });
  const scope = descendantIds(db, root.id);
  res.json({
    feeRate: db.feeRate,
    tree: tree(db, root),
    accounts: db.accounts.filter((account) => scope.has(account.orgId)).map(publicAccount),
    staff: db.accounts.filter((account) => scope.has(account.orgId)).map(publicAccount),
    users: db.accounts.filter((account) => account.role === 'user' && scope.has(account.orgId)).map(publicAccount),
    operators: db.accounts.filter((account) => account.role === 'org' && scope.has(account.orgId)).map(publicAccount),
    cards: db.cards.filter((card) => scope.has(card.orgId)),
    spends: db.spends.filter((row) => scope.has(row.orgId)).slice().reverse(),
    charges: db.charges.filter((row) => scope.has(row.orgId)).slice().reverse(),
    events: db.feeEvents,
  });
});

router.patch('/hq', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role !== 'hq') return res.status(403).json({ error: 'hq_only' });
  const db = readDb();
  const hq = db.orgs.find((org) => org.level === 'hq');
  if (!hq) return res.status(404).json({ error: 'hq_missing' });
  const feeRate = req.body?.feeRate == null ? db.feeRate : Number(req.body.feeRate);
  const cardQuota = Number(req.body?.cardQuota);
  const limitBudget = Number(req.body?.limitBudget);
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 100) return res.status(400).json({ error: 'fee_rate' });
  if (!Number.isInteger(cardQuota) || cardQuota < 0) return res.status(400).json({ error: 'cards_int' });
  if (!Number.isFinite(limitBudget) || limitBudget < 0) return res.status(400).json({ error: 'limit_min' });
  const stats = orgStats(db, hq);
  const usedFloorCards = stats.allocatedCards + stats.cardsIssued;
  const usedFloorLimit = Math.max(money(stats.allocatedLimit + stats.limitUsed), fundedFloor(db, hq));
  if (cardQuota < usedFloorCards) return res.status(400).json({ error: 'cards_floor' });
  if (limitBudget < usedFloorLimit) return res.status(400).json({ error: 'limit_floor' });
  hq.cardQuota = cardQuota;
  hq.limitBudget = money(limitBudget);
  db.feeRate = money(feeRate);
  writeDb(db);
  res.json({ ok: true });
});

router.post('/orgs', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'operator_org' });
  const parentId = String(req.body?.parentId ?? '');
  const name = String(req.body?.name ?? '').trim();
  const cardQuota = Number(req.body?.cardQuota);
  const limitBudget = Number(req.body?.limitBudget);
  if (!name) return res.status(400).json({ error: 'org_name_required' });
  if (!Number.isInteger(cardQuota) || cardQuota < 0) return res.status(400).json({ error: 'cards_int' });
  if (!Number.isFinite(limitBudget) || limitBudget < 0) return res.status(400).json({ error: 'limit_min' });
  const db = readDb();
  const parent = db.orgs.find((org) => org.id === parentId);
  if (!parent || !canManage(actor, parent.id)) return res.status(403).json({ error: 'parent_forbidden' });
  const level = nextLevel[parent.level];
  if (!level) return res.status(400).json({ error: 'no_child' });
  if (!allowStaff(actor, ['hq', 'admin'])) return res.status(403).json({ error: 'staff_forbidden' });
  const rep = req.body?.representative ?? {};
  const repName = String(rep.name ?? '').trim();
  const repEmail = String(rep.email ?? '').trim().toLowerCase();
  const repPassword = String(rep.password ?? '');
  if (!repName) return res.status(400).json({ error: 'name_required' });
  if (!emailPattern.test(repEmail)) return res.status(400).json({ error: 'email_invalid' });
  if (repPassword.length < 8) return res.status(400).json({ error: 'password_short' });
  if (db.accounts.some((account) => account.email === repEmail)) return res.status(400).json({ error: 'email_exists' });
  const stats = orgStats(db, parent);
  if (cardQuota > stats.remainingCards) return res.status(400).json({ error: 'cards_over' });
  if (limitBudget > stats.remainingLimit) return res.status(400).json({ error: 'limit_over' });
  const funding = readFunding(req.body);
  if (funding.error || funding.mode == null || funding.prefundedBudget == null) return res.status(400).json({ error: funding.error || 'prefunded_min' });
  const brand = readBrand(db, '', req.body?.brand);
  if (brand.error || !brand.fields) return res.status(400).json({ error: brand.error || 'domain_invalid' });
  const orgId = crypto.randomUUID();
  db.orgs.push({
    id: orgId,
    name,
    level,
    parentId: parent.id,
    cardQuota,
    limitBudget: money(limitBudget),
    profile: readProfile(req.body?.profile),
    fundingMode: funding.mode,
    prefundedBudget: funding.prefundedBudget,
    ...brand.fields,
    brandMode: brand.fields.brandMode || ((brand.fields.brandName || brand.fields.logoUrl || brand.fields.loginLogoUrl || brand.fields.loginBackgroundUrl || brand.fields.faviconUrl || brand.fields.siteName || brand.fields.footerText || brand.fields.accentColor) ? 'custom' : 'follow'),
  });
  db.accounts.push({
    id: crypto.randomUUID(),
    role: 'org',
    orgId,
    name: repName,
    email: repEmail,
    passwordHash: hashPassword(repPassword),
    staffRole: 'admin',
    primary: true,
  });
  writeDb(db);
  res.status(201).json({ ok: true });
});

router.patch('/orgs/:id', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'operator_edit' });
  const db = readDb();
  const org = db.orgs.find((item) => item.id === req.params.id);
  if (!org || !canManage(actor, org.id)) return res.status(404).json({ error: 'org_missing' });
  const wantsName = req.body?.name != null;
  const wantsQuota = req.body?.cardQuota != null || req.body?.limitBudget != null;
  const wantsProfile = req.body?.profile != null;
  const wantsFunding = req.body?.fundingMode != null || req.body?.prefundedBudget != null;
  const wantsBrand = req.body?.brand != null;
  if (!wantsName && !wantsQuota && !wantsProfile && !wantsFunding && !wantsBrand) return res.status(400).json({ error: 'org_name_required' });
  if ((wantsName || wantsProfile) && !allowStaff(actor, ['hq', 'admin'])) return res.status(403).json({ error: 'staff_forbidden' });
  if (wantsName) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'org_name_required' });
    org.name = name;
  }
  if (wantsProfile) org.profile = readProfile(req.body.profile);
  if (wantsQuota) {
    if (!org.parentId) return res.status(400).json({ error: 'hq_quota' });
    if (!canManage(actor, org.parentId)) return res.status(403).json({ error: 'org_forbidden' });
    const parent = db.orgs.find((item) => item.id === org.parentId);
    if (!parent) return res.status(404).json({ error: 'parent_missing' });
    const cardQuota = Number(req.body?.cardQuota);
    const limitBudget = Number(req.body?.limitBudget);
    if (!Number.isInteger(cardQuota) || cardQuota < 0) return res.status(400).json({ error: 'cards_int' });
    if (!Number.isFinite(limitBudget) || limitBudget < 0) return res.status(400).json({ error: 'limit_min' });
    const parentRoomCards = orgStats(db, parent).remainingCards + org.cardQuota;
    const parentRoomLimit = money(orgStats(db, parent).remainingLimit + org.limitBudget);
    const ownFloorCards = childrenOf(db, org.id).reduce((sum, child) => sum + child.cardQuota, 0) + issuedCount(db, org.id);
    const ownFloorLimit = Math.max(money(childrenOf(db, org.id).reduce((sum, child) => sum + child.limitBudget, 0) + usedAmount(db, org.id)), fundedFloor(db, org));
    if (cardQuota > parentRoomCards || cardQuota < ownFloorCards) return res.status(400).json({ error: 'cards_range' });
    if (limitBudget > parentRoomLimit || limitBudget < ownFloorLimit) return res.status(400).json({ error: 'limit_range' });
    org.cardQuota = cardQuota;
    org.limitBudget = money(limitBudget);
  }
  if (wantsFunding) {
    if (!allowStaff(actor, ['hq', 'admin'])) return res.status(403).json({ error: 'staff_forbidden' });
    const funding = readFunding({ ...org, ...req.body });
    if (funding.error || funding.mode == null || funding.prefundedBudget == null) return res.status(400).json({ error: funding.error || 'prefunded_min' });
    const problem = fundingFits(db, org, funding.mode, funding.prefundedBudget);
    if (problem) return res.status(400).json({ error: problem });
    org.fundingMode = funding.mode;
    org.prefundedBudget = funding.prefundedBudget;
  }
  if (wantsBrand) {
    if (!allowStaff(actor, ['hq', 'admin'])) return res.status(403).json({ error: 'staff_forbidden' });
    const brand = readBrand(db, org.id, req.body.brand);
    if (brand.error || !brand.fields) return res.status(400).json({ error: brand.error || 'domain_invalid' });
    applyBrand(org, brand.fields);
  }
  writeDb(db);
  res.json(wantsBrand ? { ok: true, stored: storedBrand(org), shown: shownBrand(db, org) } : { ok: true });
});

router.post('/accounts', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'operator_account' });
  const role = req.body?.role === 'org' || req.body?.role === 'user' || req.body?.role === 'hq' ? req.body.role as Role : null;
  const orgId = String(req.body?.orgId ?? '');
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!allowStaff(actor, ['hq', 'admin'])) return res.status(403).json({ error: 'staff_forbidden' });
  if (!role) return res.status(400).json({ error: 'role_required' });
  if (!name) return res.status(400).json({ error: 'name_required' });
  if (!emailPattern.test(email)) return res.status(400).json({ error: 'email_invalid' });
  if (password.length < 8) return res.status(400).json({ error: 'password_short' });
  const db = readDb();
  const org = db.orgs.find((item) => item.id === orgId);
  if (!org || !canManage(actor, org.id)) return res.status(403).json({ error: 'account_forbidden' });
  if (role === 'hq' && (actor.role !== 'hq' || org.level !== 'hq')) return res.status(403).json({ error: 'account_forbidden' });
  if (role !== 'hq' && org.level === 'hq') return res.status(400).json({ error: 'user_level' });
  const staffRoles: StaffRole[] = ['admin', 'accountant', 'general', 'operator'];
  const staffRole = staffRoles.includes(req.body?.staffRole) ? req.body.staffRole as StaffRole : 'operator';
  if (db.accounts.some((account) => account.email === email)) return res.status(400).json({ error: 'email_exists' });
  const spendMode: SpendMode = req.body?.spendMode === 'prefunded' ? 'prefunded' : 'shared';
  db.accounts.push({
    id: crypto.randomUUID(),
    role,
    orgId,
    name,
    email,
    passwordHash: hashPassword(password),
    staffRole: role === 'org' ? staffRole : undefined,
    primary: false,
    spendMode: role === 'user' ? spendMode : undefined,
  });
  writeDb(db);
  res.status(201).json({ ok: true });
});

function readRate(value: unknown): Rate | null {
  if (!value || typeof value !== 'object') return null;
  const pct = rateNum(Number((value as Rate).pct));
  const fixed = rateNum(Number((value as Rate).fixed));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  if (!Number.isFinite(fixed) || fixed < 0) return null;
  return { pct, fixed };
}

function bill(db: ReturnType<typeof readDb>, card: BizCard, codes: string[], base: number) {
  const org = db.orgs.find((item) => item.id === card.orgId);
  if (!org) return { error: 'org_missing' };
  const lines = feeLines(db, card.orgId, codes, base);
  const { orgFee, userFee } = splitFees(lines);
  const short = chargeFits(db, org, card, base, orgFee);
  if (short) return { error: short };
  const createdAt = new Date().toISOString();
  for (const line of lines) {
    db.charges.push({
      id: crypto.randomUUID(),
      cardId: card.id,
      orgId: card.orgId,
      userId: card.userId,
      feeItemId: line.feeItemId,
      feeName: line.feeName,
      eventCode: line.eventCode,
      payer: line.payer,
      base: money(base),
      pct: line.pct,
      fixed: line.fixed,
      total: line.total,
      createdAt,
    });
  }
  return { orgFee, userFee, lines };
}

router.get('/fees', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user') return res.status(403).json({ error: 'fee_view' });
  const db = readDb();
  const scope = descendantIds(db, actor.orgId);
  const org = db.orgs.find((item) => item.id === actor.orgId);
  res.json({
    role: actor.role,
    orgId: actor.orgId,
    level: org?.level ?? 'hq',
    events: db.feeEvents,
    items: db.feeItems,
    markups: db.markups.filter((row) => scope.has(row.orgId)),
    orgs: db.orgs.filter((item) => scope.has(item.id)).map((item) => ({ id: item.id, name: item.name, level: item.level, parentId: item.parentId })),
  });
});

router.post('/fee-events', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role !== 'hq') return res.status(403).json({ error: 'hq_event' });
  const name = String(req.body?.name ?? '').trim();
  const code = String(req.body?.code ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!name) return res.status(400).json({ error: 'event_name' });
  if (!code) return res.status(400).json({ error: 'event_code' });
  const db = readDb();
  if (db.feeEvents.some((event) => event.code === code)) return res.status(400).json({ error: 'event_exists' });
  db.feeEvents.push({ id: crypto.randomUUID(), name, code });
  writeDb(db);
  res.status(201).json({ ok: true });
});

router.delete('/fee-events/:id', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role !== 'hq') return res.status(403).json({ error: 'hq_event_delete' });
  const db = readDb();
  const event = db.feeEvents.find((item) => item.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'event_missing' });
  if (db.feeItems.some((item) => item.eventId === event.id)) return res.status(400).json({ error: 'event_in_use' });
  db.feeEvents = db.feeEvents.filter((item) => item.id !== event.id);
  writeDb(db);
  res.json({ ok: true });
});

router.post('/fees', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role !== 'hq') return res.status(403).json({ error: 'hq_fee' });
  const name = String(req.body?.name ?? '').trim();
  const eventId = String(req.body?.eventId ?? '');
  const payer = req.body?.payer === 'user' ? 'user' : req.body?.payer === 'org' ? 'org' : null;
  const threshold = req.body?.threshold == null || req.body?.threshold === '' ? null : Number(req.body.threshold);
  if (!name) return res.status(400).json({ error: 'fee_name' });
  if (!payer) return res.status(400).json({ error: 'payer_required' });
  if (threshold != null && (!Number.isFinite(threshold) || threshold < 0)) return res.status(400).json({ error: 'threshold_min' });
  const db = readDb();
  const event = db.feeEvents.find((item) => item.id === eventId);
  if (!event) return res.status(400).json({ error: 'event_required' });
  if (event.code === 'under' && threshold == null) return res.status(400).json({ error: 'under_threshold' });
  db.feeItems.push({ id: crypto.randomUUID(), name, eventId, payer, threshold, w: { pct: 0, fixed: 0 }, hq: { pct: 0, fixed: 0 } });
  writeDb(db);
  res.status(201).json({ ok: true });
});

router.patch('/fees/:id', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user' || !allowStaff(actor, ['hq', 'admin'])) return res.status(403).json({ error: 'fee_edit' });
  const db = readDb();
  const item = db.feeItems.find((row) => row.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'fee_missing' });
  const actorOrg = db.orgs.find((org) => org.id === actor.orgId);
  if (!actorOrg) return res.status(403).json({ error: 'org_missing' });
  if (actor.role === 'hq') {
    if (req.body?.name != null) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'fee_name' });
      item.name = name;
    }
    if (req.body?.payer === 'org' || req.body?.payer === 'user') item.payer = req.body.payer;
    if (req.body?.threshold === null || req.body?.threshold === '') item.threshold = null;
    else if (req.body?.threshold != null) {
      const threshold = Number(req.body.threshold);
      if (!Number.isFinite(threshold) || threshold < 0) return res.status(400).json({ error: 'threshold_min' });
      item.threshold = money(threshold);
    }
    const event = db.feeEvents.find((row) => row.id === item.eventId);
    if (event?.code === 'under' && item.threshold == null) return res.status(400).json({ error: 'under_threshold' });
    if (req.body?.w != null) {
      const rate = readRate(req.body.w);
      if (!rate) return res.status(400).json({ error: 'w_rate' });
      item.w = rate;
    }
    if (req.body?.hq != null) {
      const rate = readRate(req.body.hq);
      if (!rate) return res.status(400).json({ error: 'hq_rate' });
      item.hq = rate;
    }
  }
  const markups = Array.isArray(req.body?.markups) ? req.body.markups as Array<{ orgId?: string; pct?: number; fixed?: number }> : [];
  for (const markup of markups) {
    const orgId = String(markup?.orgId ?? '');
    const org = db.orgs.find((row) => row.id === orgId);
    if (!org || org.level === 'hq') return res.status(400).json({ error: 'markup_level' });
    if (actor.role !== 'hq' && org.id !== actor.orgId) return res.status(403).json({ error: 'markup_self' });
    if (actor.role !== 'hq' && !canManage(actor, org.id)) return res.status(403).json({ error: 'markup_forbidden' });
    const rate = readRate(markup);
    if (!rate) return res.status(400).json({ error: 'markup_rate' });
    const current = db.markups.find((row) => row.orgId === org.id && row.feeItemId === item.id);
    if (current) {
      current.pct = rate.pct;
      current.fixed = rate.fixed;
    } else db.markups.push({ orgId: org.id, feeItemId: item.id, pct: rate.pct, fixed: rate.fixed });
  }
  if (actor.role !== 'hq' && markups.length === 0) return res.status(403).json({ error: 'markup_self' });
  writeDb(db);
  res.json({ ok: true });
});

router.delete('/fees/:id', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role !== 'hq') return res.status(403).json({ error: 'hq_fee_delete' });
  const db = readDb();
  if (!db.feeItems.some((item) => item.id === req.params.id)) return res.status(404).json({ error: 'fee_missing' });
  db.feeItems = db.feeItems.filter((item) => item.id !== req.params.id);
  db.markups = db.markups.filter((row) => row.feeItemId !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

router.post('/cards', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user' || !allowStaff(actor, ['hq', 'admin', 'general', 'operator'])) return res.status(403).json({ error: 'operator_card' });
  const userId = String(req.body?.userId ?? '');
  const name = String(req.body?.name ?? '').trim();
  const format = req.body?.format === 'plastic' ? 'plastic' : 'virtual';
  if (!name) return res.status(400).json({ error: 'card_name' });
  const db = readDb();
  const user = db.accounts.find((account) => account.id === userId && account.role === 'user');
  if (!user || !canManage(actor, user.orgId)) return res.status(400).json({ error: 'user_required' });
  const org = db.orgs.find((item) => item.id === user.orgId);
  if (!org) return res.status(404).json({ error: 'org_missing' });
  if (orgStats(db, org).remainingCards < 1) return res.status(400).json({ error: 'cards_empty' });
  const spendMode: SpendMode = req.body?.spendMode === 'prefunded' || req.body?.spendMode === 'shared'
    ? req.body.spendMode
    : user.spendMode === 'prefunded' ? 'prefunded' : 'shared';
  const cardLimit = Number(req.body?.cardLimit);
  const reserveError = reserveFits(db, org, spendMode, cardLimit);
  if (reserveError) return res.status(400).json({ error: reserveError });
  const card: BizCard = {
    id: crypto.randomUUID(),
    orgId: org.id,
    userId: user.id,
    name,
    format,
    status: 'active',
    spendMode,
    cardLimit: money(cardLimit),
    createdAt: new Date().toISOString(),
  };
  const billed = bill(db, card, ['issue'], 0);
  if (billed.error) return res.status(400).json({ error: billed.error });
  db.cards.push(card);
  writeDb(db);
  res.status(201).json({ ok: true, orgFee: billed.orgFee, userFee: billed.userFee });
});

router.post('/cards/:id/spend', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role === 'user' || !allowStaff(actor, ['hq', 'admin', 'general', 'operator'])) return res.status(403).json({ error: 'operator_spend' });
  const amount = Number(req.body?.amount);
  const merchant = String(req.body?.merchant ?? '').trim() || 'Payment';
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount_min' });
  const db = readDb();
  const card = db.cards.find((item) => item.id === req.params.id);
  if (!card || card.status !== 'active' || !canManage(actor, card.orgId)) return res.status(404).json({ error: 'card_inactive' });
  const billed = bill(db, card, ['spend', 'under'], amount);
  if (billed.error) return res.status(400).json({ error: billed.error });
  db.spends.push({
    id: crypto.randomUUID(),
    cardId: card.id,
    orgId: card.orgId,
    userId: card.userId,
    merchant,
    amount: money(amount),
    fee: money((billed.orgFee ?? 0) + (billed.userFee ?? 0)),
    orgFee: billed.orgFee,
    userFee: billed.userFee,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  res.status(201).json({ amount: money(amount), orgFee: billed.orgFee, userFee: billed.userFee });
});

function cardAction(req: { params: { id?: string }; header: (name: string) => string | undefined }, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  const actor = requireActor(req, res);
  if (!actor) return null;
  if (actor.role === 'user' || !allowStaff(actor, ['hq', 'admin', 'general', 'operator'])) {
    res.status(403).json({ error: 'operator_card_edit' });
    return null;
  }
  const db = readDb();
  const card = db.cards.find((item) => item.id === req.params.id);
  if (!card || card.status === 'closed' || !canManage(actor, card.orgId)) {
    res.status(404).json({ error: 'card_missing' });
    return null;
  }
  return { actor, db, card };
}

router.post('/cards/:id/block', (req, res) => {
  const found = cardAction(req, res);
  if (!found) return;
  if (found.card.status !== 'active') return res.status(400).json({ error: 'block_active' });
  const billed = bill(found.db, found.card, ['block'], 0);
  if (billed.error) return res.status(400).json({ error: billed.error });
  found.card.status = 'blocked';
  writeDb(found.db);
  res.json({ ok: true, orgFee: billed.orgFee, userFee: billed.userFee });
});

router.post('/cards/:id/unblock', (req, res) => {
  const found = cardAction(req, res);
  if (!found) return;
  if (found.card.status !== 'blocked') return res.status(400).json({ error: 'unblock_blocked' });
  const billed = bill(found.db, found.card, ['unblock'], 0);
  if (billed.error) return res.status(400).json({ error: billed.error });
  found.card.status = 'active';
  writeDb(found.db);
  res.json({ ok: true, orgFee: billed.orgFee, userFee: billed.userFee });
});

router.post('/cards/:id/reissue', (req, res) => {
  const found = cardAction(req, res);
  if (!found) return;
  const org = found.db.orgs.find((item) => item.id === found.card.orgId);
  if (!org) return res.status(404).json({ error: 'org_missing' });
  const previous = found.card.status;
  found.card.status = 'closed';
  if (orgStats(found.db, org).remainingCards < 1) {
    found.card.status = previous;
    return res.status(400).json({ error: 'reissue_cards' });
  }
  if (found.card.cardLimit != null) {
    const reserveError = reserveFits(found.db, org, found.card.spendMode === 'prefunded' ? 'prefunded' : 'shared', found.card.cardLimit);
    if (reserveError) {
      found.card.status = previous;
      return res.status(400).json({ error: reserveError });
    }
  }
  const next: BizCard = {
    id: crypto.randomUUID(),
    orgId: found.card.orgId,
    userId: found.card.userId,
    name: found.card.name,
    format: found.card.format,
    status: 'active',
    spendMode: found.card.spendMode,
    cardLimit: found.card.cardLimit,
    createdAt: new Date().toISOString(),
  };
  const billed = bill(found.db, next, ['reissue'], 0);
  if (billed.error) {
    found.card.status = previous;
    return res.status(400).json({ error: billed.error });
  }
  found.db.cards.push(next);
  writeDb(found.db);
  res.status(201).json({ ok: true, orgFee: billed.orgFee, userFee: billed.userFee });
});

router.post('/cards/:id/monthly', (req, res) => {
  const found = cardAction(req, res);
  if (!found) return;
  if (found.card.status !== 'active') return res.status(400).json({ error: 'monthly_active' });
  const key = monthKey();
  if (found.card.monthKey === key) return res.status(400).json({ error: 'monthly_done' });
  const billed = bill(found.db, found.card, ['monthly'], 0);
  if (billed.error) return res.status(400).json({ error: billed.error });
  found.card.monthKey = key;
  writeDb(found.db);
  res.json({ ok: true, month: key, orgFee: billed.orgFee, userFee: billed.userFee });
});

router.post('/cards/:id/charge', (req, res) => {
  const found = cardAction(req, res);
  if (!found) return;
  if (found.card.status === 'closed') return res.status(400).json({ error: 'charge_closed' });
  const code = String(req.body?.code ?? '').trim();
  const event = found.db.feeEvents.find((item) => item.code === code);
  if (!event) return res.status(400).json({ error: 'event_required' });
  const amount = req.body?.amount == null || req.body?.amount === '' ? 0 : Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'threshold_min' });
  const billed = bill(found.db, found.card, [code], amount);
  if (billed.error) return res.status(400).json({ error: billed.error });
  if (amount > 0) {
    found.db.spends.push({
      id: crypto.randomUUID(),
      cardId: found.card.id,
      orgId: found.card.orgId,
      userId: found.card.userId,
      merchant: event.name,
      amount: money(amount),
      fee: money((billed.orgFee ?? 0) + (billed.userFee ?? 0)),
      orgFee: billed.orgFee,
      userFee: billed.userFee,
      createdAt: new Date().toISOString(),
    });
  }
  writeDb(found.db);
  res.status(201).json({ ok: true, orgFee: billed.orgFee, userFee: billed.userFee });
});

router.post('/cards/:id/atm', (req, res) => {
  const found = cardAction(req, res);
  if (!found) return;
  if (found.card.status !== 'active') return res.status(400).json({ error: 'atm_active' });
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'atm_amount' });
  const billed = bill(found.db, found.card, ['atm'], amount);
  if (billed.error) return res.status(400).json({ error: billed.error });
  found.db.spends.push({
    id: crypto.randomUUID(),
    cardId: found.card.id,
    orgId: found.card.orgId,
    userId: found.card.userId,
    merchant: 'ATM',
    amount: money(amount),
    fee: money((billed.orgFee ?? 0) + (billed.userFee ?? 0)),
    orgFee: billed.orgFee,
    userFee: billed.userFee,
    createdAt: new Date().toISOString(),
  });
  writeDb(found.db);
  res.status(201).json({ amount: money(amount), orgFee: billed.orgFee, userFee: billed.userFee });
});

router.get('/me', (req, res) => {
  const actor = requireActor(req, res);
  if (!actor || actor.role !== 'user') return res.status(403).json({ error: 'user_only' });
  const db = readDb();
  const account = db.accounts.find((item) => item.id === actor.sub);
  const org = db.orgs.find((item) => item.id === actor.orgId);
  const cards = db.cards.filter((card) => card.userId === actor.sub);
  const spends = db.spends.filter((row) => row.userId === actor.sub).slice().reverse();
  const charges = db.charges.filter((row) => row.userId === actor.sub).slice().reverse();
  res.json({
    account: account && org ? { ...publicAccount(account), orgName: org.name, level: org.level, ...shownBrand(db, org) } : null,
    cards,
    spends,
    charges,
  });
});

export default router;
