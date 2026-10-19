export const API = import.meta.env.VITE_API_URL ?? '';

export type Employee = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type CardFormat = 'virtual' | 'plastic';
export type CardStatus = 'not_activated' | 'active' | 'blocked' | 'closed';

export type Card = {
  id: string;
  format: CardFormat;
  name: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  status: CardStatus;
  wirexIssued: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  transactionLimit: number;
  lifetimeLimit: number;
  lifetimeUsed: number;
  lifetimeRemaining: number | null;
  effectiveDailyLimit: number;
  shipping: { country: string; city: string; line1: string; postalCode: string } | null;
  createdAt: string;
};

export class ApiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || `HTTP ${res.status}`);
  return data as T;
}
