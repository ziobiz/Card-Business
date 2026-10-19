import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiAuth } from '../session';

export default function AdminPassword() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setOk('');
    try {
      await apiAuth('/api/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) });
      setOk(t('auth.pwOk'));
      setCurrent('');
      setNext('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="panel" onSubmit={submit}>
      <h2>{t('shell.my')}</h2>
      <p className="hint">{t('auth.pwRule')}</p>
      {error ? <p className="banner-bad">{error}</p> : null}
      {ok ? <p>{ok}</p> : null}
      <div className="fields">
        <label>{t('auth.current')}<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
        <label>{t('auth.next')}<input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></label>
      </div>
      <button type="submit">{t('auth.savePw')}</button>
    </form>
  );
}
