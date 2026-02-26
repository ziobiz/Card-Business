/**
 * Wirex Pay JWT 토큰 발급 샘플
 * 파트너 승인 후 client_id, client_secret으로 사용
 */

const WIREX_AUTH_URL = process.env.WIREX_AUTH_URL || 'https://wirex-pay-dev.eu.auth0.com/oauth/token';
const WIREX_CLIENT_ID = process.env.WIREX_CLIENT_ID;
const WIREX_CLIENT_SECRET = process.env.WIREX_CLIENT_SECRET;
const WIREX_AUDIENCE = process.env.WIREX_AUDIENCE || 'https://api-business.wirexpaychain.tech';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function getWirexAccessToken(): Promise<string> {
  const response = await fetch(WIREX_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: WIREX_CLIENT_ID,
      client_secret: WIREX_CLIENT_SECRET,
      audience: WIREX_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error(`Wirex auth failed: ${response.status} ${await response.text()}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

// 사용 예시 (백엔드에서)
// const token = await getWirexAccessToken();
// fetch('https://api-business.wirexpaychain.tech/api/v1/user', {
//   headers: { 'Authorization': `Bearer ${token}` }
// });
