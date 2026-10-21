import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LangMenu from './LangMenu';
import { assetUrl, useDocumentBrand } from '../brandView';
import { apiAuth, clearToken, type SessionAccount } from '../session';

type ShellTheme = 'dark' | 'default' | 'light';

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: 'M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z',
    company: 'M4 20V6l8-3 8 3v14M9 20v-5h6v5',
    service: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
    ops: 'M4 7h16M4 12h16M4 17h10',
    settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4',
  };
  return (
    <svg className="hq-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name] || paths.dashboard} />
    </svg>
  );
}

type Item = { to: string; label: string; id: string };
type Group = { id: string; label: string; items: Item[] };

const GROUPS: Group[] = [
  { id: 'company', label: 'menu.company', items: [{ to: '/admin/orgs', label: 'menu.orgs', id: 'orgs' }] },
  {
    id: 'service',
    label: 'menu.service',
    items: [
      { to: '/admin/risk', label: 'menu.risk', id: 'risk' },
      { to: '/admin/revenue', label: 'menu.revenue', id: 'revenue' },
      { to: '/admin/usage', label: 'menu.usage', id: 'usage' },
    ],
  },
  {
    id: 'ops',
    label: 'menu.ops',
    items: [
      { to: '/admin/fees', label: 'menu.fees', id: 'fees' },
      { to: '/admin/org-ops', label: 'menu.orgOps', id: 'orgOps' },
      { to: '/admin/users', label: 'menu.users', id: 'users' },
      { to: '/admin/activity', label: 'menu.activity', id: 'activity' },
    ],
  },
  {
    id: 'settings',
    label: 'menu.settings',
    items: [
      { to: '/admin/brand', label: 'menu.brand', id: 'brand' },
      { to: '/admin/access', label: 'menu.access', id: 'access' },
      { to: '/admin/platform', label: 'menu.platform', id: 'platform' },
      { to: '/admin/manual', label: 'menu.manual', id: 'manual' },
      { to: '/admin/link', label: 'menu.link', id: 'link' },
    ],
  },
];

const ROLE_MENUS: Record<string, string[]> = {
  hq: ['dashboard', 'orgs', 'risk', 'revenue', 'usage', 'fees', 'orgOps', 'users', 'activity', 'brand', 'access', 'platform', 'manual', 'link'],
  admin: ['dashboard', 'orgs', 'risk', 'revenue', 'usage', 'fees', 'orgOps', 'users', 'activity', 'access', 'manual'],
  accountant: ['dashboard', 'revenue', 'fees', 'activity', 'manual'],
  general: ['dashboard', 'orgs', 'users', 'usage', 'activity', 'manual'],
  operator: ['dashboard', 'usage', 'activity', 'manual'],
};

function allowedIds(account: SessionAccount) {
  if (account.role === 'hq') return ROLE_MENUS.hq;
  if (account.menus?.length) return account.menus;
  return ROLE_MENUS[account.staffRole || 'admin'] || ROLE_MENUS.admin;
}

