import { createHmac, randomBytes } from 'crypto';

const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPH[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(secret: string): Buffer {
  const s = secret.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const idx = ALPH.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = createHmac('sha1', fromBase32(secret)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[off] & 0x7f) << 24) | (hmac[off + 1] << 16) | (hmac[off + 2] << 8) | hmac[off + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export function generateOtpSecret(): string {
  return toBase32(randomBytes(20));
}

export function verifyTotp(secret: string, code: string): boolean {
  const n = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(n) || !secret) return false;
  const t = Math.floor(Date.now() / 1000 / 30);
  return [t - 1, t, t + 1].some((c) => hotp(secret, c) === n);
}

export function otpAuthUrl(email: string, secret: string, issuer = 'ICOCARD'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}
