import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import LanguageSwitcher from './LanguageSwitcher';
import './Layout.css';

export default function Layout() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-brand">
          {t('nav.brand')}
        </Link>
        <nav className="layout-nav">
          <Link to="/" className="nav-link">
            {t('nav.home')}
          </Link>
          <Link to="/cards" className="nav-link">
            {t('nav.cards')}
          </Link>
          <LanguageSwitcher />
          <button onClick={handleLogout} className="btn-logout">
            {t('nav.logout')}
          </button>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
