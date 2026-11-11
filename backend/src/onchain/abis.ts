export const contractRegistryAbi = [
  {
    type: 'function',
    name: 'contractByName',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const corporateAccountsAbi = [
  {
    type: 'function',
    name: 'createCorporationForCorporateWallet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentEntity', type: 'bytes16' },
      { name: 'wallet', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getCorporation',
    stateMutability: 'view',
    inputs: [
      { name: 'parentEntity', type: 'bytes16' },
      { name: 'corporation', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'verificationStatus', type: 'uint8' },
          { name: 'walletStatus', type: 'uint8' },
        ],
      },
    ],
  },
] as const;

export const STATUS = ['UNKNOWN', 'PENDING', 'ACTIVE', 'BLOCKED', 'DELETED'] as const;
export const VERIFICATION = ['UNKNOWN', 'APPLIED', 'IN_REVIEW', 'APPROVED', 'CANCELLED', 'REJECTED'] as const;
export const WALLET_STATUS = ['UNKNOWN', 'CONFIRMED', 'REJECTED'] as const;
