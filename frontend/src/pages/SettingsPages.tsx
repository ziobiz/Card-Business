import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { levelCode, type OrgLevel } from '../levels';
import { apiAuth, isAuthError } from '../session';

type OrgNode = {
  id: string;
  name: string;
  level: OrgLevel;
  brandName?: string;
  logoUrl?: string;
  slug?: string;
  customDomain?: string;
  accentColor?: string;
  children: OrgNode[];
};

const ROLES = ['admin', 'accountant', 'general', 'operator'] as const;

function flatten(node: OrgNode): OrgNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

export function BrandPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tree, setTree] = useState<OrgNode | null>(null);
  const [orgId, setOrgId] = useState('');
  const [form, setForm] = useState({ brandName: '', logoUrl: '', slug: '', customDomain: '', accentColor: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const data = await apiAuth<{ tree: OrgNode }>('/api/overview');
    setTree(data.tree);
    setOrgId((current) => current || data.tree.id);
  };

  useEffect(() => {
    void load().catch((err: Error) => {
      setError(err.message);
      if (isAuthError(err)) navigate('/admin/login', { replace: true });
    });
  }, [navigate]);

  const orgs = useMemo(() => (tree ? flatten(tree) : []), [tree]);
  const selected = orgs.find((org) => org.id === orgId);

  useEffect(() => {
    if (!selected) return;
    setForm({
      brandName: selected.brandName || '',
      logoUrl: selected.logoUrl || '',
      slug: selected.slug || '',
      customDomain: selected.customDomain || '',
      accentColor: selected.accentColor || '',
    });
  }, [selected]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      await apiAuth(`/api/orgs/${orgId}`, { method: 'PATCH', body: JSON.stringify({ brand: form }) });
      setSaved(true);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!tree) return <p className="boot">{error || t('boot')}</p>;

  return (
    <form className="panel" onSubmit={save}>
      <h2>{t('menu.brand')}</h2>
      <p className="hint">{t('brand.lead')}</p>
      <p className="hint">{t('brand.inherit')}</p>
      {error ? <p className="banner-bad">{error}</p> : null}
      {saved ? <p className="hint">{t('brand.saved')}</p> : null}
      <div className="fields">
        <label>{t('reg.parent')}
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {orgs.map((org) => <option key={org.id} value={org.id}>{levelCode[org.level]} {org.name}</option>)}
          </select>
        </label>
        <label>{t('brand.name')}<input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></label>
        <label>{t('brand.logo')}<input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></label>
        <label>{t('brand.slug')}<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
        <label>{t('brand.domain')}<input value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} /></label>
        <label>{t('brand.accent')}<input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></label>
      </div>
      <p className="hint">{form.brandName || selected?.name || 'ICOCARD'}</p>
      <img src={form.logoUrl || '/brand/icocard-logo.png'} alt={form.brandName || 'ICOCARD'} style={{ maxHeight: 48, background: form.accentColor || 'transparent' }} />
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
