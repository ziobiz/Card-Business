import 'dotenv/config';

/** Wirex BaaS API (docs.wirexapp.com) */
export const wirexBaaS = {
  apiBase: process.env.WIREX_BAAS_URL ?? 'https://api-baas.wirexapp.tech',
  chainId: parseInt(process.env.WIREX_CHAIN_ID ?? '84532', 10), // Base Sepolia
  clientId: process.env.WIREX_CLIENT_ID ?? '',
  clientSecret: process.env.WIREX_CLIENT_SECRET ?? '',
};

export const config = {
  port: parseInt(process.env.PORT ?? '3002', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  useMockWirex: process.env.USE_MOCK_WIREX !== 'false', // 기본값 true (Mock 사용)
};
