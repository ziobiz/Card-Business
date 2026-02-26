import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Auth.css';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const apiBase =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');
    fetch(apiBase ? `${apiBase}/api/health` : '/api/health')
      .then((r) => r.json())
      .then((d) => setBackendOk(d?.ok === true))
      .catch(() => setBackendOk(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError(t('common.enterEmailPassword'));
      setLoading(false);
      return;
    }
    try {
      const { token } = await api.auth.login(trimmedEmail, trimmedPassword);
      localStorage.setItem('token', token);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-lang">
        <LanguageSwitcher />
      </div>
      <div className="auth-card card-surface">
        <h1 className="auth-title">{t('auth.login')}</h1>
        <p className="auth-subtitle">{t('auth.loginSubtitle')}</p>
        <form onSubmit={handleSubmit}>
          {backendOk === false && (
            <div className="auth-error">{t('common.backendUnavailable')}</div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <input
            type="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input auth-input"
          />
          <input
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input auth-input"
          />
          <button type="submit" disabled={loading || backendOk === false} className="btn-primary">
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>
        <p className="auth-footer">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="auth-link">
            {t('auth.goRegister')}
          </Link>
        </p>
      </div>
    </div>
  );
}
