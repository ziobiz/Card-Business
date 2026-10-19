import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config();

/**
 * Wirex Corporate API. Retail(api-baas) 키가 아니다.
 * https://docs.wirexapp.com/docs/corporate-getting-started
 */
export const wirexCorporate = {
  apiBase: process.env.WIREX_CORPORATE_URL ?? process.env.WIREX_BAAS_URL ?? 'https://api-business.wirexapp.tech',
  chainId: parseInt(process.env.WIREX_CHAIN_ID ?? '84532', 10),
  clientId: process.env.WIREX_CLIENT_ID ?? '',
  clientSecret: process.env.WIREX_CLIENT_SECRET ?? '',
  partnerId: process.env.WIREX_PARTNER_ID ?? '',
};

/** @deprecated wirexCorporate 를 사용할 것 */
export const wirexBaaS = wirexCorporate;

export const config = {
  port: parseInt(process.env.PORT ?? '3002', 10),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  useMockWirex: process.env.USE_MOCK_WIREX !== 'false', // 기본값 true (Mock 사용)
  /** 개발이 끝날 때까지 기본 중지. 다시 켤 때 OTP_ENABLED=true */
  otpEnabled: process.env.OTP_ENABLED === 'true',
};
