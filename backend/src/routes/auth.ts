import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { config } from '../config.js';
import { store } from '../data/store.js';
import { mockWirex } from '../services/wirex/mockWirex.js';

const router = Router();

function hashPassword(password: string): string {
  return createHash('sha256').update(password + config.jwtSecret).digest('hex');
}

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    store.loadUsers();
    if (store.getUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const wirexUser = await mockWirex.createUser({ email });
    const id = uuidv4();
    const appUser = {
      id,
      email,
      passwordHash: hashPassword(password),
      wirexUserId: wirexUser.id,
      createdAt: new Date().toISOString(),
    };
    store.addUser(appUser);

    const token = jwt.sign({ userId: id, email }, config.jwtSecret, { expiresIn: '7d' });
    res.json({ token, user: { id, email, wirexUserId: wirexUser.id } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/login', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  store.loadUsers();
  const user = store.getUserByEmail(email);
  // 디버그: store 상태 로그
  console.log('[LOGIN] email:', JSON.stringify(email), 'user found:', !!user, 'store size:', store.users.size);
  if (!user) {
    return res.status(401).json({
      error: 'Invalid credentials',
      hint: '회원가입을 먼저 해주세요. / Please register first.',
      _debug: { receivedEmail: email, usersCount: store.users.size },
    });
  }
  if (user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials', hint: '비밀번호를 확인해주세요.' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, wirexUserId: user.wirexUserId } });
});

export default router;
