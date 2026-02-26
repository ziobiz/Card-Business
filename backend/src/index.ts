import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import cardRoutes from './routes/cards.js';
import walletRoutes from './routes/wallet.js';
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true, mock: config.useMockWirex }));
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/wallet', walletRoutes);

import { store } from './data/store.js';

app.listen(config.port, '127.0.0.1', () => {
  store.loadUsers();
  console.log(`Server running at http://127.0.0.1:${config.port}`);
  console.log(`Wirex: ${config.useMockWirex ? 'MOCK' : 'LIVE'}`);
  console.log(`Users loaded: ${store.users.size}`);
});
