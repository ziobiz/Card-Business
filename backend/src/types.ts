/**
 * Wirex API 스펙 기반 타입 정의
 * 참조: https://partner.wirexpaychain.com/
 */

export interface WirexUser {
  id: string;
  email: string;
  phone?: string;
  status: 'pending' | 'verified' | 'blocked';
  primaryWalletAddress?: string;  // AA 지갑 주소 (스테이블코인 보유)
  createdAt: string;
}

/** 한도 유형: 일일(매일 리셋) | 라이프(할당액 소진 시까지) */
export type CardLimitType = 'daily' | 'lifetime';

export interface WirexCard {
  id: string;
  userId: string;
  type: 'virtual' | 'plastic';
  status: 'inactive' | 'active' | 'blocked' | 'closed';
  panLast4: string;
  expiryMonth: string;
  expiryYear: string;
  /** @deprecated legacy - use dailyLimit/lifetimeLimit */
  limit?: number;
  limitType?: CardLimitType;
  /** 일일 한도 (매일 00:00 리셋) */
  dailyLimit?: number;
  /** 일일 사용액 (당일 기준) */
  dailyUsed?: number;
  /** 일일 사용액 리셋 일자 (YYYY-MM-DD) */
  dailyUsedResetAt?: string;
  /** 라이프 한도 (할당 시 소진될 때까지 사용 가능) */
  lifetimeLimit?: number;
  /** 라이프 사용액 (누적) */
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

export interface CreateUserRequest {
  email: string;
  phone?: string;
}

export interface CreateVirtualCardRequest {
  limit?: number;
  currency?: string;
}

export interface CreatePlasticCardRequest {
  limit?: number;
  currency?: string;
}

/** 카드 생성 시 한도 미설정 가능. 생성 후 한도 부여 */
export interface CreateCardRequest {
  type: 'virtual' | 'plastic';
  currency?: string;
}

export interface SetCardLimitRequest {
  limit: number;
  /** 일일 한도 | 라이프 한도 */
  limitType?: 'daily' | 'lifetime';
}

export interface ActivateCardRequest {
  last4?: string;
}
