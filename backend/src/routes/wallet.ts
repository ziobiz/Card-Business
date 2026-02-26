/**
 * 월렛 API - 스테이블코인(USDT/USDC) 연동
 * Wirex Pay: 프라이머리 월렛 → 카드 월렛 충전
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { mockWirex } from '../services/wirex/mockWirex.js';

const router = Router();
router.use(requireAuth);

router.get('/balance', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.json({ primary: [], cardSummaries: [] });
    }
    const primary = await mockWirex.getPrimaryWalletBalance(user.wirexUserId);
    const cardsResult = await mockWirex.getCards(user.wirexUserId, 1, 100);
    const cardSummaries = await Promise.all(
      cardsResult.items.map(async (c) => {
        const w = await mockWirex.getCardWallet(c.id);
        return w ? { cardId: c.id, panLast4: c.panLast4, balance: w.balance, currency: w.currency } : null;
      })
    );
    res.json({ primary, cardSummaries: cardSummaries.filter(Boolean) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/tokens', (_, res) => {
  res.json({ tokens: mockWirex.getSupportedTokens() });
});

router.get('/card/:cardId/deposit-info', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const info = await mockWirex.getCardWallet(req.params.cardId);
    if (!info) {
      return res.status(404).json({ error: 'Card not found' });
    }
    const cardsResult = await mockWirex.getCards(user.wirexUserId, 1, 100);
    const owned = cardsResult.items.some((c) => c.id === req.params.cardId);
    if (!owned) {
      return res.status(403).json({ error: 'Not your card' });
    }
    res.json({
      cardWalletAddress: info.address,
      currentBalance: info.balance,
      currency: info.currency,
      network: 'Base Sepolia',
      supportedTokens: mockWirex.getSupportedTokens(),
      note: '실제 환경에서는 프라이머리 월렛에서 이 주소로 USDT/USDC를 온체인 전송하세요.',
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/card/:cardId/deposit', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const cardsResult = await mockWirex.getCards(user.wirexUserId, 1, 100);
    const owned = cardsResult.items.some((c) => c.id === req.params.cardId);
    if (!owned) {
      return res.status(403).json({ error: 'Not your card' });
    }
    const { amount, token } = req.body;
    const amt = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const result = await mockWirex.depositToCard(req.params.cardId, amt, token || 'USDT');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
