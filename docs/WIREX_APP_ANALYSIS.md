# Wirex 앱 UI/UX 분석 (화이트라벨 참조)

> 분석 대상: https://app.wirexapp.com  
> 로그인: https://id.wirexapp.com/login

---

## 1. 전체 구조

Wirex 앱은 **다크 테마**, **초록색 포인트 컬러**를 사용하는 크립토·카드 통합 플랫폼입니다.

### 1.1 네비게이션 구조

| 상단 메뉴 | 설명 |
|----------|------|
| Home | 대시보드 (계정·거래 피드) |
| Payments | 결제/송금 |
| Cards | 카드 관리 |
| Prices | 암호화폐 시세 |
| Wirex X-tras | 리워드/캐시백 |
| Financial Statements | 재무 내역 |

**사이드바:**
- Dashboard (아이콘)
- Buy WXT
- Accounts 섹션
- Preferences, Log out

---

## 2. Home (대시보드) 구조

### 2.1 상단 액션
- **Add Funds** – 자금 입금 (로컬 카드 또는 온체인)
- **Details** – 상세 정보
- 선택 통화 표시 (예: Tether · $50)
- 총 잔액 (예: $54.43)

### 2.2 Accounts 섹션 (좌측)
- **Hide zero balances** 토글
- **Search** – 계정 검색
- **Stable / Crypto / Linked** 탭
- **계정 목록:**
  - Fiat: British Pound, US Dollar, Euro
  - Crypto: WXT, TRON
- **Linked (카드 연동 계정):**
  - "These are accounts linked to your Wirex card from which you can spend money"
  - Visa •••• 6257: Tether · $0.24, TRON
  - Visa •••• 9216: TRON, Binance coin
  - Visa •••• 0321: Tether · $0.24, TRON
  - 각 카드에 **Manage**, **Show more**

### 2.3 Recent Activity
- **날짜별 그룹** (Yesterday, 18 Feb 2026, ...)
- **거래 유형:**
  - Earned X WXT
  - Sent X USDT
  - Added X USDT
  - 카드 결제: `가맹점명 X.XX USDT 로컬금액` (예: CO-OP Toyama 14.43 USDT 2,200 JPY)
  - Exchanged (통화 교환)
  - Card Order
  - Failed 표시 지원

---

## 3. Cards 페이지 구조

### 3.1 레이아웃
- 제목: **Cards**
- 카드 **가로 배치**
- 각 카드: Active, wirex 로고, VISA 로고, 카드 디자인(다크/블루/퍼플)
- **Add New** – Order New Card

### 3.2 카드 정보
- Visa •••• 6257, 9216, 0321
- 카드별 연동 토큰·잔액 표시
- Manage → 상세·설정

---

## 4. 핵심 UX 패턴

1. **다크 테마 + 초록 포인트**
2. **통합 대시보드** – 계정 잔액 + 최근 거래
3. **카드–토큰 연동** – 카드별 USDT/TRON 등 스펙
4. **Add Funds** – 입금 진입점
5. **날짜별 거래 그룹** – Recent Activity
6. **카드 그리드** – 카드별 시각적 구분

---

## 5. Wirex Pay API 매핑

| Wirex 앱 기능 | API (Partner) |
|---------------|---------------|
| 카드 목록 | GET /api/v1/cards |
| 가상 카드 발급 | POST /api/v1/cards/virtual |
| 카드 차단/해제 | PUT /api/v1/cards/{id}/block, unblock |
| 카드 한도 | PUT /api/v1/cards/{id}/limit |
| 지갑 잔액 | Wallet API |
| 프라이머리→카드 입금 | 온체인 deposit |
| 거래 내역 | Activity Feed API, Webhooks |

---

## 6. 화이트라벨 적용 사항

1. **대시보드**: 계정(월렛) 잔액 + Recent Activity
2. **카드 페이지**: 카드 그리드 + Order New Card
3. **Add Funds / Top up**: 월렛→카드 충전
4. **네비게이션**: Home, Cards, (Payments·Prices는 선택)
5. **스타일**: 다크 테마, 포인트 컬러 유지
