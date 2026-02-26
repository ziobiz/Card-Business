# Wirex BaaS API Reference

> **공식 문서**: https://docs.wirexapp.com/docs/introduction  
> **개발 기준**: Wirex BaaS API

---

## 1. 환경

### 1.1 API Base URL

| 환경 | Base URL |
|------|----------|
| **Sandbox** | `https://api-baas.wirexapp.tech` |
| **Production** | `https://api-baas.wirexapp.com` |

### 1.2 Chain

| 환경 | Chain | Chain ID |
|------|-------|----------|
| Sandbox | Base Sepolia | `84532` |
| Production | Base | `8453` |

### 1.3 Sandbox 테스트 자격증명

공개 테스트용 자격증명 (docs.wirexapp.com/docs/environments):

| 항목 | 값 |
|------|-----|
| client_id | `9qgK7xzQirmJgZi9zOamLXQ6dQ7KpUu9` |
| client_secret | (Environments 문서 참조) |
| partner_id | `0x00000000000000000000000000000007` |

> 전용 자격증명 필요 시 Wirex에 문의

---

## 2. 인증

### 2.1 S2S Token (Server-to-Server)

```
POST /api/v1/token
Content-Type: application/json

{
  "client_id": "your-client-uuid",
  "client_secret": "your-client-secret",
  "grant_type": "client_credentials"
}
```

**응답:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_at": 1739612400
}
```

- 유효기간: 48시간
- Scope: `partner:full`

### 2.2 API 호출 시 헤더

| Header | 필수 | 설명 |
|--------|------|------|
| `Authorization` | O | `Bearer <access_token>` |
| `X-Chain-Id` | O | `84532` (Sandbox) 또는 `8453` (Prod) |
| `Content-Type` | O | `application/json` (body 있는 경우) |

---

## 3. Unified Balance

### 3.1 개요

- **WUSD**: USD 통합 스테이블코인
- **WEUR**: EUR 통합 스테이블코인
- USDC/USDT/EURC 입금 시 1:1로 WUSD/WEUR로 래핑

### 3.2 잔액 조회

```
GET /api/v1/wallet
Authorization: Bearer <token>
X-Chain-Id: 84532
```

**응답 (balances 일부):**
```json
{
  "balances": [
    {
      "token_symbol": "WUSD",
      "token_address": "0x...",
      "balance": 1581.07,
      "reference_balance": 1581.07,
      "reference_currency": "USD"
    },
    {
      "token_symbol": "WEUR",
      "token_address": "0x...",
      "balance": 7.27,
      "reference_balance": 8.40,
      "reference_currency": "USD"
    }
  ]
}
```

### 3.3 토큰 주소 (Base Sepolia Sandbox)

| Token | Address | Decimals |
|-------|---------|----------|
| USDC | `0x7Af7cDbd557eD302F7538Db1e3d094C8BBcA665c` | 6 |
| USDT | `0x2C6c7c00ACa9B9D8446d107367485079b0471706` | 18 |
| EURC | `0xF70461ffb413981852683657A310892227e3989e` | 6 |
| WUSD | `0x0774164DC20524Bb239b39D1DC42573C3E4C6976` | 18 |
| WEUR | `0x5c55F314624718019A326F16a62A05D6C6d8C8A2` | 18 |

---

## 4. 사용자 및 온보딩

| 단계 | 설명 |
|------|------|
| 1 | Wallet Deployment (ZeroDev SDK, Accounts contract) |
| 2 | On-Chain Registration |
| 3 | User Registration — `POST /api/v2/user` (KYC 데이터 포함) |

**KYC 옵션**:
- Wirex Hosted
- SumSub Shared
- Reliance (직접 검증 데이터 제공)

---

## 5. Cards

| 기능 | Guide |
|------|-------|
| 카드 발급·관리 | [Issue and Manage a Card](https://docs.wirexapp.com/docs/issue-and-manage-a-card) |
| 카드 상세 조회 | [Read Card Details](https://docs.wirexapp.com/docs/read-card-details) |
| 카드 거래 | [Card Transactions](https://docs.wirexapp.com/docs/card-transactions) |
| 3DS | [3DS Authentication](https://docs.wirexapp.com/docs/3ds-authentication) |
| 한도 | [Card Limits](https://docs.wirexapp.com/docs/card-limits) |

---

## 6. 기타 기능

| 기능 | Guide |
|------|-------|
| Bank Accounts | [SEPA](https://docs.wirexapp.com/docs/sepa-bank-details), [ACH](https://docs.wirexapp.com/docs/ach-bank-details) |
| Push to Card | [Push to Card](https://docs.wirexapp.com/docs/push-to-card) |
| 활동 내역 | [Activity History](https://docs.wirexapp.com/docs/activities) |
| Webhooks | [Webhooks](https://docs.wirexapp.com/docs/webhooks) |

---

## 7. 참고 링크

| 문서 | URL |
|------|-----|
| Platform Overview | https://docs.wirexapp.com/docs/introduction |
| Getting Started | https://docs.wirexapp.com/docs/getting-started |
| Environments | https://docs.wirexapp.com/docs/environments |
| Authentication | https://docs.wirexapp.com/docs/authentication |
| Unified Balance | https://docs.wirexapp.com/docs/unified-balance |
| Crypto Assets | https://docs.wirexapp.com/docs/crypto-assets |
| 분석·비교 | [WIREX_BAAS_ANALYSIS.md](WIREX_BAAS_ANALYSIS.md) |