export default function AdminShell() {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const navigate = useNavigate();
  const [account, setAccount] = useState<SessionAccount | null>(null);
  const [ip, setIp] = useState('');
  const [open, setOpen] = useState('');
  const [userOpen, setUserOpen] = useState(false);
  const [theme, setTheme] = useState<ShellTheme>(() => {
    const stored = localStorage.getItem('cb_shell_theme');
    return stored === 'default' || stored === 'light' || stored === 'dark' ? stored : 'dark';
  });
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('cb_sidebar') === '1');
  const [tablet, setTablet] = useState(() => localStorage.getItem('cb_tablet') === '1');
  const [now, setNow] = useState(() => new Date());
  const [tabs, setTabs] = useState<Item[]>([{ to: '/admin/dashboard', label: 'menu.dashboard', id: 'dashboard' }]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-shell-theme', theme);
    localStorage.setItem('cb_shell_theme', theme);
  }, [theme]);

  useEffect(() => {
    void apiAuth<{ account: SessionAccount; ip?: string }>('/api/session')
      .then((row) => {
        if (row.account.role === 'user') {
          navigate('/me', { replace: true });
          return;
        }
        setAccount(row.account);
        setIp(row.ip || '');
      })
      .catch(() => navigate('/admin/login', { replace: true }));
  }, [navigate]);

  const allow = useMemo(() => (account ? new Set(allowedIds(account)) : new Set<string>()), [account]);
  useDocumentBrand(account);
  const groups = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => allow.has(item.id)) })).filter((group) => group.items.length);
  const flat = [{ to: '/admin/dashboard', label: 'menu.dashboard', id: 'dashboard' }, ...groups.flatMap((group) => group.items)];

  useEffect(() => {
    const item = flat.find((row) => row.to === loc.pathname);
    if (!item || !allow.has(item.id)) return;
    setTabs((prev) => (prev.some((tab) => tab.to === item.to) ? prev : [...prev, item]));
    const group = groups.find((row) => row.items.some((it) => it.to === loc.pathname));
    if (group) setOpen(group.id);
  }, [loc.pathname, account?.role, account?.staffRole]);

  if (!account) return <p className="boot">{t('boot')}</p>;

  const current = flat.find((row) => row.to === loc.pathname);
  if (current && !allow.has(current.id)) return <p className="boot">{t('api.staff_forbidden')}</p>;
  const titleKey = current?.label || 'menu.dashboard';
  const groupKey = groups.find((row) => row.items.some((it) => it.to === loc.pathname))?.label;
  const intl: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', th: 'th-TH' };
  const weekday = new Intl.DateTimeFormat(intl[i18n.language.slice(0, 2)] || 'ko-KR', { weekday: 'short' }).format(now);
  const stamp = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, '0')}. ${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ${weekday}`;
  const roleLabel = account.role === 'hq' ? 'HQ' : t(`staff.${account.staffRole || 'admin'}`);
  const canCloseAll = tabs.filter((tab) => allow.has(tab.id)).length > 1;

  const closeAll = () => {
    setTabs([{ to: '/admin/dashboard', label: 'menu.dashboard', id: 'dashboard' }]);
    navigate('/admin/dashboard');
  };

  const themes: ShellTheme[] = ['dark', 'default', 'light'];
  const themeLabel: Record<ShellTheme, string> = {
    dark: t('shell.themeDark'),
    default: t('shell.themeDefault'),
    light: t('shell.themeLight'),
  };

  return (
    <div className={`hq-shell${collapsed ? ' is-collapsed' : ''}${tablet ? ' is-tablet' : ''}`}>
      <aside className="hq-side">
        <Link to="/admin/dashboard" className="hq-brand">
          <img src={assetUrl(account.logoUrl || account.loginLogoUrl) || (theme === 'light' ? '/brand/icocard-logo.png' : '/brand/icocard-logo-dark.png')} alt={account.brandName || 'ICOCARD'} />
        </Link>
        <div className="hq-fold-wrap">
          <button
            type="button"
            className="hq-fold"
            onClick={() => setCollapsed((value) => {
              const next = !value;
              localStorage.setItem('cb_sidebar', next ? '1' : '0');
              return next;
            })}
          >
            {collapsed ? '»' : `« ${t('shell.collapse')}`}
          </button>
        </div>
        <nav className="hq-nav">
          {allow.has('dashboard') ? (
            <NavLink to="/admin/dashboard" className={({ isActive }) => `hq-dash${isActive ? ' on' : ''}`}>
              <NavIcon name="dashboard" />
              <span className="hq-label">{t('menu.dashboard')}</span>
            </NavLink>
          ) : null}
          {groups.map((group) => {
            const active = group.items.some((item) => item.to === loc.pathname);
            return (
              <div key={group.id}>
                <button type="button" className={`hq-group-title${active ? ' is-active' : ''}`} onClick={() => setOpen(open === group.id ? '' : group.id)}>
                  <NavIcon name={group.id} />
                  <span className="hq-label">{t(group.label)}</span>
                  <span className="hq-caret">{open === group.id ? '∨' : '>'}</span>
                </button>
                {open === group.id ? (
                  <div className="hq-sub">
                    {group.items.map((item) => (
                      <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'on' : '')}>{t(item.label)}</NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="hq-main">
      <header className="hq-top">
        <div className="hq-session">
          <span className="hq-meta"><span className="hq-meta-label">{t('shell.template')}</span></span>
          <span className="theme-pill" role="group" aria-label={t('shell.template')}>
            {themes.map((id) => (
              <button key={id} type="button" className={theme === id ? 'on' : ''} onClick={() => setTheme(id)}>{themeLabel[id]}</button>
            ))}
          </span>
          <span className="hq-pipe">|</span>
          <label className="hq-meta">
            <span className="hq-meta-label">{t('shell.tablet')}</span>
            <button type="button" className={`hq-switch${tablet ? ' on' : ''}`} role="switch" aria-checked={tablet} onClick={() => setTablet((value) => { const next = !value; localStorage.setItem('cb_tablet', next ? '1' : '0'); return next; })}><i /></button>
          </label>
          <span className="hq-pipe">|</span>
          <LangMenu variant="pill" />
          <span className="hq-pipe">|</span>
          <span className="hq-meta"><span className="hq-meta-label">{t('shell.ip')}</span><span className="hq-colon">:</span><b>{ip || '—'}</b></span>
          <span className="hq-pipe">|</span>
          <span className="hq-meta">
            <span className="hq-badge clock" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="8" />
                <path strokeLinecap="round" d="M12 8v4l2.5 1.5" />
              </svg>
            </span>
            <span className="hq-meta-label">{t('shell.time')}</span><span className="hq-colon">:</span><b>{stamp}</b>
          </span>
        </div>
        <span className="hq-pipe">|</span>
        <div className="hq-user">
            <button type="button" className="hq-user-btn" onClick={() => setUserOpen((v) => !v)}>
              <span className="hq-badge" aria-hidden>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 17h14v-1.2H3V17zm1.2-2.4h11.6V5.5A1.3 1.3 0 0014.5 4.2H5.5A1.3 1.3 0 004.2 5.5v9.1zM7 7h1.4v1.4H7V7zm0 2.8h1.4v1.4H7V9.8zm3.2-2.8H11.6v1.4H10.2V7zm0 2.8H11.6v1.4H10.2V9.8z" />
                </svg>
              </span>
              <span className="hq-label">{account.orgName || t('shell.roleHq')} | {roleLabel}</span>
              <svg className="hq-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {userOpen ? (
              <div className="hq-user-menu">
                <button type="button" onClick={() => { setUserOpen(false); navigate('/admin/me'); }}>{t('shell.my')}</button>
                <button type="button" onClick={() => { clearToken(); window.location.replace('/admin/login'); }}>{t('shell.logout')}</button>
              </div>
            ) : null}
          </div>
          <button type="button" className={`hq-close${canCloseAll ? ' is-on' : ''}`} disabled={!canCloseAll} onClick={closeAll}><span>×</span> {t('shell.closeAll')}</button>
      </header>
      <div className="hq-tabbar">
        {tabs.filter((tab) => allow.has(tab.id)).map((tab) => (
          <span key={tab.to} className={`hq-tab${loc.pathname === tab.to ? ' on' : ''}`}>
            <Link to={tab.to}>{t(tab.label)}</Link>
            <button
              type="button"
              aria-label="close"
              onClick={() => {
                setTabs((prev) => {
                  const next = prev.filter((row) => row.to !== tab.to);
                  if (loc.pathname === tab.to) navigate((next[next.length - 1] || { to: '/admin/dashboard' }).to);
                  return next.length ? next : [{ to: '/admin/dashboard', label: 'menu.dashboard', id: 'dashboard' }];
                });
              }}
            >×</button>
          </span>
        ))}
      </div>
          <div className="hq-body">
          <div className="hq-frame">
          <div className="hq-crumbbar">
            <h1>{t(titleKey)}</h1>
            <nav className="hq-crumb">{groupKey ? `${t(groupKey)} > ${t(titleKey)}` : (account.orgName || t('shell.roleHq'))}</nav>
          </div>
          <div className="hq-page"><Outlet /></div>
          </div>
          </div>
          {account.footerText ? <footer className="hq-foot">{account.footerText}</footer> : null}
      </div>
    </div>
  );
}
