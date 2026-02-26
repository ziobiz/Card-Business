/**
 * 백엔드 API 클라이언트
 * Wirex API 스펙 기반
 */

// 직접 연결 (프록시 미사용) - dev: 127.0.0.1:3001, prod: VITE_API_URL
const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

const REQUEST_TIMEOUT = 15000;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const base = API || '';
  const url = base ? `${base}/api${path}` : `/api${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg = data.hint ? `${data.error} (${data.hint})` : data.error || `HTTP ${res.status}`;
      if (data._debug) msg += ` [받은이메일:${data._debug.receivedEmail}, 사용자수:${data._debug.usersCount}]`;
      throw new Error(msg);
    }
    return data as T;
  } catch (e) {
    clearTimeout(timeoutId);
    if ((e as Error).name === 'AbortError') {
      throw new Error('요청 시간 초과. 백엔드가 실행 중인지 확인해 주세요.');
    }
    throw e;
  }
}

export interface User {
  id: string;
  email: string;
  wirexUserId?: string;
}

export type CardLimitType = 'daily' | 'lifetime';

export interface Card {
  id: string;
  userId: string;
  type: 'virtual' | 'plastic';
  status: 'inactive' | 'active' | 'blocked' | 'closed';
  panLast4: string;
  expiryMonth: string;
  expiryYear: string;
  limit?: number;
  limitType?: CardLimitType;
  dailyLimit?: number;
  dailyUsed?: number;
  dailyUsedResetAt?: string;
  lifetimeLimit?: number;
  lifetimeUsed?: number;
  currency: string;
  cardWalletAddress?: string;
  balance?: number;
  createdAt: string;
}

export interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
}

export interface WalletBalance {
  primary: TokenBalance[];
  cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },
  user: {
    get: () => request<User & { status?: string }>('/user'),
  },
  cards: {
    list: (page = 1, size = 10) =>
      request<{ items: Card[]; total: number }>(`/cards?page=${page}&size=${size}`),
    createVirtual: (data?: { limit?: number; currency?: string }) =>
      request<Card>('/cards/virtual', {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    createPlastic: (data?: { limit?: number; currency?: string }) =>
      request<Card>('/cards/plastic', {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }),
    block: (cardId: string) =>
      request<Card>(`/cards/${cardId}/block`, { method: 'PUT' }),
    unblock: (cardId: string) =>
      request<Card>(`/cards/${cardId}/unblock`, { method: 'PUT' }),
    setLimit: (cardId: string, limit: number, limitType?: CardLimitType) =>
      request<Card>(`/cards/${cardId}/limit`, {
        method: 'PUT',
        body: JSON.stringify({ limit, limitType: limitType ?? 'daily' }),
      }),
    simulateSpend: (cardId: string, amount: number) =>
      request<Card>(`/cards/${cardId}/simulate-spend`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    close: (cardId: string) =>
      request<Card>(`/cards/${cardId}/close`, { method: 'PUT' }),
  },
  wallet: {
    getBalance: () => request<WalletBalance>('/wallet/balance'),
    getTokens: () => request<{ tokens: { symbol: string; name: string; decimals: number }[] }>('/wallet/tokens'),
    getCardDepositInfo: (cardId: string) =>
      request<{
        cardWalletAddress: string;
        currentBalance: number;
        currency: string;
        network: string;
        supportedTokens: { symbol: string; name: string; decimals: number }[];
        note: string;
      }>(`/wallet/card/${cardId}/deposit-info`),
    depositToCard: (cardId: string, amount: number, token?: string) =>
      request<{ success: boolean; newBalance: number }>(`/wallet/card/${cardId}/deposit`, {
        method: 'POST',
        body: JSON.stringify({ amount, token: token || 'USDT' }),
      }),
  },
};
