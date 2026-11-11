import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type PlatformSettings = {
  publicHost: string;
  publicApiBase: string;
  sslCertPath: string;
  sslLeDomain: string;
  uiRefreshSec: number;
  contractDiskGb: number;
  contractTrafficGb: number;
  contractTrafficUsedGb: number;
  contractStart: string;
  contractEnd: string;
  note: string;
};

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/platform.json');

function defaults(): PlatformSettings {
  return {
    publicHost: 'business.icocard.net',
    publicApiBase: '',
    sslCertPath: '',
    sslLeDomain: 'business.icocard.net',
    uiRefreshSec: 120,
    contractDiskGb: 0,
    contractTrafficGb: 0,
    contractTrafficUsedGb: 0,
    contractStart: '',
    contractEnd: '',
    note: '',
  };
}

export function readPlatform(): PlatformSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<PlatformSettings>;
    return { ...defaults(), ...raw };
  } catch {
    const seeded = defaults();
    writePlatform(seeded);
    return seeded;
  }
}

export function writePlatform(row: PlatformSettings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(row, null, 2));
}

export function patchPlatform(partial: Partial<PlatformSettings>) {
  const next = { ...readPlatform(), ...partial };
  if (next.uiRefreshSec < 15) next.uiRefreshSec = 15;
  if (next.uiRefreshSec > 3600) next.uiRefreshSec = 3600;
  writePlatform(next);
  return next;
}
