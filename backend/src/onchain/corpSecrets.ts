import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

type SecretBlob = {
  ownerPrivateKeyEnc?: string;
  ownerAddress?: string;
  deployerNote?: string;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '../../data/corp-secrets.json');

function keyBytes() {
  return createHash('sha256').update(config.jwtSecret + ':corp-secrets').digest();
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(blob: string) {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function read(): SecretBlob {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as SecretBlob;
  } catch {
    return {};
  }
}

function write(row: SecretBlob) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(row, null, 2), 'utf8');
}

export function saveOwnerPrivateKey(privateKey: string, address: string) {
  const next = read();
  next.ownerPrivateKeyEnc = encrypt(privateKey);
  next.ownerAddress = address;
  write(next);
}

export function readOwnerPrivateKey(): { privateKey: string; address: string } | null {
  const row = read();
  if (!row.ownerPrivateKeyEnc || !row.ownerAddress) return null;
  return { privateKey: decrypt(row.ownerPrivateKeyEnc), address: row.ownerAddress };
}

export function publicOwnerSecret() {
  const row = read();
  return {
    ownerAddress: row.ownerAddress || null,
    ownerKeyStored: Boolean(row.ownerPrivateKeyEnc),
  };
}
