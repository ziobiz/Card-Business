# 개발 가이드라인

> 웹 중심 개발, 다국어 지원을 위한 유의사항

---

## 1. 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **웹 우선** | 현재는 웹으로만 구현, 반응형으로 모바일 브라우저 대응 |
| **다국어 필수** | 사용자 노출 텍스트는 반드시 i18n 키 사용, 하드코딩 금지 |
| **반응형** | 작은 화면 우선 설계, 다양한 디바이스 대응 |

---

## 2. 다국어 (i18n)

### 규칙

- **UI 문자열**: `t('namespace.key')` 사용
- **하드코딩 금지**: `"로그인"` ❌ → `t('auth.login')` ✅
- **새 키 추가**: `src/i18n/locales/` 에 ko, en, ja 모두 추가

### 예시

```tsx
// ❌ 잘못된 예
<button>로그인</button>

// ✅ 올바른 예
const { t } = useTranslation();
<button>{t('auth.loginButton')}</button>
```

### 새 언어 추가

1. `src/i18n/locales/{code}.json` 생성 (en.json 구조 참고)
2. `src/i18n/index.ts` 에 import 및 `SUPPORTED_LANGUAGES` 추가

---

## 3. 반응형 / 모바일

### 규칙

- **Touch target**: 버튼·링크 최소 44×44px (Apple HIG)
- **Safe area**: `env(safe-area-inset-*)` 적용 (노치, 홈 인디케이터)
- **Breakpoints**: 320px → 480px → 768px → 1024px

### CSS 변수

```css
/* index.css :root */
--safe-area-inset-top
--safe-area-inset-bottom
--color-primary, --color-muted, ...
```

---

## 4. 앱 패키징 (Capacitor)

- Web 빌드 결과(`dist/`)를 그대로 사용
- Native 기능(카메라, 푸시 등) 필요 시 `@capacitor/...` 플러그인 사용
- `capacitor.config.json` 에 `appId`, `appName` 설정

---

## 5. 새 기능 개발 시 체크리스트

- [ ] 모든 사용자 노출 문구 i18n 적용
- [ ] 반응형(모바일·데스크톱)에서 레이아웃 확인
- [ ] `npm run build` 성공
- [ ] 새 i18n 키는 모든 언어 파일에 추가 (현재 12개)
