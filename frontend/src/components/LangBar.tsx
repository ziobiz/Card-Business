import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';

export default function LangBar() {
  const { i18n } = useTranslation();
  return (
    <div className="lang-bar">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={i18n.language.startsWith(lang.code) ? 'on' : ''}
          onClick={() => setLanguage(lang.code)}
        >
          {lang.name}
        </button>
      ))}
    </div>
  );
}
