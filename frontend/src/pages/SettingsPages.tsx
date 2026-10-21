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
    <form className="panel" onSubmit={save}>
      <h2>{t('menu.access')}</h2>
      <p className="hint">{t('access.lead')}</p>
      {error ? <p className="banner-bad">{error}</p> : null}
      {saved ? <p className="hint">{t('access.saved')}</p> : null}
      <table className="desk-table">
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

export function PlatformPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [data, setData] = useState<{ publicHost: string; chainId: number; apiBase: string; orgs: Array<{ id: string; name: string; level: OrgLevel; slug: string; customDomain: string; loginHost: string }> } | null>(null);

  useEffect(() => {
    void apiAuth<NonNullable<typeof data>>('/api/platform')
      .then(setData)
      .catch((err: Error) => {
        setError(err.message);
        if (isAuthError(err)) navigate('/admin/login', { replace: true });
      });
  }, [navigate]);

  if (!data) return <p className="boot">{error || t('boot')}</p>;

  return (
    <section className="panel">
      <h2>{t('menu.platform')}</h2>
      <p className="hint">{t('platform.lead')}</p>
      <table className="desk-table">
        <tbody>
          <tr><th>{t('desk.domain')}</th><td>{data.publicHost}</td></tr>
          <tr><th>{t('desk.ssl')}</th><td>HTTPS</td></tr>
          <tr><th>{t('desk.chain')}</th><td>{data.chainId}</td></tr>
          <tr><th>{t('platform.api')}</th><td>{data.apiBase}</td></tr>
        </tbody>
      </table>
      <table className="desk-table">
        <thead>
          <tr>
            <th>{t('reg.name')}</th>
            <th>{t('brand.slug')}</th>
            <th>{t('brand.domain')}</th>
            <th>{t('platform.loginHost')}</th>
          </tr>
        </thead>
        <tbody>
          {data.orgs.map((org) => (
            <tr key={org.id}>
              <td>{levelCode[org.level]} {org.name}</td>
              <td>{org.slug}</td>
              <td>{org.customDomain}</td>
              <td>{org.loginHost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
