import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { store } from '../data/store.js';
import { mockWirex } from '../services/wirex/mockWirex.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.json({ items: [], total: 0 });
    }
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 10;
    const result = await mockWirex.getCards(user.wirexUserId, page, size);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/virtual', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const card = await mockWirex.createVirtualCard(user.wirexUserId, req.body);
    res.status(201).json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/plastic', async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const user = store.getUserById(userId);
    if (!user?.wirexUserId) {
      return res.status(400).json({ error: 'Wirex user not found' });
    }
    const card = await mockWirex.createPlasticCard(user.wirexUserId, req.body);
    res.status(201).json(card);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/activate', async (req, res) => {
  try {
    const card = await mockWirex.activateCard(req.params.cardId, req.body);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/block', async (req, res) => {
  try {
    const card = await mockWirex.blockCard(req.params.cardId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/unblock', async (req, res) => {
  try {
    const card = await mockWirex.unblockCard(req.params.cardId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/limit', async (req, res) => {
  try {
    const { limit, limitType } = req.body;
    if (typeof limit !== 'number' && typeof limit !== 'string') {
      return res.status(400).json({ error: 'limit required' });
    }
    const card = await mockWirex.setCardLimit(req.params.cardId, {
      limit: Number(limit),
      limitType: limitType === 'lifetime' ? 'lifetime' : 'daily',
    });
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

router.post('/:cardId/simulate-spend', async (req, res) => {
  try {
    const amount = Number(req.body.amount ?? 0);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount required (positive number)' });
    }
    const card = await mockWirex.recordCardSpend(req.params.cardId, amount);
    res.json(card);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.put('/:cardId/close', async (req, res) => {
  try {
    const card = await mockWirex.closeCard(req.params.cardId);
    res.json(card);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

export default router;
