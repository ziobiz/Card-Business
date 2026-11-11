import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchCorp } from '../corpStore.js';

const router = Router();
const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../data');
const logFile = path.join(dataDir, 'webhooks.jsonl');

const TOPICS = [
  'corporations',
  'wallets',
  'balances',
  'cards',
  'card-limits',
  '3ds',
  'activities',
  'recipients',
  'erc-withdrawals',
] as const;

function appendLog(topic: string, req: { ip?: string; headers: Record<string, unknown>; body: unknown }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const row = {
    at: new Date().toISOString(),
    topic,
    ip: req.ip || '',
    contentType: req.headers['content-type'] || '',
    body: req.body,
  };
  fs.appendFileSync(logFile, `${JSON.stringify(row)}\n`, 'utf8');
}

router.get('/_recent', (_req, res) => {
  try {
    if (!fs.existsSync(logFile)) return res.json({ items: [], file: logFile });
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const items = lines.slice(-50).map((line) => JSON.parse(line) as unknown).reverse();
    res.json({ items, count: lines.length });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

for (const topic of TOPICS) {
  router.post(`/${topic}`, (req, res) => {
    try {
      appendLog(topic, {
        ip: req.ip,
        headers: req.headers as Record<string, unknown>,
        body: req.body,
      });
      if (topic === 'corporations' && req.body && typeof req.body === 'object') {
        const body = req.body as { verification_status?: string; corporation_address?: string };
        patchCorp({
          lastWebhookAt: new Date().toISOString(),
          ...(body.verification_status ? { verificationStatus: body.verification_status } : {}),
          ...(body.corporation_address ? { corporationAddress: body.corporation_address } : {}),
        });
      } else if (topic === 'cards' || topic === 'card-limits' || topic === 'activities') {
        patchCorp({ lastWebhookAt: new Date().toISOString() });
      }
      console.log(`[webhook] ${topic}`, typeof req.body === 'object' ? JSON.stringify(req.body).slice(0, 300) : req.body);
      res.status(200).json({ ok: true, topic });
    } catch (e) {
      console.error(`[webhook] ${topic} failed`, e);
      res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });
}

export default router;
