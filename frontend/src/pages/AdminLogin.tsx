import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangMenu from '../components/LangMenu';
import { API } from '../api';
import { ApiError, apiMessage, homeFor, saveToken, type SessionAccount } from '../session';

type LoginResult = {
  token?: string;
  account?: SessionAccount;
  mustSetupOtp?: boolean;
  enrollToken?: string;
  otpRequired?: boolean;
  pendingToken?: string;
  error?: string;
};

export default function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState({ name: 'ICOCARD', logoUrl: '', accentColor: '' });

  useEffect(() => {
    const host = window.location.hostname;
    void fetch(`${API}/api/brand?host=${encodeURIComponent(host)}`)
      .then((res) => res.json() as Promise<{ name?: string; logoUrl?: string; accentColor?: string }>)
      .then((row) => setBrand({ name: row.name || 'ICOCARD', logoUrl: row.logoUrl || '', accentColor: row.accentColor || '' }))
      .catch(() => undefined);
  }, []);

  const finish = (row: LoginResult) => {
    if (!row.token || !row.account) return;
    saveToken(row.token);
    navigate(homeFor(row.account.role), { replace: true });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (pending) {
        const res = await fetch(`${API}/api/auth/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pending}` },
          body: JSON.stringify({ code: otp }),
        });
        const data = (await res.json()) as LoginResult;
        if (!res.ok) throw new ApiError(apiMessage(data.error, res.status), res.status);
        finish(data);
        return;
      }
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json()) as LoginResult;
      if (!res.ok) throw new ApiError(apiMessage(data.error, res.status), res.status);
      if (data.mustSetupOtp && data.enrollToken) {
        sessionStorage.setItem('cb_enroll', data.enrollToken);
        navigate('/admin/otp', { replace: true });
        return;
      }
      if (data.otpRequired && data.pendingToken) {
        setPending(data.pendingToken);
        setOtp('');
        return;
      }
      finish(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ac-chrome">
      <div className="ac-hero" style={{ backgroundImage: 'url(/brand/admin-login-wave-default.jpg)' }} />
      <div className="ac-panel">
        <div className="ac-panel-inner">
          <div className="ac-lang"><LangMenu /></div>
          <div className="ac-logo"><img src={brand.logoUrl || '/brand/icocard-logo.png'} alt={brand.name} /></div>
          <section className="ac-notice">
            <h3>{t('auth.noticeTitle')}</h3>
            <p>{t('auth.noticeBody')}</p>
          </section>
          <form onSubmit={submit}>
            {error ? <div className="ac-error">{error}</div> : null}
            <label className="ac-field">{t('auth.email')}
              <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required readOnly={Boolean(pending)} />
            </label>
            <label className="ac-field">{t('auth.password')}
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required readOnly={Boolean(pending)} />
            </label>
            {pending ? (
              <label className="ac-field ac-otp">{t('auth.otp')}
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
                <small>{t('auth.otpHint')}</small>
              </label>
            ) : null}
            <button className="ac-submit" type="submit" disabled={loading} style={brand.accentColor ? { background: brand.accentColor } : undefined}>{loading ? t('auth.wait') : t('auth.submit')}</button>
          </form>
          <p className="ac-copy">{brand.name}</p>
        </div>
      </div>
    </div>
  );
}
