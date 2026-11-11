import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type CorpProfile = {
  ownerWallet: string;
  ownerEmail: string;
  corporationAddress: string;
  corporationName: string;
  registrationNumber: string;
  registrationCountry: string;
  chainId: number;
  onChainDone: boolean;
  registeredAt?: string;
  lastLoginAt?: string;
  partnerToken?: string;
  partnerExpiresAt?: number;
  corporationToken?: string;
  corporationTokenExp?: number;
  corporationId?: string;
  employeeId?: string;
  role?: string;
  verificationStatus?: string;
  lastWebhookAt?: string;
  lastError?: string;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
const file = path.join(dataDir, 'corporation.json');

const empty = (): CorpProfile => ({
  ownerWallet: '',
  ownerEmail: '',
  corporationAddress: '',
  corporationName: '',
  registrationNumber: '',
  registrationCountry: '',
  chainId: 84532,
  onChainDone: false,
});

export function readCorp(): CorpProfile {
  try {
    return { ...empty(), ...(JSON.parse(fs.readFileSync(file, 'utf8')) as CorpProfile) };
  } catch {
    return empty();
  }
}

export function writeCorp(row: CorpProfile) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(row, null, 2), 'utf8');
}

export function patchCorp(patch: Partial<CorpProfile>) {
  const next = { ...readCorp(), ...patch };
  writeCorp(next);
  return next;
}

export function publicCorp(row = readCorp()) {
  return {
    ownerWallet: row.ownerWallet,
    ownerEmail: row.ownerEmail,
    corporationAddress: row.corporationAddress,
    corporationName: row.corporationName,
    registrationNumber: row.registrationNumber,
    registrationCountry: row.registrationCountry,
    chainId: row.chainId,
    onChainDone: row.onChainDone,
    registeredAt: row.registeredAt || null,
    lastLoginAt: row.lastLoginAt || null,
    corporationId: row.corporationId || null,
    employeeId: row.employeeId || null,
    role: row.role || null,
    verificationStatus: row.verificationStatus || null,
    lastWebhookAt: row.lastWebhookAt || null,
    lastError: row.lastError || null,
    partnerTokenReady: Boolean(row.partnerToken && (row.partnerExpiresAt || 0) > Date.now() / 1000 + 60),
    corporationTokenReady: Boolean(row.corporationToken && (row.corporationTokenExp || 0) > Date.now() / 1000 + 60),
  };
}
