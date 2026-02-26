/**
 * Mock Wirex API - API 문서 스펙 기반 시뮬레이션
 * 스테이블코인(USDT/USDC) 월렛 연동 구조 반영
 * 실제 credential 확보 시 realWirex.ts로 교체
 */

import { v4 as randomUUID } from 'uuid';
import type {
  WirexUser,
  WirexCard,
  CreateUserRequest,
  CreateVirtualCardRequest,
  CreatePlasticCardRequest,
  SetCardLimitRequest,
  TokenBalance,
} from '../../types.js';

// 인메모리 저장소
const users = new Map<string, WirexUser>();
const cards = new Map<string, WirexCard>();
const cardBalances = new Map<string, number>();  // cardId -> balance (USD)

function genAddr(): string {
  return '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generatePanLast4(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateExpiry(): { month: string; year: string } {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: String(now.getFullYear() + 4).slice(-2),
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function maybeResetDailyUsed(card: WirexCard): void {
  if (card.limitType !== 'daily' || !card.dailyUsedResetAt) return;
  const now = today();
  if (card.dailyUsedResetAt !== now) {
    card.dailyUsed = 0;
    card.dailyUsedResetAt = now;
  }
}

/** Wirex BaaS Unified Balance: WUSD, WEUR (docs.wirexapp.com) */
const UNIFIED_TOKENS: Record<string, { name: string; decimals: number }> = {
  WUSD: { name: 'Unified USD', decimals: 18 },
  WEUR: { name: 'Unified EUR', decimals: 18 },
};

export const mockWirex = {
  async createUser(data: CreateUserRequest): Promise<WirexUser> {
    const id = randomUUID();
    const user: WirexUser = {
      id,
      email: data.email,
      phone: data.phone,
      status: 'pending',
      primaryWalletAddress: genAddr(),
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);
    return user;
  },

  async getUser(userId: string): Promise<WirexUser | null> {
    return users.get(userId) ?? null;
  },

  async getCards(userId: string, page = 1, size = 10): Promise<{ items: WirexCard[]; total: number }> {
    const all = Array.from(cards.values()).filter((c) => c.userId === userId);
    const total = all.length;
    const items = all.slice((page - 1) * size, page * size).map((c) => {
      const card = { ...c, balance: cardBalances.get(c.id) ?? c.balance ?? 0 };
      maybeResetDailyUsed(card);
      return card;
    });
    return { items, total };
  },

  async createVirtualCard(userId: string, data?: CreateVirtualCardRequest): Promise<WirexCard> {
    const id = randomUUID();
    const { month, year } = generateExpiry();
    const cardWalletAddress = genAddr();
    const card: WirexCard = {
      id,
      userId,
      type: 'virtual',
      status: 'active',
      panLast4: generatePanLast4(),
      expiryMonth: month,
      expiryYear: year,
      currency: data?.currency ?? 'USD',
      cardWalletAddress,
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    if (data?.limit != null) {
      card.limitType = 'daily';
      card.dailyLimit = data.limit;
      card.dailyUsed = 0;
      card.dailyUsedResetAt = today();
    }
    cards.set(id, card);
    cardBalances.set(id, 0);
    return card;
  },

  async createPlasticCard(userId: string, data?: CreatePlasticCardRequest): Promise<WirexCard> {
    const id = randomUUID();
    const { month, year } = generateExpiry();
    const cardWalletAddress = genAddr();
    const card: WirexCard = {
      id,
      userId,
      type: 'plastic',
      status: 'inactive',
      panLast4: '-',
      expiryMonth: month,
      expiryYear: year,
      currency: data?.currency ?? 'USD',
      cardWalletAddress,
      balance: 0,
      createdAt: new Date().toISOString(),
    };
    if (data?.limit != null) {
      card.limitType = 'daily';
      card.dailyLimit = data.limit;
      card.dailyUsed = 0;
      card.dailyUsedResetAt = today();
    }
    cards.set(id, card);
    cardBalances.set(id, 0);
    return card;
  },

  async activateCard(cardId: string, _data?: { last4?: string }): Promise<WirexCard> {
    const card = cards.get(cardId);
    if (!card) throw new Error('Card not found');
    card.status = 'active';
    return card;
  },

  async blockCard(cardId: string): Promise<WirexCard> {
    const card = cards.get(cardId);
    if (!card) throw new Error('Card not found');
    card.status = 'blocked';
    return card;
  },

  async unblockCard(cardId: string): Promise<WirexCard> {
    const card = cards.get(cardId);
    if (!card) throw new Error('Card not found');
    card.status = 'active';
    return card;
  },

  async closeCard(cardId: string): Promise<WirexCard> {
    const card = cards.get(cardId);
    if (!card) throw new Error('Card not found');
    card.status = 'closed';
    return card;
  },

  async setCardLimit(cardId: string, data: SetCardLimitRequest): Promise<WirexCard> {
    const card = cards.get(cardId);
    if (!card) throw new Error('Card not found');
    const limitType = data.limitType ?? 'daily';
    card.limitType = limitType;
    if (limitType === 'daily') {
      card.dailyLimit = data.limit;
      card.dailyUsed = card.dailyUsed ?? 0;
      card.dailyUsedResetAt = card.dailyUsedResetAt ?? today();
      card.limit = data.limit;
    } else {
      card.lifetimeLimit = data.limit;
      card.lifetimeUsed = card.lifetimeUsed ?? 0;
      card.limit = data.limit;
    }
    return card;
  },

  /** 라이프 한도 카드 사용 시뮬레이션 (테스트용) */
  async recordCardSpend(cardId: string, amount: number): Promise<WirexCard> {
    const card = cards.get(cardId);
    if (!card) throw new Error('Card not found');
    if (card.limitType === 'daily') {
      maybeResetDailyUsed(card);
      const used = (card.dailyUsed ?? 0) + amount;
      if (amount > 0 && (card.dailyLimit ?? 0) < used) {
        throw new Error('Daily limit exceeded');
      }
      card.dailyUsed = used;
    } else {
      const used = (card.lifetimeUsed ?? 0) + amount;
      if (amount > 0 && (card.lifetimeLimit ?? 0) < used) {
        throw new Error('Lifetime limit exceeded');
      }
      card.lifetimeUsed = used;
    }
    return card;
  },

  // --- Wallet (Wirex BaaS Unified Balance: WUSD, WEUR) ---
  async getPrimaryWalletBalance(userId: string): Promise<TokenBalance[]> {
    const user = users.get(userId);
    if (!user) return [];
    const seed = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return [
      { symbol: 'WUSD', name: 'Unified USD', balance: 1000 + (seed % 5000), decimals: 18 },
      { symbol: 'WEUR', name: 'Unified EUR', balance: 200 + (seed % 500), decimals: 18 },
    ];
  },

  async getCardWallet(cardId: string): Promise<{ address: string; balance: number; currency: string } | null> {
    const card = cards.get(cardId);
    if (!card || !card.cardWalletAddress) return null;
    const balance = cardBalances.get(cardId) ?? card.balance ?? 0;
    return {
      address: card.cardWalletAddress,
      balance,
      currency: card.currency,
    };
  },

  async depositToCard(cardId: string, amountUsd: number, _tokenSymbol?: string): Promise<{ success: boolean; newBalance: number }> {
    const card = cards.get(cardId);
    if (!card) throw new Error('Card not found');
    const prev = cardBalances.get(cardId) ?? 0;
    const newBalance = prev + amountUsd;
    cardBalances.set(cardId, newBalance);
    card.balance = newBalance;
    return { success: true, newBalance };
  },

  getSupportedTokens(): { symbol: string; name: string; decimals: number }[] {
    return Object.entries(UNIFIED_TOKENS).map(([symbol, { name, decimals }]) => ({
      symbol,
      name,
      decimals,
    }));
  },
};
