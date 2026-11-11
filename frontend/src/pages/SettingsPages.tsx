import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { API } from '../api';
import { assetUrl, type BrandView } from '../brandView';
import { levelCode, type OrgLevel } from '../levels';
import { apiAuth, authHeaders, isAuthError, apiMessage } from '../session';

type OrgNode = {
  id: string;
  name: string;
  level: OrgLevel;
  children: OrgNode[];
};

type StoredBrand = {
  brandMode: 'follow' | 'custom';
  brandName: string;
  logoUrl: string;
  loginLogoUrl: string;
  loginBackgroundUrl: string;
  faviconUrl: string;
  siteName: string;
  footerText: string;
  slug: string;
  customDomain: string;
  accentColor: string;
};

const emptyBrand: StoredBrand = {
  brandMode: 'follow', brandName: '', logoUrl: '', loginLogoUrl: '', loginBackgroundUrl: '',
  faviconUrl: '', siteName: '', footerText: '', slug: '', customDomain: '', accentColor: '',
};

const ROLES = ['admin', 'accountant', 'general', 'operator'] as const;

function flatten(node: OrgNode): OrgNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function fileName(value: string) {
  const clean = value.split('?')[0];
  return clean.slice(clean.lastIndexOf('/') + 1);
}

export function BrandPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tree, setTree] = useState<OrgNode | null>(null);
  const [orgId, setOrgId] = useState('');
  const [form, setForm] = useState<StoredBrand>(emptyBrand);
  const [shown, setShown] = useState<BrandView>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const loadTree = async () => {
    const data = await apiAuth<{ tree: OrgNode }>('/api/overview');
    setTree(data.tree);
    setOrgId((current) => current || data.tree.id);
  };

  useEffect(() => {
    void loadTree().catch((err: Error) => {
      setError(err.message);
      if (isAuthError(err)) navigate('/admin/login', { replace: true });
    });
  }, [navigate]);

  const orgs = useMemo(() => (tree ? flatten(tree) : []), [tree]);
  const selected = orgs.find((org) => org.id === orgId);
  const hq = selected?.level === 'hq';
  const custom = hq || form.brandMode === 'custom';

  useEffect(() => {
    if (!orgId) return;
    void apiAuth<{ stored: StoredBrand; shown: BrandView }>(`/api/orgs/${orgId}/brand`)
      .then((row) => {
        setForm(row.stored);
        setShown(row.shown);
      })
      .catch((err: Error) => setError(err.message));
  }, [orgId]);

  const set = (key: keyof StoredBrand, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      const row = await apiAuth<{ stored: StoredBrand; shown: BrandView }>(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        body: JSON.stringify({ brand: { ...form, brandMode: hq ? 'custom' : form.brandMode } }),
      });
      setForm(row.stored);
      setShown(row.shown);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const upload = async (kind: 'background' | 'loginLogo' | 'logo' | 'favicon', file: File) => {
    setError('');
    setSaved(false);
    const body = new FormData();
    body.set('kind', kind);
    body.set('file', file);
    const res = await fetch(`${API}/api/orgs/${orgId}/brand-file`, { method: 'POST', headers: authHeaders(), body });
    const data = await res.json() as { error?: string; stored?: StoredBrand; shown?: BrandView };
    if (!res.ok) throw new Error(apiMessage(data.error, res.status));
    if (data.stored) setForm(data.stored);
    if (data.shown) setShown(data.shown);
    setSaved(true);
  };

  const clearImage = async (key: 'logoUrl' | 'loginLogoUrl' | 'loginBackgroundUrl' | 'faviconUrl') => {
    const row = await apiAuth<{ stored: StoredBrand; shown: BrandView }>(`/api/orgs/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify({ brand: { [key]: '' } }),
    });
    setForm(row.stored);
    setShown(row.shown);
  };

  const fileField = (label: string, key: 'logoUrl' | 'loginLogoUrl' | 'loginBackgroundUrl' | 'faviconUrl', kind: 'background' | 'loginLogo' | 'logo' | 'favicon') => (
    <label className="brand-file">{label}
      <span>{form[key] ? fileName(form[key]) : ''}</span>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={!custom} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        void upload(kind, file).catch((err: Error) => setError(err.message));
      }} />
      {form[key] ? <img src={assetUrl(form[key])} alt="" /> : null}
      {custom && form[key] ? <button type="button" onClick={() => void clearImage(key).catch((err: Error) => setError(err.message))}>{t('brand.remove')}</button> : null}
    </label>
  );

  if (!tree) return <p className="boot">{error || t('boot')}</p>;

  return (
    <form className="panel" onSubmit={save}>
      <h2>{t('menu.brand')}</h2>
      <p className="hint">{t('brand.lead')}</p>
      <p className="hint">{t('brand.hqMode')}</p>
      <p className="hint">{t('brand.limit')}</p>
      {error ? <p className="banner-bad">{error}</p> : null}
      {saved ? <p className="hint">{t('brand.saved')}</p> : null}
      <div className="fields">
        <label>{t('reg.parent')}
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((org) => <option key={org.id} value={org.id}>{levelCode[org.level]} {org.name}</option>)}
          </select>
        </label>
        <label>{t('brand.mode')}
          <select value={hq ? 'custom' : form.brandMode} disabled={hq} onChange={(e) => set('brandMode', e.target.value)}>
            <option value="follow">{t('brand.follow')}</option>
            <option value="custom">{t('brand.custom')}</option>
          </select>
        </label>
        <label>{t('brand.siteName')}<input value={form.siteName} disabled={!custom} onChange={(e) => set('siteName', e.target.value)} /></label>
        <label>{t('brand.name')}<input value={form.brandName} disabled={!custom} onChange={(e) => set('brandName', e.target.value)} /></label>
        <label>{t('brand.footer')}<input value={form.footerText} disabled={!custom} onChange={(e) => set('footerText', e.target.value)} /></label>
        <label>{t('brand.accent')}<input value={form.accentColor} disabled={!custom} onChange={(e) => set('accentColor', e.target.value)} /></label>
        <label>{t('brand.slug')}<input value={form.slug} onChange={(e) => set('slug', e.target.value)} /></label>
        <label>{t('brand.domain')}<input value={form.customDomain} onChange={(e) => set('customDomain', e.target.value)} /></label>
      </div>
      {fileField(t('brand.background'), 'loginBackgroundUrl', 'background')}
      {fileField(t('brand.loginLogo'), 'loginLogoUrl', 'loginLogo')}
      {fileField(t('brand.menuLogo'), 'logoUrl', 'logo')}
      {fileField(t('brand.favicon'), 'faviconUrl', 'favicon')}
      <p className="hint">{t('brand.preview')}</p>
      <div className="brand-preview" style={{ backgroundImage: shown.loginBackgroundUrl ? `url(${assetUrl(shown.loginBackgroundUrl)})` : undefined }}>
        <img src={assetUrl(shown.loginLogoUrl || shown.logoUrl) || '/brand/icocard-logo.png'} alt={shown.brandName || 'ICOCARD'} />
        <strong>{shown.siteName || shown.brandName || 'ICOCARD'}</strong>
        <span>{shown.footerText}</span>
      </div>
      <button type="submit">{t('brand.save')}</button>
    </form>
  );
}

export function AccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [menus, setMenus] = useState<Record<string, string[]>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void apiAuth<{ catalog: string[]; menus: Record<string, string[]>; canEdit: boolean }>('/api/access')
      .then((row) => {
        setCatalog(row.catalog);
        setMenus(row.menus);
        setCanEdit(row.canEdit);
      })
      .catch((err: Error) => {
        setError(err.message);
        if (isAuthError(err)) navigate('/admin/login', { replace: true });
      });
  }, [navigate]);

  const toggle = (role: string, id: string) => {
    if (!canEdit || id === 'dashboard') return;
    setMenus((current) => {
      const list = current[role] || [];
      const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
      return { ...current, [role]: next };
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      const row = await apiAuth<{ menus: Record<string, string[]> }>('/api/access', { method: 'PUT', body: JSON.stringify({ menus }) });
      setMenus(row.menus);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!catalog.length) return <p className="boot">{error || t('boot')}</p>;

  return (
    <form className="panel access-panel" onSubmit={save}>
      <h2>{t('menu.access')}</h2>
      <p className="hint">{t('access.lead')}</p>
      {error ? <p className="banner-bad">{error}</p> : null}
      {saved ? <p className="hint">{t('access.saved')}</p> : null}
      <table className="desk-table access-matrix">
        <thead>
          <tr>
            <th>{t('access.menu')}</th>
            {ROLES.map((role) => <th key={role}>{t(`staff.${role}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {catalog.map((id) => (
            <tr key={id}>
              <td>{t(`menu.${id}`)}</td>
              {ROLES.map((role) => (
                <td key={role}>
                  <input type="checkbox" checked={(menus[role] || []).includes(id)} disabled={!canEdit || id === 'dashboard'} onChange={() => toggle(role, id)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit ? <button type="submit">{t('access.save')}</button> : null}
    </form>
  );
}

type PlatformOrg = {
  id: string;
  name: string;
  level: OrgLevel;
  slug: string;
  customDomain: string;
  loginHost: string;
  sslLink?: string;
};

type PlatformSettings = {
  publicHost: string;
  publicApiBase: string;
  sslCertPath: string;
  sslLeDomain: string;
  uiRefreshSec: number;
  contractDiskGb: number;
  contractTrafficGb: number;
  contractTrafficUsedGb: number;
  contractStart: string;
  contractEnd: string;
  note: string;
};

type ServerSummary = {
  generatedAt: string;
  uiRefreshSec: number;
  settings: PlatformSettings;
  host: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    cpuCount: number;
    cpuModel: string;
    memoryTotalMb: number;
    memoryAvailableMb: number;
    memoryUsedPct: number;
    uptimeSec: number;
  };
  process: {
    nodeVersion: string;
    pid: number;
    uptimeMs: number;
    heapUsedMb: number;
    heapTotalMb: number;
    heapUsedPct: number;
    rssMb: number;
    loadAverage: number;
  };
  disk: { pathRoot: string; usedPct: number; totalBytes: number; usedBytes: number };
  ssl: {
    status: string;
    subject?: string;
    issuer?: string;
    notAfter?: string;
    daysRemaining?: number | null;
    sanDnsNames?: string[];
    certPath?: string;
  };
  contract?: {
    diskGb: number;
    trafficGb: number;
    trafficUsedGb: number;
    start: string;
    end: string;
    daysLeft: number | null;
    diskUsedPct: number;
    trafficUsedPct: number;
  };
  health: Array<{ key: string; label: string; value: string; level: string }>;
  alerts: Array<{ level: string; message: string }>;
};

function meterLevel(pct: number): 'ok' | 'warn' | 'danger' | 'unknown' {
  if (!Number.isFinite(pct)) return 'unknown';
  if (pct >= 90) return 'danger';
  if (pct >= 70) return 'warn';
  return 'ok';
}

function sslRingLevel(days: number | null | undefined, status: string): 'ok' | 'warn' | 'danger' | 'unknown' {
  if (status === 'not_configured') return 'unknown';
  if (status === 'expired' || status === 'file_missing' || status === 'read_error') return 'danger';
  if (days == null) return 'unknown';
  if (days <= 14) return 'danger';
  if (days <= 30) return 'warn';
  return 'ok';
}

function RingGauge({
  label,
  pct,
  level,
  unit = '%',
  display,
}: {
  label: string;
  pct: number;
  level: 'ok' | 'warn' | 'danger' | 'unknown';
  unit?: string;
  display?: string | number;
}) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const offset = c - (clamped / 100) * c;
  const center = display != null ? String(display) : Number.isFinite(pct) ? String(Math.round(clamped)) : '—';
  return (
    <article className="srv-gauge">
      <p className="srv-gauge-title">{label}</p>
      <svg className="srv-ring" viewBox="0 0 100 100" aria-hidden>
        <circle className="srv-ring-bg" cx="50" cy="50" r={r} fill="none" strokeWidth="9" />
        <circle
          className={`srv-ring-${level}`}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        <text className="srv-ring-text" x="50" y="48" textAnchor="middle" dominantBaseline="middle">{center}</text>
        <text className="srv-ring-unit" x="50" y="64" textAnchor="middle">{unit}</text>
      </svg>
    </article>
  );
}

export function PlatformPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'server' | 'ssl' | 'contract' | 'domains'>('server');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isHq, setIsHq] = useState(false);
  const [data, setData] = useState<{
    publicHost: string;
    publicApiBase?: string;
    chainId: number;
    apiBase: string;
    settings?: PlatformSettings;
    orgs: PlatformOrg[];
  } | null>(null);
  const [server, setServer] = useState<ServerSummary | null>(null);
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [domainEdits, setDomainEdits] = useState<Record<string, string>>({});

  const loadPlatform = async () => {
    const row = await apiAuth<NonNullable<typeof data>>('/api/platform');
    setData(row);
    if (row.settings) setForm(row.settings);
    setDomainEdits(Object.fromEntries((row.orgs || []).map((o) => [o.id, o.customDomain || ''])));
  };

  const loadServer = async () => {
    try {
      const row = await apiAuth<ServerSummary>('/api/platform/server');
      setServer(row);
      setIsHq(true);
      if (row.settings) setForm(row.settings);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('hq_only') || msg.includes('403')) {
        setIsHq(false);
        return;
      }
      throw err;
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadPlatform();
        await loadServer();
      } catch (err) {
        setError((err as Error).message);
        if (isAuthError(err as Error)) navigate('/admin/login', { replace: true });
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!isHq || !form?.uiRefreshSec) return undefined;
    const sec = Math.max(15, Number(form.uiRefreshSec) || 120);
    const timer = window.setInterval(() => {
      void loadServer().catch(() => undefined);
    }, sec * 1000);
    return () => window.clearInterval(timer);
  }, [isHq, form?.uiRefreshSec]);

  const saveSettings = async () => {
    if (!form) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const row = await apiAuth<{ settings: PlatformSettings; server: ServerSummary }>('/api/platform/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setForm(row.settings);
      setServer(row.server);
      await loadPlatform();
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveOrgDomain = async (orgId: string) => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await apiAuth(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        body: JSON.stringify({ brand: { customDomain: (domainEdits[orgId] || '').trim().toLowerCase() } }),
      });
      await loadPlatform();
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!data || !form) return <p className="boot">{error || t('boot')}</p>;

  const pill = (level: string) => {
    if (level === 'danger') return 'support-portal_only';
    if (level === 'warn') return 'support-partial';
    if (level === 'ok') return 'support-api';
    return 'support-local';
  };

  return (
    <section className="panel support-portal">
      <h2>{t('menu.platform')}</h2>
      <div className="support-body">
        <p className="support-lead">{t('platform.lead')}</p>
        {error ? <p className="banner-bad">{error}</p> : null}
        {saved ? <p className="support-note">{t('platform.saved')}</p> : null}
        {!isHq ? <p className="support-note">{t('platform.hqOnly')}</p> : null}

        <div className="support-tabs">
          {([
            ['server', t('platform.tabServer')],
            ['ssl', t('platform.tabSsl')],
            ['contract', t('platform.tabContract')],
            ['domains', t('platform.tabDomains')],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'server' ? (
          <div className="support-block">
            <h3>{t('platform.tabServer')}</h3>
            <p className="support-note">{t('platform.serverLead')}</p>
            <div className="btn-row-left">
              <button type="button" className="btn-compact" disabled={busy || !isHq} onClick={() => void loadServer()}>{t('platform.refresh')}</button>
            </div>
            {server ? (() => {
              const loadPct = server.host.cpuCount > 0
                ? Math.min(100, (server.process.loadAverage / server.host.cpuCount) * 100)
                : 0;
              const sslDays = server.ssl.daysRemaining;
              const sslPct = sslDays == null ? 0 : Math.max(0, Math.min(100, (sslDays / 90) * 100));
              return (
                <>
                  <p className="support-note">{t('platform.generatedAt')}: {server.generatedAt}</p>
                  {server.alerts?.length ? (
                    <div className="support-table-wrap">
                      <table className="corp-steps-table">
                        <thead>
                          <tr><th>{t('platform.alerts')}</th><th>{t('platform.level')}</th></tr>
                        </thead>
                        <tbody>
                          {server.alerts.map((row, idx) => (
                            <tr key={`${row.message}-${idx}`}>
                              <td>{row.message}</td>
                              <td><span className={`support-pill ${pill(row.level)}`}>{row.level}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div className="srv-gauge-grid">
                    <RingGauge
                      label={t('platform.mem')}
                      pct={server.host.memoryUsedPct}
                      level={meterLevel(server.host.memoryUsedPct)}
                    />
                    <RingGauge
                      label={t('platform.disk')}
                      pct={server.disk.usedPct || 0}
                      level={server.disk.totalBytes ? meterLevel(server.disk.usedPct) : 'unknown'}
                    />
                    <RingGauge
                      label={t('platform.load')}
                      pct={loadPct}
                      level={meterLevel(loadPct)}
                      display={server.process.loadAverage.toFixed(1)}
                      unit=""
                    />
                    <RingGauge
                      label={t('platform.sslDays')}
                      pct={sslPct}
                      level={sslRingLevel(sslDays, String(server.ssl.status))}
                      display={sslDays != null ? sslDays : '—'}
                      unit="d"
                    />
                  </div>

                  <div className="support-table-wrap">
                    <table className="corp-cards-table">
                      <thead>
                        <tr>
                          <th>{t('platform.health')}</th>
                          <th>{t('platform.value')}</th>
                          <th>{t('platform.level')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {server.health.map((row) => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td>{row.value}</td>
                            <td><span className={`support-pill ${pill(row.level)}`}>{row.level}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="support-table-wrap">
                    <table className="corp-steps-table">
                      <thead>
                        <tr><th>{t('platform.host')}</th><th>{t('platform.value')}</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>{t('platform.hostname')}</td><td>{server.host.hostname}</td></tr>
                        <tr><td>{t('platform.os')}</td><td>{server.host.platform} {server.host.release} / {server.host.arch}</td></tr>
                        <tr><td>{t('platform.cpu')}</td><td>{server.host.cpuCount} · {server.host.cpuModel}</td></tr>
                        <tr><td>{t('platform.uptime')}</td><td>{Math.round(server.host.uptimeSec / 3600)}h</td></tr>
                        <tr><td>{t('platform.node')}</td><td>{server.process.nodeVersion} · pid {server.process.pid}</td></tr>
                        <tr><td>{t('platform.heap')}</td><td>{server.process.heapUsedPct}% ({server.process.heapUsedMb}/{server.process.heapTotalMb} MB)</td></tr>
                        <tr><td>{t('desk.chain')}</td><td>{data.chainId}</td></tr>
                        <tr><td>{t('platform.api')}</td><td>{data.apiBase}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })() : (
              <p className="support-note">{t('platform.hqOnly')}</p>
            )}
          </div>
        ) : null}

        {tab === 'ssl' ? (
          <div className="support-block">
            <h3>{t('platform.tabSsl')}</h3>
            <div className="support-fields" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <label>{t('platform.sslCertPath')}<input value={form.sslCertPath} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, sslCertPath: e.target.value })} placeholder="/etc/letsencrypt/live/.../fullchain.pem" /></label>
              <label>{t('platform.sslLeDomain')}<input value={form.sslLeDomain} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, sslLeDomain: e.target.value })} /></label>
              <label>{t('platform.autoRefresh')}<input type="number" min={15} max={3600} value={form.uiRefreshSec} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, uiRefreshSec: Number(e.target.value) })} /></label>
            </div>
            {server?.ssl ? (
              <div className="support-table-wrap">
                <table className="corp-steps-table">
                  <tbody>
                    <tr><th>{t('platform.sslStatus')}</th><td>{String(server.ssl.status)}</td></tr>
                    <tr><th>{t('platform.sslSubject')}</th><td>{server.ssl.subject || '—'}</td></tr>
                    <tr><th>{t('platform.sslIssuer')}</th><td>{server.ssl.issuer || '—'}</td></tr>
                    <tr><th>{t('platform.sslNotAfter')}</th><td>{server.ssl.notAfter || '—'}</td></tr>
                    <tr><th>{t('platform.sslDays')}</th><td>{server.ssl.daysRemaining ?? '—'}</td></tr>
                    <tr><th>{t('platform.sslSan')}</th><td>{(server.ssl.sanDnsNames || []).join(', ') || '—'}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="btn-row-left">
              <button type="button" className="btn-compact btn-save" disabled={!isHq || busy} onClick={() => void saveSettings()}>{t('platform.save')}</button>
              <button type="button" className="btn-compact" disabled={!isHq || busy} onClick={() => void loadServer()}>{t('platform.refresh')}</button>
            </div>
          </div>
        ) : null}

        {tab === 'contract' ? (
          <div className="support-block">
            <h3>{t('platform.tabContract')}</h3>
            <div className="support-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <label>{t('platform.diskGb')}<input type="number" min={0} step={0.1} value={form.contractDiskGb} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, contractDiskGb: Number(e.target.value) })} /></label>
              <label>{t('platform.trafficGb')}<input type="number" min={0} step={0.1} value={form.contractTrafficGb} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, contractTrafficGb: Number(e.target.value) })} /></label>
              <label>{t('platform.trafficUsedGb')}<input type="number" min={0} step={0.1} value={form.contractTrafficUsedGb} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, contractTrafficUsedGb: Number(e.target.value) })} /></label>
              <label>{t('platform.contractStart')}<input type="date" value={form.contractStart} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} /></label>
              <label>{t('platform.contractEnd')}<input type="date" value={form.contractEnd} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} /></label>
              <label>{t('platform.note')}<input value={form.note} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              <label>{t('platform.publicHost')}<input value={form.publicHost} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, publicHost: e.target.value })} /></label>
              <label>{t('platform.publicApi')}<input value={form.publicApiBase} disabled={!isHq || busy} onChange={(e) => setForm({ ...form, publicApiBase: e.target.value })} /></label>
            </div>
            <div className="btn-row-left">
              <button type="button" className="btn-compact btn-save" disabled={!isHq || busy} onClick={() => void saveSettings()}>{t('platform.save')}</button>
            </div>
          </div>
        ) : null}

        {tab === 'domains' ? (
          <div className="support-block">
            <h3>{t('platform.tabDomains')}</h3>
            <p className="support-note">{t('platform.domainsLead')}</p>
            <div className="support-table-wrap">
              <table className="corp-cards-table">
                <thead>
                  <tr>
                    <th>{t('reg.name')}</th>
                    <th>{t('brand.slug')}</th>
                    <th>{t('platform.customDomain')}</th>
                    <th>{t('platform.loginHost')}</th>
                    <th>{t('platform.sslLink')}</th>
                    <th>{t('platform.save')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orgs.map((org, idx) => (
                    <tr key={org.id} className={idx % 2 === 0 ? 'odd' : 'even'}>
                      <td>{levelCode[org.level]} {org.name}</td>
                      <td>{org.slug || '—'}</td>
                      <td>
                        <input
                          value={domainEdits[org.id] ?? ''}
                          disabled={busy || !isHq}
                          onChange={(e) => setDomainEdits({ ...domainEdits, [org.id]: e.target.value })}
                        />
                      </td>
                      <td>{org.loginHost}</td>
                      <td>
                        <span className={`support-pill ${org.sslLink === 'match' ? 'support-api' : org.sslLink === 'mismatch' ? 'support-portal_only' : 'support-local'}`}>
                          {org.sslLink === 'match' ? t('platform.match') : org.sslLink === 'mismatch' ? t('platform.mismatch') : t('platform.unknown')}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn-compact btn-save" disabled={busy || !isHq} onClick={() => void saveOrgDomain(org.id)}>
                          {t('platform.saveDomain')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
