import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type OrgLevel = 'hq' | 'large' | 'middle' | 'small';
export type Role = 'hq' | 'org' | 'user';
export type StaffRole = 'admin' | 'accountant' | 'general' | 'operator';
export type FundingMode = 'prefunded' | 'shared' | 'split';
export type SpendMode = 'prefunded' | 'shared';

export type OrgProfile = {
  bizNo: string;
  bizType: string;
  industry: string;
  ceoName: string;
  mobile: string;
  phone: string;
  fax: string;
  email: string;
  zip: string;
  address: string;
  addressDetail: string;
  salesInfo: string;
  useYn: 'Y' | 'N' | 'S';
  homepage: string;
  product: string;
  settleName: string;
  settlePhone: string;
  wallet: string;
  network: string;
};

export type Org = {
  id: string;
  name: string;
  level: OrgLevel;
  parentId: string | null;
  cardQuota: number;
  limitBudget: number;
  profile?: OrgProfile;
  fundingMode?: FundingMode;
  prefundedBudget?: number;
  brandName?: string;
  logoUrl?: string;
  slug?: string;
  customDomain?: string;
  accentColor?: string;
};

export type Account = {
  id: string;
  role: Role;
  orgId: string;
  name: string;
  email: string;
  passwordHash: string;
  otpSecret?: string;
  otpPending?: string;
  staffRole?: StaffRole;
  primary?: boolean;
  spendMode?: SpendMode;
};

export type BizCard = {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  format: 'virtual' | 'plastic';
  status: 'active' | 'blocked' | 'closed';
  spendMode?: SpendMode;
  cardLimit?: number;
  createdAt: string;
  monthKey?: string;
};

export type Spend = {
  id: string;
  cardId: string;
  orgId: string;
  userId: string;
  merchant: string;
  amount: number;
  fee: number;
  orgFee?: number;
  userFee?: number;
  createdAt: string;
};

export type Rate = { pct: number; fixed: number };

export type FeeEvent = { id: string; name: string; code: string };

export type FeeItem = {
  id: string;
  name: string;
  eventId: string;
  payer: 'org' | 'user';
  threshold: number | null;
  w: Rate;
  hq: Rate;
};

export type OrgMarkup = { orgId: string; feeItemId: string; pct: number; fixed: number };

export type Charge = {
  id: string;
  cardId: string;
  orgId: string;
  userId: string;
  feeItemId: string;
  feeName: string;
  eventCode: string;
  payer: 'org' | 'user';
  base: number;
  pct: number;
  fixed: number;
  total: number;
  createdAt: string;
};

type Db = {
  feeRate: number;
  orgs: Org[];
  accounts: Account[];
  cards: BizCard[];
  spends: Spend[];
  feeEvents: FeeEvent[];
  feeItems: FeeItem[];
  markups: OrgMarkup[];
  charges: Charge[];
  menuAccess?: Partial<Record<StaffRole, string[]>>;
};

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/org.json');

export function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, 'hex');
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function empty(): Db {
  const hqId = 'hq';
  return {
    feeRate: 1,
    orgs: [{ id: hqId, name: '본사', level: 'hq', parentId: null, cardQuota: 45, limitBudget: 100000 }],
    accounts: [{
      id: 'hq-admin',
      role: 'hq',
      orgId: hqId,
      name: '본사 운영자',
      email: 'hq@icocard.net',
      passwordHash: hashPassword('hq1234'),
    }],
    cards: [],
    spends: [],
    feeEvents: defaultFeeEvents(),
    feeItems: [],
    markups: [],
    charges: [],
  };
}

const builtinFeeEvents: Array<[string, string]> = [
  ['issue', '카드 발급 (1회)'],
  ['monthly', '월간 과금'],
  ['spend', '사용시 과금'],
  ['block', '카드 중지'],
  ['unblock', '카드 사용해제'],
  ['reissue', '카드 재발급'],
  ['atm', 'ATM 인출'],
  ['under', '결제금액 이하 추가'],
];

function defaultFeeEvents(): FeeEvent[] {
  return builtinFeeEvents.map(([code, name]) => ({ id: code, name, code }));
}

function normalize(data: Db): Db {
  data.feeEvents = data.feeEvents?.length ? data.feeEvents : defaultFeeEvents();
  data.feeItems = data.feeItems ?? [];
  data.markups = data.markups ?? [];
  data.charges = data.charges ?? [];
  data.menuAccess = data.menuAccess ?? {};
  return data;
}

export const MENU_IDS = ['dashboard', 'orgs', 'risk', 'revenue', 'usage', 'fees', 'orgOps', 'users', 'activity', 'brand', 'access', 'platform', 'manual', 'link'] as const;

export const DEFAULT_ROLE_MENUS: Record<StaffRole, string[]> = {
  admin: ['dashboard', 'orgs', 'risk', 'revenue', 'usage', 'fees', 'orgOps', 'users', 'activity', 'access', 'manual'],
  accountant: ['dashboard', 'revenue', 'fees', 'activity', 'manual'],
  general: ['dashboard', 'orgs', 'users', 'usage', 'activity', 'manual'],
  operator: ['dashboard', 'usage', 'activity', 'manual'],
};

