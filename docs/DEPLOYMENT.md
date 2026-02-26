# 웹 배포 가이드

> 현재 웹만 배포합니다. 앱(Android/iOS)은 추후 예정입니다.

---

## 1. Web 배포

### Vercel

```bash
cd frontend
npm run build
# vercel deploy 또는 Vercel 대시보드에서 연동
```

### Netlify

```bash
cd frontend
npm run build
# netlify deploy --prod
# 또는 netlify.toml 설정
```

### 환경 변수

- `VITE_API_URL`: 백엔드 API Base URL (프로덕션)
- 배포 시 백엔드 CORS에 프론트엔드 도메인 추가

---

## 2. 체크리스트

- [ ] 백엔드 API URL 환경 변수 설정
- [ ] CORS 허용 도메인 설정
- [ ] HTTPS 적용
- [ ] 도메인 연결

---

## 3. 참고

- [Vite 배포](https://vitejs.dev/guide/static-deploy.html)
- [Wirex Supported Countries](https://partner.wirexpaychain.com/docs/supported-countries)

---

## 4. 추후: 앱 배포 (예정)

Android/iOS 앱 배포가 필요할 때는 Capacitor 등을 사용해 웹 앱을 패키징할 수 있습니다.  
현재는 웹 개발에 집중합니다.
