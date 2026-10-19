import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import koUi from './locales/ui/ko.json';
import enUi from './locales/ui/en.json';
import jaUi from './locales/ui/ja.json';
import thUi from './locales/ui/th.json';
import zhUi from './locales/ui/zh.json';
import shellPack from './shellPack';
import menuPack from './menuPack';

export const SUPPORTED_LANGUAGES = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'th', name: 'ไทย' },
  { code: 'zh', name: '中文' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('cb_lang') : null;
const initial = SUPPORTED_LANGUAGES.some((lang) => lang.code === saved) ? saved! : 'ko';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: { ...ko, ...koUi } },
    en: { translation: { ...en, ...enUi } },
    ja: { translation: jaUi },
    th: { translation: thUi },
    zh: { translation: zhUi },
  },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

for (const lang of Object.keys(shellPack) as LanguageCode[]) {
  i18n.addResourceBundle(lang, 'translation', shellPack[lang], true, true);
  i18n.addResourceBundle(lang, 'translation', menuPack[lang], true, true);
}

if (typeof document !== 'undefined') document.documentElement.lang = initial;

export function setLanguage(code: LanguageCode) {
  localStorage.setItem('cb_lang', code);
  document.documentElement.lang = code;
  void i18n.changeLanguage(code);
}

export default i18n;
