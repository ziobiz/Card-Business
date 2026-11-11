import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { wirexCorporate } from '../config.js';
import { patchCorp, readCorp } from '../corpStore.js';
import { contractRegistryAbi, corporateAccountsAbi, STATUS, VERIFICATION, WALLET_STATUS } from './abis.js';
import { publicOwnerSecret, readOwnerPrivateKey, saveOwnerPrivateKey } from './corpSecrets.js';

export type ChainEndpoints = {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  bundlerUrl: string;
  paymasterUrl: string;
  contractRegistry: `0x${string}`;
  blockExplorerUrl: string;
};

export type CorporateContracts = {
  CorporateAccounts: `0x${string}`;
  CorporateValidator: `0x${string}`;
  ExecutionDelayCorporatePolicy: `0x${string}`;
  FundsManagement: `0x${string}`;
  TokensRegistry?: `0x${string}`;
};

function partnerBytes16(): Hex {
  const raw = wirexCorporate.partnerId.trim();
  if (!raw) throw new Error('WIREX_PARTNER_ID 가 없습니다.');
  const hex = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{32}$/.test(hex)) {
    throw new Error('WIREX_PARTNER_ID 는 bytes16(0x + 32 hex) 이어야 합니다.');
  }
  return hex as Hex;
}

export async function fetchChainEndpoints(): Promise<ChainEndpoints> {
  const res = await fetch(`${wirexCorporate.apiBase}/api/v1/config`);
  if (!res.ok) throw new Error(`config ${res.status}`);
  const data = (await res.json()) as {
    defaultChain?: Partial<ChainEndpoints> & { id?: number; name?: string };
    chains?: Record<string, Partial<ChainEndpoints> & { id?: number; name?: string }>;
  };
  const wanted = String(wirexCorporate.chainId);
  const row = data.chains?.[wanted] || data.defaultChain;
  if (!row?.rpcUrl || !row?.contractRegistry) throw new Error('chain_config_missing');
  return {
    chainId: Number(row.id || wirexCorporate.chainId),
    chainName: String(row.name || 'Base Sepolia'),
    rpcUrl: String(row.rpcUrl),
    bundlerUrl: String(row.bundlerUrl || ''),
    paymasterUrl: String(row.paymasterUrl || ''),
    contractRegistry: getAddress(String(row.contractRegistry)) as `0x${string}`,
    blockExplorerUrl: String(row.blockExplorerUrl || ''),
  };
}

function client(rpcUrl: string) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
}

export async function resolveCorporateContracts(endpoints?: ChainEndpoints): Promise<{
  endpoints: ChainEndpoints;
  contracts: CorporateContracts;
}> {
  const ep = endpoints || (await fetchChainEndpoints());
  const publicClient = client(ep.rpcUrl);
  const names = [
    'CorporateAccounts',
    'CorporateValidator',
    'ExecutionDelayCorporatePolicy',
    'FundsManagement',
    'TokensRegistry',
  ] as const;
  const contracts = {} as CorporateContracts;
  for (const name of names) {
    const address = (await publicClient.readContract({
      address: ep.contractRegistry,
      abi: contractRegistryAbi,
      functionName: 'contractByName',
      args: [name],
    })) as `0x${string}`;
    if (name !== 'TokensRegistry') {
      (contracts as Record<string, string>)[name] = getAddress(address);
    } else if (address && address !== '0x0000000000000000000000000000000000000000') {
      contracts.TokensRegistry = getAddress(address);
    }
  }
  return { endpoints: ep, contracts };
}

export function corporateValidatorInstallData(ownerEoa: string): Hex {
  const partner = partnerBytes16();
  const owner = getAddress(ownerEoa).toLowerCase().replace(/^0x/, '');
  return `${partner}${owner}` as Hex;
}

export async function readCorporationOnChain(corporationAddress: string) {
  if (!isAddress(corporationAddress)) throw new Error('invalid_corporation_address');
  const { endpoints, contracts } = await resolveCorporateContracts();
  const publicClient = client(endpoints.rpcUrl);
  const partner = partnerBytes16();
  const row = await publicClient.readContract({
    address: contracts.CorporateAccounts,
    abi: corporateAccountsAbi,
    functionName: 'getCorporation',
    args: [partner, getAddress(corporationAddress)],
  });
  const status = Number(row.status);
  const verificationStatus = Number(row.verificationStatus);
  const walletStatus = Number(row.walletStatus);
  return {
    endpoints,
    contracts,
    partnerId: partner,
    corporationAddress: getAddress(corporationAddress),
    creator: row.creator,
    status,
    statusLabel: STATUS[status] || String(status),
    verificationStatus,
    verificationLabel: VERIFICATION[verificationStatus] || String(verificationStatus),
    walletStatus,
    walletStatusLabel: WALLET_STATUS[walletStatus] || String(walletStatus),
    exists: status !== 0,
  };
}

