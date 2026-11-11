import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  KernelV3_1AccountAbi,
} from '@zerodev/sdk';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { getEntryPoint, KERNEL_V3_1, VALIDATOR_TYPE } from '@zerodev/sdk/constants';
import { toPermissionValidator } from '@zerodev/permissions';
import { toSudoPolicy } from '@zerodev/permissions/policies';
import {
  concatHex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  getAddress,
  http,
  pad,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { wirexCorporate } from '../config.js';
import { patchCorp } from '../corpStore.js';
import { corporateAccountsAbi } from './abis.js';
import { corporateValidatorInstallData, resolveCorporateContracts, readCorporationOnChain } from './corporateOnchain.js';
import { readOwnerPrivateKey, saveOwnerPrivateKey } from './corpSecrets.js';

function partnerBytes16(): Hex {
  const raw = wirexCorporate.partnerId.trim();
  const hex = (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex;
  if (!/^0x[0-9a-fA-F]{32}$/.test(hex)) throw new Error('WIREX_PARTNER_ID 는 bytes16 이어야 합니다.');
  return hex;
}

function toCorporateValidatorSigner(owner: ReturnType<typeof privateKeyToAccount>, corporateValidator: Address) {
  const installData = corporateValidatorInstallData(owner.address);
  return {
    account: owner,
    signerContractAddress: corporateValidator,
    getSignerData: () => installData,
    getDummySignature: () =>
      '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c' as Hex,
  };
}

/**
 * Kernel v3.1 법인 지갑 배포:
 * 1) ECDSA로 계정 생성
 * 2) 같은 UserOp에서 CorporateValidator+ExecutionDelayCorporatePolicy 루트 전환 + FundsManagement 설치
 * 3) 같은 UserOp에서 createCorporationForCorporateWallet 호출
 */
export async function deployAndRegisterCorporationWallet(options?: {
  ownerPrivateKey?: Hex;
  ownerEmail?: string;
}) {
  let ownerKey = options?.ownerPrivateKey;
  let owner = ownerKey ? privateKeyToAccount(ownerKey) : null;
  if (!owner) {
    const stored = readOwnerPrivateKey();
    if (stored) {
      ownerKey = stored.privateKey as Hex;
      owner = privateKeyToAccount(ownerKey);
    }
  }
  if (!owner || !ownerKey) {
    throw new Error('owner_key_required');
  }
  saveOwnerPrivateKey(ownerKey, owner.address);

  const { endpoints, contracts } = await resolveCorporateContracts();
  if (!endpoints.bundlerUrl || !endpoints.paymasterUrl) {
    throw new Error('bundler_or_paymaster_missing');
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(endpoints.rpcUrl),
  });
  const entryPoint = getEntryPoint('0.7');

  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer: owner,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });

  const kernelAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    plugins: { sudo: ecdsaValidator },
  });

  const paymasterClient = createZeroDevPaymasterClient({
    chain: baseSepolia,
    transport: http(endpoints.paymasterUrl),
  });

  const kernelClient = createKernelAccountClient({
    account: kernelAccount,
    chain: baseSepolia,
    bundlerTransport: http(endpoints.bundlerUrl),
    client: publicClient,
    paymaster: {
      getPaymasterData: (userOperation) => paymasterClient.sponsorUserOperation({ userOperation }),
    },
  });

  const corporateSigner = toCorporateValidatorSigner(owner, contracts.CorporateValidator);
  const rootPolicy = toSudoPolicy({
    policyAddress: contracts.ExecutionDelayCorporatePolicy,
  });
  const permissionValidator = await toPermissionValidator(publicClient, {
    entryPoint,
    signer: corporateSigner,
    kernelVersion: KERNEL_V3_1,
    policies: [rootPolicy],
  });

  const rootValidatorId = concatHex([
    VALIDATOR_TYPE.PERMISSION,
    pad(permissionValidator.getIdentifier(), { size: 20, dir: 'right' }),
  ]);

  const changeRootCallData = encodeFunctionData({
    abi: KernelV3_1AccountAbi,
    functionName: 'changeRootValidator',
    args: [
      rootValidatorId,
      zeroAddress,
      await permissionValidator.getEnableData(kernelAccount.address),
      '0x',
    ],
  });

  const executorCallData = encodeFunctionData({
    abi: KernelV3_1AccountAbi,
    functionName: 'installModule',
    args: [BigInt(2), contracts.FundsManagement, concatHex([zeroAddress, zeroHash])],
  });

  const partner = partnerBytes16();
  const createCorpCallData = encodeFunctionData({
    abi: corporateAccountsAbi,
    functionName: 'createCorporationForCorporateWallet',
    args: [partner, getAddress(kernelAccount.address)],
  });

  const callData = await kernelAccount.encodeCalls([
    { to: kernelAccount.address, value: BigInt(0), data: changeRootCallData },
    { to: kernelAccount.address, value: BigInt(0), data: executorCallData },
    { to: contracts.CorporateAccounts, value: BigInt(0), data: createCorpCallData },
  ]);

  const opHash = await kernelClient.sendUserOperation({ callData });
  const receipt = await kernelClient.waitForUserOperationReceipt({ hash: opHash, timeout: 120_000 });

  const corporationAddress = getAddress(kernelAccount.address);
  patchCorp({
    ownerWallet: owner.address,
    corporationAddress,
    onChainDone: true,
    chainId: endpoints.chainId,
    ownerEmail: options?.ownerEmail || undefined,
    lastError: '',
  });

  // fallback: if UserOp succeeded but createCorporation reverted somehow, try external deployer
  let corporation = await readCorporationOnChain(corporationAddress);
  if (!corporation.exists) {
    const deployerKey = process.env.WIREX_DEPLOYER_PRIVATE_KEY as Hex | undefined;
    if (deployerKey) {
      const deployer = privateKeyToAccount(deployerKey.startsWith('0x') ? deployerKey : (`0x${deployerKey}` as Hex));
      const wallet = createWalletClient({
        account: deployer,
        chain: baseSepolia,
        transport: http(endpoints.rpcUrl),
      });
      const hash = await wallet.writeContract({
        address: contracts.CorporateAccounts,
        abi: corporateAccountsAbi,
        functionName: 'createCorporationForCorporateWallet',
        args: [partner, corporationAddress],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      corporation = await readCorporationOnChain(corporationAddress);
    }
  }

  return {
    corporationAddress,
    ownerAddress: owner.address,
    userOperationHash: opHash,
    transactionHash: receipt.receipt.transactionHash,
    corporation,
    contracts,
    endpoints,
  };
}
