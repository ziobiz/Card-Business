import jwt from 'jsonwebtoken';
import { config } from './config.js';
import type { Role } from './orgStore.js';

export type Actor = { sub: string; role: Role; orgId: string; email: string; purpose?: string };

export function actorOf(req: { header: (name: string) => string | undefined }): Actor | null {
  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret) as Actor;
  } catch {
    return null;
  }
}

export function requireActor(
  req: Parameters<typeof actorOf>[0],
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  const actor = actorOf(req);
  if (!actor || (actor.purpose && actor.purpose !== 'session')) {
    res.status(401).json({ error: 'login_required' });
    return null;
  }
  return actor;
}
