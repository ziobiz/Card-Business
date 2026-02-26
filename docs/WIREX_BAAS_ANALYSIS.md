# Wirex BaaS vs 기존 구현 비교 분석

> **기준 문서**: https://docs.wirexapp.com/docs/introduction  
> **개발 표준**: Wirex BaaS API

---

## 1. API 체계 차이

| 항목 | 기존 (Wirex Pay Partner) | Wirex BaaS (표준) |
|------|--------------------------|-------------------|
| **문서** | partner.wirexpaychain.com | **docs.wirexapp.com** |
| **API Base (Sandbox)** | api-business.wirexpaychain.tech | **api-baas.wirexapp.tech** |
| **API Base (Prod)** | 파트너별 제공 | **api-baas.wirexapp.com** |
| **인증** | Auth0 /oauth/token | **POST /api/v1/token** |
| **Sandbox credentials** | 없음 (온보딩 필요) | **공개 테스트용 제공** |

---

## 2. Wirex BaaS 핵심 구조

### 2.1 플랫폼 구성요소

| 기능 | 설명 |
|------|------|
| **Self-Custodial Wallets** | AA 지갑, 사용자가 키 제어 |
| **Payment Cards** | Visa 카드, 지갑 연동 |
| **Bank Accounts** | SEPA (EUR), ACH (USD) |
| **Unified Balance** | WUSD, WEUR, WGBP 통합 잔액 |
| **Push to Card** | 지갑 → 외부 카드 송금 |

### 2.2 Unified Balance (핵심 변경)

- **WUSD** (USD), **WEUR** (EUR) — 통합 스테이블코인
- USDT/USDC/EURC 입금 시 **자동 1:1 래핑**
- 잔액 조회: `GET /api/v1/wallet` → `balances[]` with `token_symbol`, `balance`

### 2.3 환경 및 인증

**Sandbox (공개 테스트용)**:
- Base URL: `https://api-baas.wirexapp.tech`
- Chain ID: **84532** (Base Sepolia)
- client_id: `9qgK7xzQirmJgZi9zOamLXQ6dQ7KpUu9`
- client_secret: (Environments 문서 참조)
- partner_id: `0x00000000000000000000000000000007`

**필수 헤더**:
```
Authorization: Bearer <access_token>
X-Chain-Id: 84532
Content-Type: application/json
```

### 2.4 통합 플로우

```
1. Partner Setup    → credentials, webhooks
2. Authentication   → POST /api/v1/token
3. Wallet Deployment → ZeroDev SDK, Accounts contract
4. On-Chain Registration
5. User Registration → POST /api/v2/user (KYC)
6. Operations → Cards, transfers, activities
```

---

## 3. 수정 필요 사항

### 3.1 API 참조 문서
- `API_REFERENCE.md` → Wirex BaaS 기준으로 전면 개편
- Base URL, 인증, 엔드포인트 경로 변경

### 3.2 월렛/잔액
- **표시 통화**: USDT/USDC → **WUSD**, **WEUR**
- **잔액 API**: `GET /api/v1/wallet` 형식 준수
- Mock 응답 구조를 BaaS `balances` 형식에 맞게 수정

### 3.3 백엔드
- 토큰 교환: `/api/v1/token` (client_credentials)
- User: `POST /api/v2/user`
- `X-Chain-Id` 헤더 추가
- 환경 변수: `WIREX_BAAS_URL`, `WIREX_CHAIN_ID`

### 3.4 프론트엔드
- 잔액 표시: WUSD, WEUR
- 토큰 심볼 및 라벨 정리

### 3.5 Cursor Rules
- 참조 문서: docs.wirexapp.com
- mcps/wirex-resources.json URL 갱신
