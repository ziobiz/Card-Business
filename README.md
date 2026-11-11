# Card-Business — 회사 카드

> **이 폴더·저장소는 Card-Business 전용입니다.**  
> GitHub: `https://github.com/ziobiz/Card-Business.git` (`origin`만 사용)  
> 서버: `162.35.169.201` / `business.icocard.net`  
> 복원 시점: `2f2c3db` (수기 마감·일일 한도 계산 개발 직전)  
> **OTLCARD**(`D:\Delopment\OTLCARD`, `162.220.11.183`, `wirex`/`me`)와 코드·키·배포·Git 원격을 섞지 마세요. 다른 프로젝트입니다.

회사 지갑 하나와 직원 카드. [Wirex Corporate API](https://docs.wirexapp.com/docs/corporate-cards) 기준입니다.

개인 카드(`D:\Delopment\Card-Personal`, icocard.net)와 저장소, 서버, API 키를 공유하지 않습니다.

- 로컬: 이 폴더를 Cursor에서 연다. 백엔드 `3002`, 프론트 `4000`
- 개발 서버: `business.icocard.net` (`162.35.169.201`, Ubuntu 22.04)
- API: `https://api-business.wirexapp.tech` (Sandbox, chain 84532)
- 키: Corporate용 `client_id`, `client_secret`, `partner_id`. 개인 카드 키는 사용할 수 없다. 저장소 루트 `.env` 에 넣는다

키를 넣기 전에는 설정 API 연결은 성공하고, 파트너 토큰은 실패하는 것이 정상입니다.

## Support Portal

Wirex Partner Support Portal 가이드(`docs/support-portal-guide.pdf`)를 기준으로  
관리 화면 **운영관리 → Support Portal** (`/admin/support`) 에 Verification / Cards / Statements 를 두었습니다.

- Corporate API로 가능한 일(명세서·카드 관리·KYB 상태)과 Portal 전용(차지백·오프보드·주소지 대리 업로드)을 표로 구분합니다.
- User ID 검색은 우선 로컬 조직 데이터를 조회합니다. 법인 토큰이 생기면 Wirex 실호출을 이어서 붙입니다.

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

### 3. 확인

http://localhost:4000/admin/login 에서 관리 화면을 엽니다. Wirex 연결 상태는 API 연동 화면에서 확인합니다.

## 개발 서버

앱은 `/opt/card-business` 에 있습니다. 백엔드는 systemd `card-business` 가 `127.0.0.1:3002` 에서 실행하고, Nginx가 `https://business.icocard.net` 으로 화면과 `/api` 를 엽니다.

```bash
systemctl status card-business
journalctl -u card-business -n 50 --no-pager
```

키는 서버의 `/opt/card-business/.env` 에만 넣습니다. 넣은 뒤 `cd /opt/card-business/backend && npm run build && systemctl restart card-business` 입니다.

## 프로젝트 구조

```
Card-Business/
├── backend/     # Express. Corporate 설정·파트너 토큰 확인
└── frontend/    # React + Vite. 관리 화면
```

운영관리 → **법인관리** (`/admin/corp`) 에서 Wirex Corporate 온보딩·직원·카드를 진행합니다.  
온체인 지갑 배포는 Wirex 문서 순서대로 외부에서 끝낸 뒤, 이 화면에서 API 등록·로그인·KYB·발급을 합니다.  
Wirex lifetime 한도는 API로 설정할 수 없고, 평생 한도는 남은 금액으로 `daily_limit` 를 갱신합니다.
