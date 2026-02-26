# Wirex Pay 카드 발급 사이트 아키텍처 설계

---

## 1. 시스템 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Frontend (우리 제작)                                  │
│  • 회원가입 / 로그인 / KYC 화면                                           │
│  • 카드 신청 / 발급 / 활성화 UI                                           │
│  • 카드 목록 / 한도 설정 / 거래 내역                                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS (REST / GraphQL)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Backend API (우리 제작)                               │
│  • 인증 (JWT, 세션)                                                       │
│  • Wirex API 프록시 (client_id/secret 보관)                              │
│  • X-User-Id, X-User-Email 헤더 주입                                     │
│  • Webhook 수신 및 처리                                                   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Wirex Pay API                                         │
│  • 사용자 생성 / KYC                                                      │
│  • 카드 발급 / 활성화 / 한도 설정                                         │
│  • 지갑 / 결제 / 정산                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 권장 폴더 구조

```
Card/
├── frontend/                 # React / Next.js / Vue 등
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── auth/         # 로그인, 회원가입
│   │   │   ├── dashboard/    # 대시보드
│   │   │   ├── cards/        # 카드 목록, 발급, 상세
│   │   │   └── kyc/          # KYC 검증
│   │   ├── services/         # API 호출 래퍼
│   │   └── ...
│   └── package.json
│
├── backend/                  # Node.js / Express / Nest 등
│   ├── src/
│   │   ├── config/           # 환경 변수, Wirex 설정
│   │   ├── services/
│   │   │   ├── wirex/        # Wirex API 래퍼
│   │   │   │   ├── auth.ts   # JWT 발급
│   │   │   │   ├── user.ts   # 사용자 API
│   │   │   │   └── card.ts   # 카드 API
│   │   │   └── ...
│   │   ├── webhooks/         # Wirex Webhook 핸들러
│   │   ├── routes/
│   │   └── ...
│   └── package.json
│
├── docs/
│   ├── API_REFERENCE.md      # API 요약
│   ├── SDK_GUIDE.md         # SDK 가이드
│   └── ARCHITECTURE.md      # 이 문서
│
└── README.md
```

---

## 3. 핵심 흐름

### 3.1 사용자 등록 + Wirex 사용자 생성

```
[회원가입] → [Backend: DB에 사용자 저장]
         → [Backend: POST /api/v1/user (Wirex)]
         → [Wirex: 사용자 + AA 지갑 생성]
         → [Backend: Wirex userId 저장]
```

### 3.2 카드 발급 흐름

```
[카드 신청] → [Backend: KYC 상태 확인]
          → [Backend: POST /api/v1/cards/virtual (X-User-Id 헤더)]
          → [Wirex: 가상 카드 발급]
          → [Backend: 카드 정보 DB 저장]
          → [Frontend: 카드 표시]
```

### 3.3 결제 승인 (Wirex → 우리)

```
[고객 결제] → [카드 네트워크] → [Wirex]
                       → [Webhook: 우리 Backend으로 트랜잭션 알림]
                       → [우리: 500ms 이내 approve/deny 응답]
                       → [Wirex: 최종 승인/거절]
```

---

## 4. 보안 고려사항

| 항목 | 권장 사항 |
|------|-----------|
| client_id, client_secret | 환경 변수에 저장, 백엔드에서만 사용 |
| JWT 토큰 | 만료 시간 확인, 자동 갱신 로직 |
| 사용자 식별 | X-User-Id (우리 DB ID 매핑) 또는 X-User-Email |
| Webhook | 서명 검증, HTTPS 필수 |
| 카드 PAN/CVV | actionToken 기반으로만 조회, 로그 금지 |

---

## 5. 환경 변수 예시 (.env)

```env
# Wirex (파트너 승인 후 발급)
WIREX_AUTH_URL=https://wirex-pay-dev.eu.auth0.com/oauth/token
WIREX_API_URL=https://api-business.wirexpaychain.tech
WIREX_CLIENT_ID=your_client_id
WIREX_CLIENT_SECRET=your_client_secret
WIREX_AUDIENCE=https://api-business.wirexpaychain.tech

# Webhook (Wirex가 호출할 우리 URL)
WIREX_WEBHOOK_SECRET=your_webhook_signing_secret
```

---

## 6. 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| Frontend | React + Vite + TypeScript | 웹, 반응형 |
| i18n | react-i18next | ko, en, ja 지원 |
| Backend | Node.js + Express | Mock/Real Wirex |
| 배포 | Vercel/Netlify 등 | 웹 호스팅 |

---

## 7. Wirex 승인 전 진행 가능 작업

- [x] API 문서 숙지
- [x] SDK 문서 확인
- [x] 아키텍처 설계
- [ ] 프론트엔드 UI 프로토타입 (목업 데이터)
- [ ] 백엔드 API 설계 (OpenAPI 등)
- [ ] DB 스키마 설계
- [ ] 인증/세션 구조 설계

---

## 8. 참고 자료

- [Wirex Developer](https://www.wirexapp.com/developers)
- [Partner API Docs](https://partner.wirexpaychain.com/)
- [How Wirex Pay Works](https://partner.wirexpaychain.com/docs/how-it-works)
- [Supported Countries](https://partner.wirexpaychain.com/docs/supported-countries)
