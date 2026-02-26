# Wirex BaaS · Unified Balance 연동

> **공식 문서**: https://docs.wirexapp.com/docs/introduction  
> **Unified Balance**: https://docs.wirexapp.com/docs/unified-balance  
> **Crypto Assets**: https://docs.wirexapp.com/docs/crypto-assets

---

## 1. 개요

Wirex BaaS는 **Unified Balance (WUSD, WEUR)** 를 사용합니다.

- USDT/USDC/EURC 입금 시 **1:1로 WUSD/WEUR로 래핑**
- 카드 결제, 송금, 출금은 통합 잔액(WUSD/WEUR) 기준
- 단일 잔액 뷰, 체인·토큰 구분 없음

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자 (User)                                                    │
├─────────────────────────────────────────────────────────────────┤
│  Smart Wallet (AA)                                                │
│  - ZeroDev SDK로 배포                                              │
│  - WUSD, WEUR 통합 잔액                                            │
│  - 가스 비용 없음 (PayMaster)                                       │
└──────────────┬──────────────────────────────────────────────────┘
               │
               ├── 카드 결제 (Visa)
               ├── Bank Transfer (SEPA/ACH)
               ├── Push to Card
               └── On-Chain Withdrawal (Unwrap → USDC/EURC)
```

---

## 3. Unified Balance API

### 3.1 잔액 조회

```
GET /api/v1/wallet
Authorization: Bearer <token>
X-Chain-Id: 84532
```

**응답 예:**
```json
{
  "balances": [
    { "token_symbol": "WUSD", "balance": 1581.07, "reference_currency": "USD" },
    { "token_symbol": "WEUR", "balance": 7.27, "reference_currency": "USD" }
  ]
}
```

### 3.2 입금 플로우

1. Multi-chain: Global Deposit Address 또는 Rhino.fi Bridge
2. Base 직접: USDC/USDT/EURC → Smart Wallet
3. 자동 래핑 → WUSD/WEUR 잔액 증가
4. Webhook로 잔액 변경 알림

### 3.3 출금 플로우

1. WUSD/WEUR → Unwrap → USDC/EURC
2. ExecutionDelayPolicy (3초 딜레이)
3. 외부 주소로 전송

---

## 4. 토큰 주소 (Base Sepolia Sandbox)

| Token | Address | Decimals |
|-------|---------|----------|
| USDC | 0x7Af7cDbd557eD302F7538Db1e3d094C8BBcA665c | 6 |
| USDT | 0x2C6c7c00ACa9B9D8446d107367485079b0471706 | 18 |
| EURC | 0xF70461ffb413981852683657A310892227e3989e | 6 |
| **WUSD** | 0x0774164DC20524Bb239b39D1DC42573C3E4C6976 | 18 |
| **WEUR** | 0x5c55F314624718019A326F16a62A05D6C6d8C8A2 | 18 |

---

## 5. API Base URL

| 환경 | URL |
|------|-----|
| Sandbox | https://api-baas.wirexapp.tech |
| Production | https://api-baas.wirexapp.com |

---

## 6. 참고 링크

| 문서 | URL |
|------|-----|
| Platform Overview | https://docs.wirexapp.com/docs/introduction |
| Unified Balance | https://docs.wirexapp.com/docs/unified-balance |
| Crypto Assets | https://docs.wirexapp.com/docs/crypto-assets |
| Global Addresses | https://docs.wirexapp.com/docs/global-addresses |
| Withdrawals | https://docs.wirexapp.com/docs/withdrawals |
