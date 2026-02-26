# Wirex Business (business.wirexapp.com) MCP 분석 보고서

> **분석일**: 2026-02  
> **방법**: Cursor MCP (cursor-ide-browser) 기반 실사용 화면 분석  
> **상태**: 로그인 후 대시보드 확인 완료

---

## 1. 분석 대상 기업용 카드 기능

| No | 요구 기능 | 분석 목적 |
|----|-----------|-----------|
| 1 | 회사 지갑 + 스테이블코인 충전 | 기업 단위 지갑·충전 지원 여부 |
| 2 | 회사 지갑·카드 연동 | 기업 지갑과 카드 연결 구조 |
| 3 | 직원 카드별 한도 / 사용 내역 | 직원별 카드 한도·내역 UI |
| 4 | 관리자 송금 | 회사/타인 계좌 송금 기능 |

---

## 2. MCP 브라우저로 확인된 UI 구조 (로그인 후)

### 2.1 대시보드 (Home)

| 항목 | 확인 내용 |
|------|-----------|
| **Total Balance** | 회사 총 잔액 표시 |
| **+ Deposit / Add Funds** | 스테이블코인 입금 기능 |
| **All assets** | US Dollar (USD), Euro (EUR) |
| **Activity** | Visa Provisioning Service 카드 3장 (VISA ·· 3436), 각 $0 |
| **APY 5%** | 잔액에 대한 수익률 |
| **Claimable / Statement** | 수익 청구, 거래 명세서 |
| **Base 체인** | `0x03bAF6...D7ab04` (블록체인 연동) |

### 2.2 네비게이션

- **Home** – 대시보드
- **Cards** – 카드 관리
- **Transfers** – 송금
- **Activity** – 활동 내역

### 2.3 라우트 검증 결과

| 경로 | 결과 |
|------|------|
| `/dashboard` | ✅ 정상 (기본 진입) |
| `/card` | ✅ 정상 (직원 카드 목록) |
| `/transfer` | ✅ 정상 (송금·수취인 관리) |
| `/activity` | ✅ 정상 (거래 내역) |

---

### 2.4 Cards 탭 (`/card`) — MCP 직접 확인 완료

| 항목 | 확인 내용 |
|------|-----------|
| **직원별 카드 목록** | Tath Kositanont, Byoungsun Yi, takeda hiroshi, don, STAFF OTL JP, fujita henju 등 **6명 이상** |
| **카드 유형** | Plastic Card 1장, Virtual Card 6장 (VISA ·· 1160, 3436, 8119, 5932, 7440, 1004) |
| **Order card** | 신규 카드 발급 버튼 |
| **Type 정렬** | 카드 유형별 정렬 기능 |
| **상태 아이콘** | ✅ 활성, ⏳ 대기, 🔵 기타 등 카드별 상태 표시 |
| **한도 설정** | 카드 행 클릭 시 상세·한도 화면 노출 여부 확인 필요 (개별 카드 상세 미확인) |

### 2.5 Transfers 탭 (`/transfer`) — MCP 직접 확인 완료

| 항목 | 확인 내용 |
|------|-----------|
| **Add Recipient** | 수취인 추가 |
| **Batch Send** | 일괄 송금 |
| **Send** | 단일 송금 |
| **수취인 목록** | "No Recipients - Your future Recipients will be shown here" (초기 상태) |

### 2.6 Activity 탭 (`/activity`) — MCP 직접 확인 완료

| 항목 | 확인 내용 |
|------|-----------|
| **Statement** | 거래 명세서 생성/다운로드 |
| **카드별 활동** | Visa Provisioning Service, VISA ·· 3436 등 **카드 단위** 표시 |
| **날짜별 정렬** | 2026-02-03, 2025-10-22 등 날짜 그룹 |
| **금액 표시** | $0 (Provisioning 이벤트 위주, 실제 결제 내역은 추후 확인 필요) |

---

## 3. 기업용 카드 기능 지원 유무 요약 (검증 결과)

| 기능 | 지원 여부 | 비고 |
|------|-----------|------|
| **회사 지갑 + 스테이블코인 충전** | ✅ **지원** | Total Balance, Add Funds, USD/EUR |
| **회사 지갑·카드 연동** | ✅ **지원** | 직원별 카드 7장, 지갑 잔액과 연동 |
| **직원 카드 발급/관리** | ✅ **지원** | Order card, 직원별 Plastic/Virtual 카드 목록 |
| **직원별 사용 내역** | ✅ **지원** | Activity에서 카드별(VISA ·· 3436 등) 내역 표시 |
| **관리자 송금** | ✅ **지원** | Add Recipient, Batch Send, 단일 Send |
| **직원 카드별 한도** | ⚠️ **추가 확인** | 카드 행 클릭 시 한도 설정 화면 노출 여부는 미확인 |

---

## 4. 진행 가능 여부 결론

### 4.1 진행 가능한 부분

- **회사 지갑·스테이블코인 충전**: UI와 기능 확인됨
- **회사 지갑·카드 연동**: Visa Provisioning Service 기반 직원별 카드 7장 확인
- **직원 카드 발급**: Order card로 신규 카드 발급
- **직원별 사용 내역**: Activity 탭에서 카드별 내역 표시
- **관리자 송금**: Add Recipient, Batch Send 지원
- **블록체인 연동**: Base 체인 주소 표시
- **수익·명세**: APY, Claimable, Statement 버튼 존재

### 4.2 추가 확인 필요한 부분

1. **직원 카드 한도**: 개별 카드 상세 화면에서 한도 설정 UI 존재 여부
2. **직원 권한**: 직원이 자신의 카드만 보는지, 관리자가 전 카드를 보는지 권한 모델

### 4.3 권장 사항

1. Cards 탭에서 **개별 카드 행 클릭** → 상세 화면에 한도 설정 UI가 있는지 확인
2. Wirex BaaS 문서에서 **Card Limits API** (`PUT /cards/{id}/limit`) 기업용 지원 여부 확인

---

## 5. MCP 구성

### 5.1 프로젝트 MCP 설정

- **파일**: `.cursor/mcp.json`
- **서버**: `@playwright/mcp-server` (브라우저 자동화)

### 5.2 Business 사이트 리소스

- **파일**: `mcps/wirex-business.json`
- **URL**: https://business.wirexapp.com

### 5.3 분석 절차 (Cursor Agent)

1. `browser_navigate` → https://business.wirexapp.com (로그인 필수)
2. `browser_snapshot` → 페이지 구조·요소 확인
3. Cards / Transfers / Activity 탭 클릭 후 스냅샷 재수집
4. 결과를 본 문서에 반영

---

## 6. 참고

- [Wirex Business 제품](https://business.wirexapp.com/)
- [Wirex BaaS 문서](https://docs.wirexapp.com/docs/introduction)
- [요구사항·API 매핑](FEATURE_REQUIREMENTS_AND_API_ANALYSIS.md)