export function roleMenus(db: Db): Record<StaffRole, string[]> {
  const stored = db.menuAccess ?? {};
  const roles: StaffRole[] = ['admin', 'accountant', 'general', 'operator'];
  const out = {} as Record<StaffRole, string[]>;
  for (const role of roles) {
    const picked = stored[role]?.filter((id) => (MENU_IDS as readonly string[]).includes(id));
    out[role] = picked?.length ? picked : [...DEFAULT_ROLE_MENUS[role]];
  }
  return out;
}

export function readDb(): Db {
  try {
    const data = normalize(JSON.parse(fs.readFileSync(file, 'utf8')) as Db);
    if (!data.orgs?.length) return empty();
    return data;
  } catch {
    const seeded = empty();
    writeDb(seeded);
    return seeded;
  }
}

export function writeDb(db: Db) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

export function childrenOf(db: Db, orgId: string) {
  return db.orgs.filter((org) => org.parentId === orgId);
}

export function descendantIds(db: Db, orgId: string): Set<string> {
  const ids = new Set<string>([orgId]);
  const walk = (id: string) => {
    for (const child of childrenOf(db, id)) {
      ids.add(child.id);
      walk(child.id);
    }
  };
  walk(orgId);
  return ids;
}

export function issuedCount(db: Db, orgId: string) {
  return db.cards.filter((card) => card.orgId === orgId && card.status !== 'closed').length;
}

export function usedAmount(db: Db, orgId: string) {
  const payments = db.spends.filter((row) => row.orgId === orgId).reduce((sum, row) => {
    const legacyFee = row.orgFee == null ? row.fee : 0;
    return sum + row.amount + legacyFee;
  }, 0);
  const orgCharges = db.charges.filter((row) => row.orgId === orgId && row.payer === 'org').reduce((sum, row) => sum + row.total, 0);
  return money(payments + orgCharges);
}

export function chainOf(db: Db, orgId: string) {
  const chain: Org[] = [];
  const seen = new Set<string>();
  let current = db.orgs.find((org) => org.id === orgId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? db.orgs.find((org) => org.id === current?.parentId) : undefined;
  }
  return chain;
}

export function rateNum(value: number) {
  return Math.round((value + Number.EPSILON) * 1e6) / 1e6;
}

export type FeeLine = {
  feeItemId: string;
  feeName: string;
  eventCode: string;
  payer: 'org' | 'user';
  pct: number;
  fixed: number;
  total: number;
};

export function feeLines(db: Db, orgId: string, codes: string[], base: number): FeeLine[] {
  const chain = chainOf(db, orgId);
  const lines: FeeLine[] = [];
  for (const code of codes) {
    for (const item of db.feeItems) {
      const event = db.feeEvents.find((row) => row.id === item.eventId);
      if (!event || event.code !== code) continue;
      if (code === 'under') {
        if (item.threshold == null || base > item.threshold) continue;
      }
      const parts: Rate[] = [item.w, item.hq];
      for (const level of ['large', 'middle', 'small'] as const) {
        const owner = chain.find((org) => org.level === level);
        if (!owner) continue;
        const markup = db.markups.find((row) => row.orgId === owner.id && row.feeItemId === item.id);
        parts.push(markup ?? { pct: 0, fixed: 0 });
      }
      const pct = rateNum(parts.reduce((sum, part) => sum + part.pct, 0));
      const fixed = rateNum(parts.reduce((sum, part) => sum + part.fixed, 0));
      const total = money(base * pct / 100 + fixed);
      if (total <= 0) continue;
      lines.push({ feeItemId: item.id, feeName: item.name, eventCode: code, payer: item.payer, pct, fixed, total });
    }
  }
  return lines;
}

