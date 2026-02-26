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
      return res.json({ id: user?.id, email: user?.email, wirexUserId: null });
    }
    const wirexUser = await mockWirex.getUser(user.wirexUserId);
    res.json({
      id: user.id,
      email: user.email,
      wirexUserId: user.wirexUserId,
      status: wirexUser?.status ?? 'pending',
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
