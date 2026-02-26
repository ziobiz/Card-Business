# Wirex Card Business - 기업용 카드 발급

**기업용** 카드 발급 웹 서비스입니다.  
회사 지갑, 직원 카드(가상/물리), 일일/라이프 한도, 관리자 송금.

> 배포 시 **별도 도메인** 사용 (예: card-business.example.com)

## 실행 방법

**백엔드와 프론트엔드를 둘 다 실행해야 합니다.**

### 1. 백엔드

```bash
cd backend
npm install
npm run dev
```

→ http://localhost:3002

### 2. 프론트엔드 (새 터미널)

```bash
cd frontend
npm install
npm run dev
```

→ http://localhost:4000

### 3. 사용

1. 회원가입 → 로그인 (관리자 계정)
2. 가상 카드 또는 물리 카드 발급
3. 발급 후 한도 부여 (일일 한도 / 라이프 한도)
4. 카드 충전, 한도 변경, 직원별 카드 관리

## 기업용 전용 기능

- **가상 카드 + 물리 카드** 발급
- **일일 한도**: 매일 00:00 리셋
- **라이프 한도**: 할당한 금액을 소진할 때까지 사용
- 카드 생성 → 한도 부여 플로우
- 회사 지갑 충전
- (추후) Transfers, Activity, 직원 관리

## 프로젝트 구조

```
Card-Business/
├── backend/     # Express + Mock Wirex (plastic, limitType, simulate-spend)
├── frontend/    # React + Vite
├── docs/
└── samples/
```

## API 예시

```
POST /api/cards/virtual    # 가상 카드
POST /api/cards/plastic    # 물리 카드
PUT  /api/cards/:id/limit  # Body: { limit, limitType: "daily"|"lifetime" }
POST /api/cards/:id/simulate-spend  # 테스트용 사용 시뮬레이션
```

## 참고

- [API 참조](docs/API_REFERENCE.md)
- [Business 사이트 분석](docs/BUSINESS_WIREX_ANALYSIS.md)
