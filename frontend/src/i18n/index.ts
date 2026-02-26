import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import th from './locales/th.json';
import id from './locales/id.json';
import vi from './locales/vi.json';
import ms from './locales/ms.json';
import fil from './locales/fil.json';
import hi from './locales/hi.json';
import my from './locales/my.json';
import km from './locales/km.json';
import lo from './locales/lo.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'th', name: 'ไทย' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'fil', name: 'Filipino' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'my', name: 'မြန်မာ' },
  { code: 'km', name: 'ខ្មែរ' },
  { code: 'lo', name: 'ລາວ' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const STORAGE_KEY = 'app_lang';

function getInitialLanguage(): LanguageCode {
  const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
  if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) return stored;
  const browserLang = navigator.language.split('-')[0];
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang);
  return match ? match.code : 'en';
}

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
  th: { translation: th },
  id: { translation: id },
  vi: { translation: vi },
  ms: { translation: ms },
  fil: { translation: fil },
  hi: { translation: hi },
  my: { translation: my },
  km: { translation: km },
  lo: { translation: lo },
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => localStorage.setItem(STORAGE_KEY, lng));

export default i18n;
