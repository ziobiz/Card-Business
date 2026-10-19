import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Status = {
  apiBase?: string;
  chainId?: number;
  credentialsSet?: boolean;
  partnerIdSet?: boolean;
  tokenOk?: boolean;
  tokenError?: string;
  note?: string;
  configReachable?: boolean;
  configError?: string;
};

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3002';

export default function App() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/corporate/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus(await res.json());
    } catch (e) {
      setStatus(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page">
      <header className="top">
        <h1>{t('title')}</h1>
        <button type="button" onClick={() => i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko')}>
          {i18n.language === 'ko' ? 'EN' : '한국어'}
        </button>
      </header>
      <p className="lead">{t('lead')}</p>
      {loading ? <p>{t('loading')}</p> : null}
      {error ? <p className="bad">{error}</p> : null}
      {status ? (
        <dl className="status">
          <div><dt>{t('api')}</dt><dd>{status.apiBase}</dd></div>
          <div><dt>{t('chain')}</dt><dd>{status.chainId}</dd></div>
          <div><dt>{t('keys')}</dt><dd>{status.credentialsSet ? t('set') : t('missing')}</dd></div>
          <div><dt>{t('partner')}</dt><dd>{status.partnerIdSet ? t('set') : t('missing')}</dd></div>
          <div><dt>{t('token')}</dt><dd>{status.tokenOk ? t('ok') : t('fail')}</dd></div>
        </dl>
      ) : null}
      {status?.note ? <p>{status.note}</p> : null}
      {status?.tokenError ? <p className="bad">{status.tokenError}</p> : null}
      {status?.configError ? <p className="bad">{status.configError}</p> : null}
      <button type="button" onClick={() => void load()}>{t('refresh')}</button>
    </main>
  );
}