export function generateOwnerWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  saveOwnerPrivateKey(privateKey, account.address);
  patchCorp({ ownerWallet: account.address });
  return { address: account.address, privateKeyOnce: privateKey };
}

export function importOwnerWallet(privateKey: string) {
  const key = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex;
  const account = privateKeyToAccount(key);
  saveOwnerPrivateKey(key, account.address);
  patchCorp({ ownerWallet: account.address });
  return { address: account.address };
}

export async function onchainOverview() {
  const corp = readCorp();
  const { endpoints, contracts } = await resolveCorporateContracts();
  const ownerSecret = publicOwnerSecret();
  const owner = corp.ownerWallet || ownerSecret.ownerAddress || '';
  let corporation = null as Awaited<ReturnType<typeof readCorporationOnChain>> | null;
  if (corp.corporationAddress && isAddress(corp.corporationAddress)) {
    try {
      corporation = await readCorporationOnChain(corp.corporationAddress);
      if (corporation.exists) {
        patchCorp({
          onChainDone: true,
          ownerWallet: corporation.creator || corp.ownerWallet,
        });
      }
    } catch {
      corporation = null;
    }
  }
  return {
    endpoints,
    contracts,
    partnerIdSet: Boolean(wirexCorporate.partnerId),
    partnerIdPreview: wirexCorporate.partnerId ? `${wirexCorporate.partnerId.slice(0, 10)}…` : null,
    owner,
    ownerKeyStored: ownerSecret.ownerKeyStored,
    corporationAddress: corp.corporationAddress || null,
    corporateValidatorInstallData: owner && isAddress(owner) ? corporateValidatorInstallData(owner) : null,
    corporation,
    deployerConfigured: Boolean(process.env.WIREX_DEPLOYER_PRIVATE_KEY),
    note: corporation?.exists
      ? '온체인 법인 지갑이 준비되었습니다. API 등록·로그인 후 직원·카드를 진행하세요. 카드 발급에는 KYB(SDD) 승인이 필요합니다.'
      : '「법인 지갑 배포」또는「지갑배포+등록+로그인」으로 Kernel AA + CorporateValidator + FundsManagement 를 한 번에 배포합니다.',
  };
}

export async function createCorporationOnChain(corporationAddress: string) {
  if (!isAddress(corporationAddress)) throw new Error('invalid_corporation_address');
  const deployerKey = process.env.WIREX_DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) {
    const { endpoints, contracts } = await resolveCorporateContracts();
    const partner = partnerBytes16();
    const data = encodeFunctionData({
      abi: corporateAccountsAbi,
      functionName: 'createCorporationForCorporateWallet',
      args: [partner, getAddress(corporationAddress)],
    });
    return {
      sent: false,
      reason: 'WIREX_DEPLOYER_PRIVATE_KEY 가 없습니다. 아래 calldata 로 전송하거나 배포자 키를 .env 에 넣으세요.',
      to: contracts.CorporateAccounts,
      data,
      explorer: endpoints.blockExplorerUrl,
      chainId: endpoints.chainId,
    };
  }
  const { endpoints, contracts } = await resolveCorporateContracts();
  const account = privateKeyToAccount((deployerKey.startsWith('0x') ? deployerKey : `0x${deployerKey}`) as Hex);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(endpoints.rpcUrl),
  });
  const partner = partnerBytes16();
  const hash = await wallet.writeContract({
    address: contracts.CorporateAccounts,
    abi: corporateAccountsAbi,
    functionName: 'createCorporationForCorporateWallet',
    args: [partner, getAddress(corporationAddress)],
  });
  const publicClient = client(endpoints.rpcUrl);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  patchCorp({
    corporationAddress: getAddress(corporationAddress),
    onChainDone: true,
    chainId: endpoints.chainId,
    lastError: '',
  });
  const corporation = await readCorporationOnChain(corporationAddress);
  return {
    sent: true,
    transactionHash: hash,
    status: receipt.status,
    corporation,
  };
}

export function exportOwnerForLogin() {
  const stored = readOwnerPrivateKey();
  const corp = readCorp();
  return {
    ownerWallet: corp.ownerWallet || stored?.address || '',
    ownerEmail: corp.ownerEmail || '',
    hasPrivateKey: Boolean(stored),
  };
}