export function splitFees(lines: FeeLine[]) {
  const orgFee = money(lines.filter((line) => line.payer === 'org').reduce((sum, line) => sum + line.total, 0));
  const userFee = money(lines.filter((line) => line.payer === 'user').reduce((sum, line) => sum + line.total, 0));
  return { orgFee, userFee };
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function fundingModeOf(org: Org): FundingMode {
  return org.fundingMode === 'prefunded' || org.fundingMode === 'split' ? org.fundingMode : 'shared';
}

export function cardSpendMode(card: BizCard): SpendMode {
  return card.spendMode === 'prefunded' ? 'prefunded' : 'shared';
}

export function cardSpent(db: Db, cardId: string) {
  const payments = db.spends.filter((row) => row.cardId === cardId).reduce((sum, row) => {
    const legacyFee = row.orgFee == null ? row.fee : 0;
    return sum + row.amount + legacyFee;
  }, 0);
  const orgCharges = db.charges.filter((row) => row.cardId === cardId && row.payer === 'org').reduce((sum, row) => sum + row.total, 0);
  return money(payments + orgCharges);
}

export function poolsOf(db: Db, org: Org) {
  const allocatedLimit = money(childrenOf(db, org.id).reduce((sum, child) => sum + child.limitBudget, 0));
  const own = money(org.limitBudget - allocatedLimit);
  const mode = fundingModeOf(org);
  const requested = money(Math.max(0, org.prefundedBudget ?? 0));
  const prefundedPool = mode === 'prefunded' ? Math.max(own, 0) : mode === 'split' ? money(Math.min(requested, Math.max(own, 0))) : 0;
  const sharedPool = money(Math.max(0, own - prefundedPool));
  const openCards = db.cards.filter((card) => card.orgId === org.id && card.status !== 'closed');
  const reserved = money(openCards.filter((card) => cardSpendMode(card) === 'prefunded').reduce((sum, card) => sum + (card.cardLimit ?? 0), 0));
  const sharedSpent = money(db.cards.filter((card) => card.orgId === org.id && cardSpendMode(card) === 'shared').reduce((sum, card) => sum + cardSpent(db, card.id), 0));
  return {
    fundingMode: mode,
    prefundedBudget: money(org.prefundedBudget ?? 0),
    operatingBudget: own,
    prefundedPool: money(prefundedPool),
    sharedPool,
    reserved,
    prefundedFree: money(prefundedPool - reserved),
    sharedRemaining: money(sharedPool - sharedSpent),
  };
}

export function fundingFits(db: Db, org: Org, mode: FundingMode, prefundedBudget: number) {
  const draft: Org = { ...org, fundingMode: mode, prefundedBudget };
  const own = money(org.limitBudget - childrenOf(db, org.id).reduce((sum, child) => sum + child.limitBudget, 0));
  if (mode === 'split' && prefundedBudget > Math.max(own, 0) + 0.001) return 'prefunded_short';
  const pools = poolsOf(db, draft);
  const openCards = db.cards.filter((card) => card.orgId === org.id && card.status !== 'closed');
  for (const card of openCards) {
    const spendMode = cardSpendMode(card);
    if (mode === 'prefunded' && spendMode !== 'prefunded') return 'funding_cards';
    if (mode === 'shared' && spendMode === 'prefunded') return 'funding_cards';
    if (spendMode === 'prefunded' && !(card.cardLimit && card.cardLimit > 0)) return 'funding_cards';
  }
  if (pools.reserved > pools.prefundedPool + 0.001) return 'prefunded_short';
  if (pools.sharedRemaining < -0.001) return 'shared_short';
  return null;
}

export function reserveFits(db: Db, org: Org, spendMode: SpendMode, cardLimit: number) {
  const mode = fundingModeOf(org);
  if (mode === 'prefunded' && spendMode !== 'prefunded') return 'spend_mode';
  if (mode === 'shared' && spendMode !== 'shared') return 'spend_mode';
  if (!Number.isFinite(cardLimit) || cardLimit <= 0) return 'card_limit_min';
  const pools = poolsOf(db, org);
  if (spendMode === 'prefunded' && cardLimit > pools.prefundedFree + 0.001) return 'prefunded_short';
  return null;
}

export function chargeFits(db: Db, org: Org, card: BizCard, base: number, orgFee: number) {
  const cost = money(base + orgFee);
  const spent = cardSpent(db, card.id);
  const pools = poolsOf(db, org);
  if (cardSpendMode(card) === 'prefunded') {
    if (money(spent + cost) > (card.cardLimit ?? 0) + 0.001) return 'card_limit';
    return null;
  }
  if (card.cardLimit != null && money(spent + cost) > card.cardLimit + 0.001) return 'card_limit';
  if (cost > pools.sharedRemaining + 0.001) return 'shared_short';
  return null;
}

export function heldAmount(db: Db, org: Org) {
  return money(db.cards.filter((card) => card.orgId === org.id).reduce((sum, card) => {
    if (cardSpendMode(card) === 'prefunded' && card.status !== 'closed') return sum + (card.cardLimit ?? 0);
    return sum + cardSpent(db, card.id);
  }, 0));
}

export function fundedFloor(db: Db, org: Org) {
  const childLimit = childrenOf(db, org.id).reduce((sum, child) => sum + child.limitBudget, 0);
  return money(childLimit + heldAmount(db, org));
}

export function orgStats(db: Db, org: Org) {
  const children = childrenOf(db, org.id);
  const allocatedCards = children.reduce((sum, child) => sum + child.cardQuota, 0);
  const allocatedLimit = money(children.reduce((sum, child) => sum + child.limitBudget, 0));
  const cardsIssued = issuedCount(db, org.id);
  const limitUsed = usedAmount(db, org.id);
  return {
    ...org,
    ...poolsOf(db, org),
    cardsIssued,
    limitUsed,
    allocatedCards,
    allocatedLimit,
    remainingCards: org.cardQuota - allocatedCards - cardsIssued,
    remainingLimit: money(org.limitBudget - allocatedLimit - heldAmount(db, org)),
  };
}
