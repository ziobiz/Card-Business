import i18n from './i18n';
import { API } from './api';

const KEY = 'cb_session';

export type SessionAccount = {
  id: string;
  role: 'hq' | 'org' | 'user';
  orgId: string;
  name: string;
  email: string;
  orgName: string;
  level: 'hq' | 'large' | 'middle' | 'small';
  staffRole?: 'admin' | 'accountant' | 'general' | 'operator';
  brandName?: string;
  logoUrl?: string;
  loginLogoUrl?: string;
  loginBackgroundUrl?: string;
  faviconUrl?: string;
  siteName?: string;
  footerText?: string;
  accentColor?: string;
  menus?: string[];
};

export function saveToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function apiMessage(code: string | undefined, status: number) {
  if (code && i18n.exists(`api.${code}`)) return i18n.t(`api.${code}`);
  return code || `HTTP ${status}`;
}

export function isAuthError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export async function apiAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) {
    clearToken();
    throw new ApiError(apiMessage(data.error, res.status), res.status);
  }
  if (!res.ok) throw new ApiError(apiMessage(data.error, res.status), res.status);
  return data as T;
}

export function homeFor(role: SessionAccount['role']) {
  if (role === 'user') return '/me';
  return '/admin/dashboard';
}
