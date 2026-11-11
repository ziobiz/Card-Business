/**
 * Wirex Corporate API client.
 * Sandbox host: https://api-business.wirexapp.tech
 * Retail host api-baas.wirexapp.* 는 사용하지 않는다.
 */

import { config, wirexCorporate } from '../config.js';
import { patchCorp, readCorp } from '../corpStore.js';

type TokenResponse = {
  access_token?: string;
  expires_at?: number;
  expires_in?: number;
  error?: string;
  error_description?: string;
  error_reason?: string;
  message?: string;
};

export type CorporateConfigSummary = {
  chainId?: number;
  chainName?: string;
  apiUrl?: string;
};

export class WirexError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'WirexError';
    this.status = status;
    this.body = body;
  }
}

function base() {
  return wirexCorporate.apiBase.replace(/\/$/, '');
}

function errMsg(data: TokenResponse & Record<string, unknown>, status: number) {
  return String(data.error_description || data.message || data.error_reason || data.error || `wirex ${status}`);
}

export async function fetchCorporateConfig(): Promise<CorporateConfigSummary> {
  const res = await fetch(`${base()}/api/v1/config`);
  const data = (await res.json().catch(() => ({}))) as {
    api?: { apiUrl?: string };
    defaultChain?: { id?: number; name?: string };
  };
  if (!res.ok) throw new Error(`config ${res.status}`);
  return {
    chainId: data.defaultChain?.id,
    chainName: data.defaultChain?.name,
    apiUrl: data.api?.apiUrl,
  };
}

export async function fetchPartnerToken(): Promise<{ ok: true; preview: string } | { ok: false; error: string }> {
  try {
    const token = await getPartnerToken();
    return { ok: true, preview: `${token.slice(0, 12)}…` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'token_failed' };
  }
}

export async function getPartnerToken(force = false): Promise<string> {
  if (!wirexCorporate.clientId || !wirexCorporate.clientSecret) {
    throw new Error('WIREX_CLIENT_ID / WIREX_CLIENT_SECRET 가 없습니다. Corporate 키를 넣으세요.');
  }
  if (config.useMockWirex) {
    const fake = 'mock-partner-token';
    patchCorp({ partnerToken: fake, partnerExpiresAt: Math.floor(Date.now() / 1000) + 3600 });
    return fake;
  }
  const saved = readCorp();
  const now = Math.floor(Date.now() / 1000);
  if (!force && saved.partnerToken && (saved.partnerExpiresAt || 0) > now + 120) {
    return saved.partnerToken;
  }
  const res = await fetch(`${base()}/api/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: wirexCorporate.clientId,
      client_secret: wirexCorporate.clientSecret,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new WirexError(errMsg(data, res.status), res.status, data);
  }
  const expiresAt = data.expires_at || now + (data.expires_in || 172800);
  patchCorp({ partnerToken: data.access_token, partnerExpiresAt: expiresAt, lastError: '' });
  return data.access_token;
}

async function wirexFetch(path: string, init: RequestInit & { token?: string; identity?: { wallet: string; email: string; chainId?: number } } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.identity) {
    headers['X-User-Wallet'] = init.identity.wallet;
    headers['X-User-Email'] = init.identity.email;
    headers['X-Chain-Id'] = String(init.identity.chainId || wirexCorporate.chainId);
  }
  const res = await fetch(`${base()}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const row = data as TokenResponse & Record<string, unknown>;
    throw new WirexError(errMsg(row, res.status), res.status, data);
  }
  return data;
}

export async function registerCorporation(input: {
  corporationAddress: string;
  corporationName: string;
  registrationNumber: string;
  registrationCountry: string;
  ownerWallet: string;
  ownerEmail: string;
  chainId?: number;
}) {
  if (config.useMockWirex) {
    patchCorp({
      registeredAt: new Date().toISOString(),
      corporationAddress: input.corporationAddress,
      corporationName: input.corporationName,
      registrationNumber: input.registrationNumber,
      registrationCountry: input.registrationCountry,
      ownerWallet: input.ownerWallet,
      ownerEmail: input.ownerEmail,
      lastError: '',
    });
    return {};
  }
  const partner = await getPartnerToken();
  return wirexFetch('/api/v1/corporations/register', {
    method: 'POST',
    token: partner,
    identity: {
      wallet: input.ownerWallet,
      email: input.ownerEmail,
      chainId: input.chainId || wirexCorporate.chainId,
    },
    body: JSON.stringify({
      corporation_address: input.corporationAddress,
      corporation_name: input.corporationName,
      corporation_registration_number: input.registrationNumber,
      corporation_registration_country: input.registrationCountry,
    }),
  });
}

function decodeExp(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as {
      exp?: number;
      corporation_id?: string;
      employee_id?: string;
      role?: string;
    };
    return payload.exp || Math.floor(Date.now() / 1000) + 3600;
  } catch {
    return Math.floor(Date.now() / 1000) + 3600;
  }
}

function decodeClaims(token: string) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as {
      exp?: number;
      corporation_id?: string;
      employee_id?: string;
      role?: string;
    };
  } catch {
    return {};
  }
}

