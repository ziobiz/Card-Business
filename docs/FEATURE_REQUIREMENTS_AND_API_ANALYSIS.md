# 개인·기업 카드 서비스 요구사항 및 API 매핑 분석

> 작성일: 2026-02  
> 기준: Wirex BaaS API (docs.wirexapp.com) / Wirex Pay Partner API (partner.wirexpaychain.com)

---

## 1. 요구사항 요약

### 1.1 개인용 카드 (id.wirexapp.com White Label)

| No | 요구사항 | 참고 |
|----|----------|------|
| 1 | 지갑에 스테이블코인 충전 | |
| 2 | 지갑·카드 연동으로 결제 | |
| 3 | 본인 계좌로 송금 (Wirex 정책 준수) | |
| 4 | id.wirexapp.com White Label | |

### 1.2 기업용 카드 (business.wirexapp.com)

| No | 요구사항 | 참고 |
|----|----------|------|
| 1 | 회사 지갑에 스테이블코인 충전 | |
| 2 | 회사 지갑·카드 연동 | |
| 3 | 직원 카드별 한도, 사용 내역 (카드별 마이웰렛) | 직원은 자신 카드만 |
| 4 | 관리자가 회사/타인 계좌로 송금 (Wirex 정책) | |

---

## 2. API로 가능한지 분석

### 2.1 개인용 카드 — **대체로 가능**

| 요구사항 | Wirex BaaS API | 비고 |
|----------|----------------|------|
| 지갑 + 스테이블코인 충전 | ✅ **가능** | Unified Balance (WUSD, WEUR), 입금 시 1:1 래핑 |
| 지갑·카드 연동 | ✅ **가능** | 카드가 사용자 지갑과 연결됨 |
| 본인 계좌 송금 | ✅ **가능** | Bank Accounts (SEPA/ACH), Recipients, Withdrawals |
| White Label | ✅ **가능** | 파트너 자격증명으로 자체 브랜드 UI 구축 |

**필요 API**:
- `GET /api/v1/wallet` — 잔액
- Cards API — 발급/관리/한도
- Bank/Recipients/Withdrawals — 송금
- KYC Hosted — 사용자 등록

---

### 2.2 기업용 카드 — **확인 필요 (부분 가능)**

| 요구사항 | 공개 문서상 | 비고 |
|----------|-------------|------|
| 회사 지갑 + 스테이블코인 | ⚠️ **문서 미확인** | 개인 User 중심, 기업 엔티티 별도 존재 여부 불명 |
| 회사 지갑·카드 연동 | ⚠️ **문서 미확인** | 개인 User→Card 연동만 확인됨 |
| 직원 카드별 한도 | ✅ **가능** | Card Limits API (`PUT /cards/{id}/limit`) |
| 직원 전용 내역 (카드별 마이웰렛) | ⚠️ **확인 필요** | Activity History가 user/card scope로 분리되는지 미확인 |
| 관리자 송금 | ✅ **가능** | Bank/Recipients (권한 분리는 구현 담당) |

**현재 문서로 확인된 것**:
- BaaS/Pay Partner: **개인 User** 단위 (1 user = 1 wallet = cards)
- Wirex Business 제품은 존재하나 (`business.wirexapp.com`), **BaaS API에 기업/조직 모델이 명시되어 있지 않음**
- 직원 카드 발급, 회사→직원 카드 한도 부여 등은 **별도 B2B/Corporate API**가 필요할 수 있음

---

## 3. 결론 및 제안

### 3.1 개인용 카드

**결론: API로 구현 가능**

- Wirex BaaS API로 요구사항 1~4 충족 가능
- White Label은 파트너 자격증명·온보딩 후 사용

### 3.2 기업용 카드

**결론: Wirex 확인 필요**

- **직원 카드별 한도**: Card Limits API로 처리 가능
- **직원별 사용 내역**: Activity History API가 card 단위 조회를 지원하는지 확인 필요
- **회사(Organization) 엔티티**: BaaS에 기업 계정/조직 모델이 있는지 문서·Wirex 담당자 확인 필요

**권장 절차**:
1. Wirex 영업/기술 담당자에게 **기업용(Business) BaaS 지원 여부** 문의
2. 조직(Company)→직원(Employee) 구조 및 권한 모델 확인
3. 기업용 API가 없다면, 개인 User를 조직·권한으로 묶어서 **자체 구현** 검토

---

## 4. 참고 출처

| 문서 | URL |
|------|-----|
| Wirex BaaS Platform | https://docs.wirexapp.com/docs/introduction |
| Wirex Pay Partner | https://partner.wirexpaychain.com/ |
| Business Cards (제품 소개) | https://www.wirexapp.com/business-cards |
| Card Limits | https://docs.wirexapp.com/docs/card-limits |
