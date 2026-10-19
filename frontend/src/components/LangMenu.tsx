import { useEffect, useRef, useState } from 'react';
import { setLanguage, type LanguageCode } from '../i18n';
import { useTranslation } from 'react-i18next';

const LANGS: { code: LanguageCode; short: string; name: string }[] = [
  { code: 'ko', short: 'KR', name: '한국어' },
  { code: 'ja', short: 'JP', name: '日本語' },
  { code: 'en', short: 'US', name: 'English' },
  { code: 'zh', short: 'CH', name: '中文' },
  { code: 'th', short: 'TH', name: 'ไทย' },
];

export default function LangMenu({ variant = 'menu' }: { variant?: 'menu' | 'pill' }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((lang) => i18n.language.toLowerCase().startsWith(lang.code)) || LANGS[0];

  if (variant === 'pill') {
    return (
      <div className="lang-pill" role="group" aria-label="Language">
        {LANGS.map((lang) => (
          <button
            key={lang.code}
            type="button"
            className={lang.code === current.code ? 'on' : ''}
            onClick={() => setLanguage(lang.code)}
          >
            {lang.short}
          </button>
        ))}
      </div>
    );
  }

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="lang-menu" ref={ref}>
      <button type="button" className="lang-trigger" aria-expanded={open} aria-label="Language" onClick={() => setOpen((v) => !v)}>
        {current.short}
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <ul className="lang-list" role="listbox">
          {LANGS.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                className={lang.code === current.code ? 'on' : ''}
                onClick={() => {
                  setLanguage(lang.code);
                  setOpen(false);
                }}
              >
                <span>{lang.short}</span>
                <span>{lang.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