export async function loginCorporation(input: {
  corporationAddress: string;
  ownerWallet: string;
  ownerEmail: string;
  chainId?: number;
}) {
  if (config.useMockWirex) {
    const token = 'mock-corporation-token';
    const exp = Math.floor(Date.now() / 1000) + 3600;
    patchCorp({
      corporationToken: token,
      corporationTokenExp: exp,
      corporationAddress: input.corporationAddress,
      ownerWallet: input.ownerWallet,
      ownerEmail: input.ownerEmail,
      corporationId: 'mock-corp-id',
      employeeId: 'mock-employee-id',
      role: 'Owner',
      lastLoginAt: new Date().toISOString(),
      lastError: '',
    });
    return { access_token: token };
  }
  const partner = await getPartnerToken();
  const data = (await wirexFetch('/api/v1/corporations/login', {
    method: 'POST',
    token: partner,
    identity: {
      wallet: input.ownerWallet,
      email: input.ownerEmail,
      chainId: input.chainId || wirexCorporate.chainId,
    },
    body: JSON.stringify({ corporation_address: input.corporationAddress }),
  })) as { access_token?: string };
  if (!data.access_token) throw new Error('corporation_token_missing');
  const claims = decodeClaims(data.access_token);
  patchCorp({
    corporationToken: data.access_token,
    corporationTokenExp: claims.exp || decodeExp(data.access_token),
    corporationId: claims.corporation_id || '',
    employeeId: claims.employee_id || '',
    role: claims.role || '',
    lastLoginAt: new Date().toISOString(),
    lastError: '',
  });
  return data;
}

export async function getCorporationToken(force = false): Promise<string> {
  const saved = readCorp();
  const now = Math.floor(Date.now() / 1000);
  if (!force && saved.corporationToken && (saved.corporationTokenExp || 0) > now + 120) {
    return saved.corporationToken;
  }
  if (!saved.corporationAddress || !saved.ownerWallet || !saved.ownerEmail) {
    throw new Error('corporation_profile_incomplete');
  }
  const data = await loginCorporation({
    corporationAddress: saved.corporationAddress,
    ownerWallet: saved.ownerWallet,
    ownerEmail: saved.ownerEmail,
    chainId: saved.chainId || wirexCorporate.chainId,
  });
  return data.access_token as string;
}

export async function corpGet(path: string) {
  if (config.useMockWirex) return mockGet(path);
  const token = await getCorporationToken();
  return wirexFetch(path, { method: 'GET', token });
}

export async function corpPost(path: string, body?: unknown) {
  if (config.useMockWirex) return mockPost(path, body);
  const token = await getCorporationToken();
  return wirexFetch(path, { method: 'POST', token, body: body === undefined ? undefined : JSON.stringify(body) });
}

export async function corpPut(path: string, body?: unknown) {
  if (config.useMockWirex) return mockPut(path, body);
  const token = await getCorporationToken();
  return wirexFetch(path, { method: 'PUT', token, body: body === undefined ? undefined : JSON.stringify(body) });
}

function mockGet(path: string) {
  const corp = readCorp();
  if (path.startsWith('/api/v1/corporations') && !path.includes('level-token')) {
    return {
      corporation_address: corp.corporationAddress || '0x0000000000000000000000000000000000000001',
      corporation_name: corp.corporationName || 'Mock Corp',
      verification_status: corp.verificationStatus || 'None',
      verification_levels: [{ level: 'SDD', status: corp.verificationStatus || 'None' }],
      capabilities: [
        { type: 'VisaVirtualCard', status: 'Active', verification_requirements: [{ type: 'SDD', order: 1 }] },
        { type: 'VisaPlasticCard', status: 'NotFulfilled', verification_requirements: [{ type: 'SDD', order: 1 }] },
      ],
      profile_status: 'Active',
    };
  }
  if (path.startsWith('/api/v1/employees')) {
    return {
      employees: [
        {
          id: corp.employeeId || 'mock-employee-id',
          email: corp.ownerEmail || 'owner@example.com',
          first_name: 'Owner',
          last_name: 'User',
          phone: '+821000000000',
          status: 'Active',
          role_id: 'ed7a5845-8727-4b06-9ba0-7d43ddc9e6aa',
        },
      ],
    };
  }
  if (path.startsWith('/api/v1/roles')) {
    return {
      roles: [
        { id: 'ed7a5845-8727-4b06-9ba0-7d43ddc9e6aa', name: 'Owner' },
        { id: '7386b48f-df9c-49fe-8ccc-38b5b0b55932', name: 'Employee' },
      ],
    };
  }
  if (path.startsWith('/api/v1/cards') || path.startsWith('/api/v3/cards')) {
    return {
      data: [
        {
          id: 'mock-card-1',
          status: 'Active',
          card_data: { card_name: 'Mock Virtual', card_number_last_4: '4242', type: 'Virtual' },
          employee_id: corp.employeeId || 'mock-employee-id',
          limit: { daily_limit: 1000, monthly_limit: 10000, transaction_limit: 500, daily_usage: 0, monthly_usage: 0, currency: 'USD' },
          allowed_actions: ['Block', 'Close', 'SetLimit'],
        },
      ],
    };
  }
  if (path.startsWith('/api/v1/activities')) {
    return { data: [] };
  }
  return {};
}

function mockPost(path: string, body?: unknown) {
  if (path.includes('level-token') || path.includes('verification-token')) {
    return { token: 'mock-sumsub-sdk-token' };
  }
  if (path.includes('employees/invite')) {
    return {};
  }
  if (path.includes('/cards/virtual') || path.includes('/cards/plastic')) {
    return { id: `mock-card-${Date.now()}`, ...(typeof body === 'object' ? body : {}) };
  }
  return {};
}

function mockPut(_path: string, _body?: unknown) {
  return {};
}
