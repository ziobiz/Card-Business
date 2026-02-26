/**
 * Wirex Pay API 호출 샘플
 * JWT 발급 후 사용자 헤더와 함께 호출
 */

const WIREX_API_URL = process.env.WIREX_API_URL || 'https://api-business.wirexpaychain.tech';

type UserIdentifier = 
  | { 'X-User-Id': string }
  | { 'X-User-Email': string }
  | { 'X-User-Wallet': string };

async function wirexRequest<T>(
  token: string,
  path: string,
  options: RequestInit & { user?: UserIdentifier } = {}
): Promise<T> {
  const { user, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(user || {}),
  };

  const response = await fetch(`${WIREX_API_URL}${path}`, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string>) },
  });

  if (!response.ok) {
    throw new Error(`Wirex API error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

/** 사용자 생성 */
export async function createUser(token: string, userData: Record<string, unknown>) {
  return wirexRequest(token, '/api/v1/user', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

/** 카드 목록 조회 */
export async function getCards(token: string, userId: string, page = 1, size = 10) {
  return wirexRequest(token, `/api/v1/cards?page=${page}&size=${size}`, {
    method: 'GET',
    user: { 'X-User-Id': userId },
  });
}

/** 가상 카드 발급 */
export async function createVirtualCard(token: string, userId: string) {
  return wirexRequest(token, '/api/v1/cards/virtual', {
    method: 'POST',
    user: { 'X-User-Id': userId },
  });
}

/** 카드 한도 설정 */
export async function setCardLimit(
  token: string,
  userId: string,
  cardId: string,
  limit: number
) {
  return wirexRequest(token, `/api/v1/cards/${cardId}/limit`, {
    method: 'PUT',
    user: { 'X-User-Id': userId },
    body: JSON.stringify({ limit }),
  });
}
