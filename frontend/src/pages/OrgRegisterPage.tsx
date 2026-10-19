import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { childCode, levelCode, type OrgLevel } from '../levels';
import { apiAuth, isAuthError } from '../session';

type OrgNode = {
  id: string;
  name: string;
  level: OrgLevel;
  parentId: string | null;
  children: OrgNode[];
  profile?: { bizNo?: string; ceoName?: string; useYn?: string };
};
type Overview = { tree: OrgNode };

function flatten(node: OrgNode): OrgNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

const empty = {
  name: '', bizNo: '', bizType: '', industry: '', ceoName: '', mobile: '', phone: '', fax: '', email: '',
  zip: '', address: '', addressDetail: '', salesInfo: 'online', useYn: 'Y', homepage: '', product: '',
  settleName: '', settlePhone: '', wallet: '', network: '', cardQuota: '5', limitBudget: '1000',
  repName: '', repEmail: '', repPassword: '',
};

export default function OrgRegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tree, setTree] = useState<OrgNode | null>(null);
  const [parentId, setParentId] = useState('');
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await apiAuth<Overview>('/api/overview');
    setTree(data.tree);
    setParentId((current) => current || data.tree.id);
  };

  useEffect(() => {
    void load().catch((err: Error) => {
      setError(err.message);
      if (isAuthError(err)) navigate('/admin/login', { replace: true });
    });
  }, [navigate]);

  const orgs = useMemo(() => (tree ? flatten(tree) : []), [tree]);
  const parent = orgs.find((org) => org.id === parentId);
  const next = parent ? childCode[parent.level] : '';
  const set = (key: keyof typeof empty, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await apiAuth('/api/orgs', {
        method: 'POST',
        body: JSON.stringify({
          parentId,
          name: form.name,
          cardQuota: Number(form.cardQuota),
          limitBudget: Number(form.limitBudget),
          profile: form,
          representative: { name: form.repName, email: form.repEmail, password: form.repPassword },
        }),
      });
      setForm(empty);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!tree) return <p className="boot">{error || t('boot')}</p>;

  return (
    <form onSubmit={submit}>
      {error ? <p className="banner-bad">{error}</p> : null}
      <section className="reg-card">
        <h2>{t('reg.basic')}</h2>
        <p className="hint">{t('reg.notice')}</p>
        <div className="reg-grid">
          <label>{t('reg.parent')}
            <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
              {orgs.filter((org) => childCode[org.level]).map((org) => (
                <option key={org.id} value={org.id}>{levelCode[org.level]} {org.name}</option>
              ))}
            </select>
          </label>
          <label>{t('menu.orgs')}<input value={next || '—'} readOnly /></label>
          <label>{t('reg.name')}<input value={form.name} onChange={(e) => set('name', e.target.value)} required /></label>
          <label>{t('reg.bizNo')}<input value={form.bizNo} onChange={(e) => set('bizNo', e.target.value)} /></label>
          <label>{t('reg.bizType')}<input value={form.bizType} onChange={(e) => set('bizType', e.target.value)} /></label>
          <label>{t('reg.industry')}<input value={form.industry} onChange={(e) => set('industry', e.target.value)} /></label>
          <label>{t('reg.ceo')}<input value={form.ceoName} onChange={(e) => set('ceoName', e.target.value)} required /></label>
          <label>{t('reg.mobile')}<input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} /></label>
          <label>{t('reg.phone')}<input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></label>
          <label>{t('reg.fax')}<input value={form.fax} onChange={(e) => set('fax', e.target.value)} /></label>
          <label>{t('reg.email')}<input value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
          <label>{t('reg.zip')}<input value={form.zip} onChange={(e) => set('zip', e.target.value)} /></label>
          <label>{t('reg.address')}<input value={form.address} onChange={(e) => set('address', e.target.value)} /></label>
          <label>{t('reg.addressDetail')}<input value={form.addressDetail} onChange={(e) => set('addressDetail', e.target.value)} /></label>
          <label>{t('reg.sales')}
            <select value={form.salesInfo} onChange={(e) => set('salesInfo', e.target.value)}>
              <option value="online">{t('reg.salesOnline')}</option>
              <option value="offline">{t('reg.salesOffline')}</option>
              <option value="other">{t('reg.salesOther')}</option>
            </select>
          </label>
          <label>{t('reg.use')}
            <select value={form.useYn} onChange={(e) => set('useYn', e.target.value)}>
              <option value="Y">{t('reg.useY')}</option>
              <option value="N">{t('reg.useN')}</option>
              <option value="S">{t('reg.useS')}</option>
            </select>
          </label>
          <label>{t('reg.login')}<input value={form.repName} onChange={(e) => set('repName', e.target.value)} required /></label>
          <label>{t('reg.email')}<input value={form.repEmail} onChange={(e) => set('repEmail', e.target.value)} required /></label>
          <label>{t('reg.password')}<input type="password" value={form.repPassword} onChange={(e) => set('repPassword', e.target.value)} required minLength={8} /></label>
          <label>{t('reg.cards')}<input value={form.cardQuota} onChange={(e) => set('cardQuota', e.target.value)} /></label>
          <label>{t('reg.limit')}<input value={form.limitBudget} onChange={(e) => set('limitBudget', e.target.value)} /></label>
        </div>
      </section>
      <section className="reg-card">
        <h2>{t('reg.other')}</h2>
        <div className="reg-grid">
          <label>{t('reg.homepage')}<input value={form.homepage} onChange={(e) => set('homepage', e.target.value)} /></label>
          <label>{t('reg.product')}<input value={form.product} onChange={(e) => set('product', e.target.value)} /></label>
          <label>{t('reg.settleName')}<input value={form.settleName} onChange={(e) => set('settleName', e.target.value)} /></label>
          <label>{t('reg.settlePhone')}<input value={form.settlePhone} onChange={(e) => set('settlePhone', e.target.value)} /></label>
          <label>{t('reg.wallet')}<input value={form.wallet} onChange={(e) => set('wallet', e.target.value)} /></label>
          <label>{t('reg.network')}<input value={form.network} onChange={(e) => set('network', e.target.value)} /></label>
        </div>
        <div className="reg-actions"><button type="submit">{t('reg.save')}</button></div>
      </section>
      <section className="panel">
        <h2>{t('reg.list')}</h2>
        <table>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id}>
                <td>{levelCode[org.level]}</td>
                <td>{org.name}</td>
                <td>{org.profile?.ceoName}</td>
                <td>{org.profile?.bizNo}</td>
                <td>{org.profile?.useYn || 'Y'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </form>
  );
}
