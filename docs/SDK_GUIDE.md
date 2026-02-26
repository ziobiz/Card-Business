# Wirex Pay SDK 설치 및 사용 가이드

> 공식 문서: https://partner.wirexpaychain.com/docs/installation-and-setup

---

## 1. 설치

```bash
npm install wirex-pay-sdk
```

---

## 2. 초기화 (Initialization)

```typescript
import { WirexPay } from 'wirex-pay-sdk';

const config = {
  token: 'your-user-specific-token',  // JWT 또는 사용자별 토큰
  subscribeToSocket: true,            // WebSocket 실시간 업데이트 (선택)
  socketUrl?: string,                  // WebSocket URL (선택)
  apiUrl?: string                      // API Base URL (선택)
};

WirexPay.init(config);
```

---

## 3. Cards API (카드 서비스)

### 3.1 카드 목록 조회

```typescript
WirexPay.card.getCards(1, 10)
  .then(response => console.log('Cards list:', response))
  .catch(error => console.error('Error:', error));
```

### 3.2 가상 카드 발급

```typescript
WirexPay.card.createVirtualCard()
  .then(card => console.log('Virtual card issued:', card))
  .catch(error => console.error('Error:', error));
```

### 3.3 플라스틱 카드 발급

```typescript
WirexPay.card.createPlasticCard(request)
  .then(card => console.log('Plastic card issued:', card))
  .catch(error => console.error('Error:', error));
```

### 3.4 카드 활성화

```typescript
WirexPay.card.activateCard('cardId123', activateRequest)
  .then(() => console.log('Card activated'))
  .catch(error => console.error('Error:', error));
```

### 3.5 카드 차단 / 해제

```typescript
WirexPay.card.blockCard('cardId123')
  .then(() => console.log('Card blocked'))
  .catch(error => console.error('Error:', error));

WirexPay.card.unblockCard('cardId123')
  .then(() => console.log('Card unblocked'))
  .catch(error => console.error('Error:', error));
```

### 3.6 카드 한도 설정

```typescript
WirexPay.card.setCardLimit('cardId123', { limit: 5000 })
  .then(() => console.log('Limit set successfully'))
  .catch(error => console.error('Error:', error));
```

### 3.7 카드 변경 이벤트 구독 (WebSocket)

```typescript
WirexPay.card.subscribeToCardsChange((cards) => {
  console.log('Updated cards array', cards);
});
```

---

## 4. User API (사용자 서비스)

### 4.1 사용자 정보 조회

```typescript
WirexPay.user.getUserInfo()
  .then(response => console.log('User info:', response))
  .catch(error => console.error('Error:', error));
```

### 4.2 전화번호 업데이트

```typescript
WirexPay.user.updatePhoneNumber(request)
  .then(() => console.log('Phone updated'))
  .catch(error => console.error('Error:', error));
```

### 4.3 KYC 검증 링크 생성

```typescript
WirexPay.user.getVerificationLink()
  .then(response => console.log('Verification link:', response))
  .catch(error => console.error('Error:', error));
```

### 4.4 사용자 변경 이벤트 구독

```typescript
WirexPay.user.subscribeToUserChange((userData) => {
  console.log('User data changed:', userData);
});
```

---

## 5. 권한/토큰 흐름

### Option A: 백엔드에서 API 호출 (권장)

```
1. Backend: client_id/secret으로 JWT 발급
2. Backend: 요청 시 X-User-Id 또는 X-User-Email 헤더 추가
3. Backend: Wirex API 직접 호출 또는 SDK 사용
```

### Option B: 클라이언트에서 직접 호출

```
1. Backend: Authorize User API로 사용자별 토큰 발급
2. Frontend: 사용자 토큰으로 WirexPay.init() 후 SDK 호출
3. client_id/secret은 절대 클라이언트에 노출 금지
```

---

## 6. SDK Method ↔ API 매핑

| SDK Method | API Endpoint |
|------------|--------------|
| `card.getCards(page, size)` | GET /api/v1/cards |
| `card.createVirtualCard()` | POST /api/v1/cards/virtual |
| `card.createPlasticCard(req)` | POST /api/v1/cards/plastic |
| `card.activateCard(id, req)` | PUT /api/v1/cards/{id}/activate |
| `card.blockCard(id)` | PUT /api/v1/cards/{id}/block |
| `card.unblockCard(id)` | PUT /api/v1/cards/{id}/unblock |
| `card.closeCard(id)` | PUT /api/v1/cards/{id}/close |
| `card.setCardLimit(id, req)` | PUT /api/v1/cards/{id}/limit |
| `user.getUserInfo()` | GET /api/v1/user |

---

## 7. 참고 링크

- [설치 및 설정](https://partner.wirexpaychain.com/docs/installation-and-setup)
- [Cards 문서](https://partner.wirexpaychain.com/docs/cards-1)
- [User 문서](https://partner.wirexpaychain.com/docs/user-service)
- [Wirex Pay Gen2](https://partner.wirexpaychain.com/docs/wirex-pay-gen2)
