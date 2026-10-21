import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const brandDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/brand');

export const brandKinds = {
  background: { field: 'loginBackgroundUrl', max: 5 * 1024 * 1024 },
  loginLogo: { field: 'loginLogoUrl', max: 1024 * 1024 },
  logo: { field: 'logoUrl', max: 1024 * 1024 },
  favicon: { field: 'faviconUrl', max: 1024 * 1024 },
} as const;

export type BrandKind = keyof typeof brandKinds;

const types: Record<string, { ext: string; test: (bytes: Buffer) => boolean }> = {
  png: { ext: 'png', test: (bytes) => bytes.subarray(0, 4).toString('hex') === '89504e47' },
  jpg: { ext: 'jpg', test: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  gif: { ext: 'gif', test: (bytes) => bytes.subarray(0, 3).toString() === 'GIF' },
  webp: { ext: 'webp', test: (bytes) => bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' },
};

export function saveBrandImage(orgId: string, kind: BrandKind, bytes: Buffer): { url: string } | { error: 'file_type' | 'file_size' } {
  const rule = brandKinds[kind];
  if (!bytes.length) return { error: 'file_type' };
  if (bytes.length > rule.max) return { error: 'file_size' };
  const found = Object.values(types).find((item) => item.test(bytes));
  if (!found) return { error: 'file_type' };
  const dir = path.join(brandDir, orgId);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${kind}-${Date.now()}.${found.ext}`;
  fs.writeFileSync(path.join(dir, name), bytes);
  return { url: `/api/brand-files/${orgId}/${name}` };
}

export function removeBrandFile(orgId: string, url: string) {
  const prefix = `/api/brand-files/${orgId}/`;
  if (!url.startsWith(prefix)) return;
  const name = path.basename(url);
  const dir = path.join(brandDir, orgId);
  const full = path.resolve(dir, name);
  if (!full.startsWith(dir + path.sep)) return;
  fs.rmSync(full, { force: true });
}
