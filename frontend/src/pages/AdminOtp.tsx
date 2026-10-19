import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { ApiError, apiMessage, homeFor, saveToken, type SessionAccount } from '../session';

export default function AdminOtp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const enroll = sessionStorage.getItem('cb_enroll') || '';

  useEffect(() => {
    if (!enroll) {
      navigate('/admin/login', { replace: true });
      return;
    }
    void fetch(`${API}/api/auth/otp/setup`, { method: 'POST', headers: { Authorization: `Bearer ${enroll}` } })
      .then(async (res) => {
        const data = (await res.json()) as { secret?: string; otpauth?: string; error?: string };
        if (!res.ok) throw new ApiError(apiMessage(data.error, res.status), res.status);
        setSecret(data.secret || '');
        setOtpauth(data.otpauth || '');
      })
      .catch((err: Error) => setError(err.message));
  }, [enroll, navigate]);

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/otp/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${enroll}` },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { token?: string; account?: SessionAccount; error?: string };
      if (!res.ok || !data.token || !data.account) throw new ApiError(apiMessage(data.error, res.status), res.status);
      sessionStorage.removeItem('cb_enroll');
      saveToken(data.token);
      navigate(homeFor(data.account.role), { replace: true });
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
          <div className="ac-logo"><img src="/brand/icocard-logo.png" alt="ICOCARD" /></div>
          <h2>{t('auth.enrollTitle')}</h2>
          <p>{t('auth.enrollLead')}</p>
          {error ? <div className="ac-error">{error}</div> : null}
          <p className="ac-secret">{secret}</p>
          {otpauth ? <p><a href={otpauth}>{t('auth.copy')}</a></p> : null}
          <form onSubmit={confirm}>
            <label className="ac-field ac-otp">{t('auth.otp')}
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" required />
            </label>
            <button className="ac-submit" type="submit" disabled={loading || code.length !== 6}>{loading ? t('auth.otpWait') : t('auth.confirm')}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
