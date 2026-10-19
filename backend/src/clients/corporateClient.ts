/**
 * Wirex Corporate API client.
 * Sandbox host: https://api-business.wirexapp.tech
 * Retail host api-baas.wirexapp.* 는 사용하지 않는다.
 */

import { wirexCorporate } from '../config.js';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  message?: string;
};

export async function fetchCorporateConfig(): Promise<unknown> {
  const res = await fetch(`${wirexCorporate.apiBase}/api/v1/config`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`config ${res.status}`);
  }
  return data;
}

export async function fetchPartnerToken(): Promise<{ ok: true; preview: string } | { ok: false; error: string }> {
  if (!wirexCorporate.clientId || !wirexCorporate.clientSecret) {
    return { ok: false, error: 'WIREX_CLIENT_ID / WIREX_CLIENT_SECRET 가 없습니다. Corporate 키를 넣으세요.' };
  }
  const res = await fetch(`${wirexCorporate.apiBase}/api/v1/token`, {
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
    const msg = data.error_description || data.message || data.error || `token ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true, preview: `${data.access_token.slice(0, 12)}…` };
}
