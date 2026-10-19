import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { childCode, levelCode, type OrgLevel } from '../levels';
import { apiAuth, isAuthError } from '../session';
import FeeBoard from './FeeBoard';

type Level = OrgLevel;
type OrgNode = {
  id: string;
  name: string;
  level: Level;
  parentId: string | null;
  cardQuota: number;
  limitBudget: number;
  cardsIssued: number;
  limitUsed: number;
  allocatedCards: number;
  allocatedLimit: number;
  remainingCards: number;
  remainingLimit: number;
  children: OrgNode[];
};
type Person = { id: string; role: string; orgId: string; name: string; email: string; staffRole?: string; primary?: boolean };
type CardRow = { id: string; orgId: string; userId: string; name: string; format: string; status: string; monthKey?: string };
type SpendRow = { id: string; cardId: string; orgId: string; userId: string; merchant: string; amount: number; fee: number; orgFee?: number; userFee?: number; createdAt: string };
type FeeEvent = { id: string; name: string; code: string };
type Overview = { feeRate: number; tree: OrgNode; users: Person[]; operators: Person[]; staff?: Person[]; cards: CardRow[]; spends: SpendRow[]; events: FeeEvent[] };

function findNode(node: OrgNode, id: string): OrgNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function flatten(node: OrgNode): OrgNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function usd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const dateLocale: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', th: 'th-TH', zh: 'zh-CN' };

export default function ConsolePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const path = useLocation().pathname;
  const section = path.includes('/fees') ? 'fees' : path.includes('/users') ? 'users' : path.includes('/usage') || path.includes('/cards') ? 'cards' : path.includes('/activity') ? 'activity' : 'orgs';
  const [data, setData] = useState<Overview | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [poolCards, setPoolCards] = useState('45');
  const [poolLimit, setPoolLimit] = useState('100000');
  const [orgForm, setOrgForm] = useState({ name: '', cardQuota: '5', limitBudget: '1000' });
  const [personForm, setPersonForm] = useState({ role: 'user', staffRole: 'operator', name: '', email: '', password: '' });
  const [cardForm, setCardForm] = useState({ userId: '', name: 'Team card', format: 'virtual' });
  const [spendForm, setSpendForm] = useState({ cardId: '', merchant: '', amount: '' });
  const [atmForm, setAtmForm] = useState({ cardId: '', amount: '' });
  const [chargeForm, setChargeForm] = useState({ cardId: '', code: '', amount: '' });
  const [orgName, setOrgName] = useState('');

  const load = async () => {
    const next = await apiAuth<Overview>('/api/overview');
    setData(next);
    setPoolCards(String(next.tree.cardQuota));
    setPoolLimit(String(next.tree.limitBudget));
    setSelectedId((current) => current || next.tree.id);
  };

  useEffect(() => {
    void load().catch((e: Error) => {
      setError(e.message);
      if (isAuthError(e)) navigate('/admin/login', { replace: true });
    });
  }, [navigate]);

  const selected = useMemo(() => (data ? findNode(data.tree, selectedId) : null), [data, selectedId]);
  const orgs = data ? flatten(data.tree) : [];
  const usersHere = data && selected ? data.users.filter((user) => user.orgId === selected.id) : [];
  const cardsHere = data && selected ? data.cards.filter((card) => card.orgId === selected.id && card.status !== 'closed') : [];

  useEffect(() => {
    if (selected) setOrgName(selected.name);
  }, [selected]);

  const run = async (path: string, body: unknown) => {
    setError('');
    try {
      await apiAuth(path, { method: path.endsWith('/hq') || path.includes('/orgs/') ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const savePool = (event: FormEvent) => {
    event.preventDefault();
    void run('/api/hq', { cardQuota: Number(poolCards), limitBudget: Number(poolLimit) });
  };

  if (!data || !selected) return <p className="boot">{error || t('boot')}</p>;
  const staffHere = (data.staff || [...data.users, ...data.operators]).filter((person) => person.orgId === selected.id);

  return (
    <div className="cb-work">
      {error ? <p className="banner-bad">{error}</p> : null}
      <div className="org-picks">
        {orgs.map((org) => (
          <button key={org.id} type="button" className={org.id === selected.id ? 'on' : ''} onClick={() => setSelectedId(org.id)}>
            {levelCode[org.level]} {org.name}
          </button>
        ))}
      </div>
      {section === 'fees' ? <FeeBoard selectedId={selected.id} /> : null}
      {section === 'orgs' ? <>
          <section className="stat-row">
            <article><span>{t('stats.cards')}</span><strong>{selected.remainingCards}</strong><small>{t('stats.cardsDetail', { quota: selected.cardQuota, issued: selected.cardsIssued })}</small></article>
            <article><span>{t('stats.limit')}</span><strong>{usd(selected.remainingLimit)}</strong><small>{t('stats.limitDetail', { budget: usd(selected.limitBudget), used: usd(selected.limitUsed) })}</small></article>
            <article><span>{t('stats.fee')}</span><strong>{t('stats.channel')}</strong><small>{t('stats.feeHint')}</small></article>
          </section>

          {data.tree.level === 'hq' && selected.level === 'hq' ? (
            <form className="panel" onSubmit={savePool}>
              <h2>{t('pool.title')}</h2>
              <div className="fields">
                <label>{t('pool.cards')}<input value={poolCards} onChange={(e) => setPoolCards(e.target.value)} /></label>
                <label>{t('pool.limit')}<input value={poolLimit} onChange={(e) => setPoolLimit(e.target.value)} /></label>
              </div>
              <button type="submit">{t('pool.save')}</button>
            </form>
          ) : null}

          <form className="panel" onSubmit={(event) => { event.preventDefault(); void run(`/api/orgs/${selected.id}`, { name: orgName }); }}>
            <h2>{t('org.rename')}</h2>
            <p className="hint">{t('org.renameHint')}</p>
            <div className="fields">
              <label>{t('org.name')}<input value={orgName} onChange={(e) => setOrgName(e.target.value)} required /></label>
            </div>
            <button type="submit">{t('org.saveName')}</button>
          </form>

          {childCode[selected.level] ? (
            <form className="panel" onSubmit={(event) => { event.preventDefault(); void run('/api/orgs', { parentId: selected.id, ...orgForm, cardQuota: Number(orgForm.cardQuota), limitBudget: Number(orgForm.limitBudget) }); }}>
              <h2>{t('org.add', { level: childCode[selected.level] })}</h2>
              <div className="fields">
                <label>{t('org.name')}<input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} required /></label>
                <label>{t('org.cards')}<input value={orgForm.cardQuota} onChange={(e) => setOrgForm({ ...orgForm, cardQuota: e.target.value })} /></label>
                <label>{t('org.limit')}<input value={orgForm.limitBudget} onChange={(e) => setOrgForm({ ...orgForm, limitBudget: e.target.value })} /></label>
              </div>
              <button type="submit">{t('org.create')}</button>
            </form>
          ) : null}

          {selected.level !== 'hq' ? (
            <form className="panel" onSubmit={(event) => { event.preventDefault(); void run(`/api/orgs/${selected.id}`, { cardQuota: Number(orgForm.cardQuota), limitBudget: Number(orgForm.limitBudget) }); }}>
              <h2>{t('org.reassign')}</h2>
              <p className="hint">{t('org.reassignHint')}</p>
              <div className="fields">
                <label>{t('org.cards')}<input value={orgForm.cardQuota} onChange={(e) => setOrgForm({ ...orgForm, cardQuota: e.target.value })} /></label>
                <label>{t('org.limit')}<input value={orgForm.limitBudget} onChange={(e) => setOrgForm({ ...orgForm, limitBudget: e.target.value })} /></label>
              </div>
              <button type="submit">{t('org.saveAssign')}</button>
            </form>
          ) : null}
          </> : null}

          {section === 'users' ? <>
            <form className="panel" onSubmit={(event) => { event.preventDefault(); void run('/api/accounts', { ...personForm, role: selected.level === 'hq' ? 'hq' : personForm.role, staffRole: personForm.staffRole, orgId: selected.id }); }}>
              <h2>{t('account.title')}</h2>
              <p className="hint">{t('staff.hint')}</p>
              <div className="fields">
                <label>{t('staff.kind')}
                  <select value={selected.level === 'hq' ? 'hq' : personForm.role} onChange={(e) => setPersonForm({ ...personForm, role: e.target.value })} disabled={selected.level === 'hq'}>
                    {selected.level === 'hq' ? <option value="hq">{t('shell.roleHq')}</option> : null}
                    {selected.level !== 'hq' ? <option value="user">{t('staff.user')}</option> : null}
                    {selected.level !== 'hq' ? <option value="org">{t('account.operator')}</option> : null}
                  </select>
                </label>
                {selected.level !== 'hq' && personForm.role === 'org' ? (
                  <label>{t('staff.title')}
                    <select value={personForm.staffRole} onChange={(e) => setPersonForm({ ...personForm, staffRole: e.target.value })}>
                      <option value="admin">{t('staff.admin')}</option>
                      <option value="accountant">{t('staff.accountant')}</option>
                      <option value="general">{t('staff.general')}</option>
                      <option value="operator">{t('staff.operator')}</option>
                    </select>
                  </label>
                ) : null}
                <label>{t('account.name')}<input value={personForm.name} onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })} required /></label>
                <label>{t('account.email')}<input value={personForm.email} onChange={(e) => setPersonForm({ ...personForm, email: e.target.value })} required /></label>
                <label>{t('account.password')}<input value={personForm.password} onChange={(e) => setPersonForm({ ...personForm, password: e.target.value })} required /></label>
              </div>
              <button type="submit">{t('account.save')}</button>
            </form>
            <section className="panel">
              <h2>{t('shell.users')}</h2>
              <table>
                <tbody>
                  {staffHere.map((person) => (
                    <tr key={person.id}><td>{person.name}</td><td>{person.email}</td><td>{person.staffRole || person.role}</td><td>{person.primary ? t('staff.primary') : ''}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          </> : null}

          {section === 'cards' && usersHere.length > 0 ? (
            <form className="panel" onSubmit={(event) => { event.preventDefault(); void run('/api/cards', cardForm); }}>
              <h2>{t('card.issue')}</h2>
              <div className="fields">
                <label>{t('card.user')}
                  <select value={cardForm.userId} onChange={(e) => setCardForm({ ...cardForm, userId: e.target.value })} required>
                    <option value="">{t('card.pick')}</option>
                    {usersHere.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </label>
                <label>{t('card.name')}<input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} /></label>
                <label>{t('card.kind')}
                  <select value={cardForm.format} onChange={(e) => setCardForm({ ...cardForm, format: e.target.value })}>
                    <option value="virtual">{t('card.virtual')}</option>
                    <option value="plastic">{t('card.plastic')}</option>
                  </select>
                </label>
              </div>
              <button type="submit">{t('card.submit')}</button>
            </form>
          ) : null}

          {section === 'cards' && cardsHere.length > 0 ? (
            <form className="panel" onSubmit={(event) => { event.preventDefault(); void run(`/api/cards/${spendForm.cardId}/spend`, { merchant: spendForm.merchant, amount: Number(spendForm.amount) }); }}>
              <h2>{t('spend.title')}</h2>
              <p className="hint">{t('spend.hint')}</p>
              <div className="fields">
                <label>{t('spend.card')}
                  <select value={spendForm.cardId} onChange={(e) => setSpendForm({ ...spendForm, cardId: e.target.value })} required>
                    <option value="">{t('card.pick')}</option>
                    {cardsHere.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
                  </select>
                </label>
                <label>{t('spend.merchant')}<input value={spendForm.merchant} onChange={(e) => setSpendForm({ ...spendForm, merchant: e.target.value })} /></label>
                <label>{t('spend.amount')}<input value={spendForm.amount} onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })} required /></label>
              </div>
              <button type="submit">{t('spend.submit')}</button>
            </form>
          ) : null}

          {section === 'cards' && cardsHere.length > 0 ? (
            <section className="panel">
              <h2>{t('card.state')}</h2>
              <table>
                <thead><tr><th>{t('card.colCard')}</th><th>{t('card.colStatus')}</th><th></th></tr></thead>
                <tbody>
                  {cardsHere.map((card) => (
                    <tr key={card.id}>
                      <td>{card.name}</td>
                      <td>{card.status === 'active' ? t('status.active') : t('status.blocked')}{card.monthKey ? ` · ${t('status.monthly', { month: card.monthKey })}` : ''}</td>
                      <td className="card-actions">
                        {card.status === 'active' ? <button type="button" onClick={() => void run(`/api/cards/${card.id}/block`, {})}>{t('card.block')}</button> : null}
                        {card.status === 'blocked' ? <button type="button" onClick={() => void run(`/api/cards/${card.id}/unblock`, {})}>{t('card.unblock')}</button> : null}
                        <button type="button" onClick={() => void run(`/api/cards/${card.id}/reissue`, {})}>{t('card.reissue')}</button>
                        {card.status === 'active' ? <button type="button" onClick={() => void run(`/api/cards/${card.id}/monthly`, {})}>{t('card.monthly')}</button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {section === 'cards' && cardsHere.length > 0 ? (
            <form className="panel" onSubmit={(event) => { event.preventDefault(); void run(`/api/cards/${atmForm.cardId}/atm`, { amount: Number(atmForm.amount) }); }}>
              <h2>{t('atm.title')}</h2>
              <div className="fields">
                <label>{t('spend.card')}
                  <select value={atmForm.cardId} onChange={(e) => setAtmForm({ ...atmForm, cardId: e.target.value })} required>
                    <option value="">{t('card.pick')}</option>
                    {cardsHere.filter((card) => card.status === 'active').map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
                  </select>
                </label>
                <label>{t('atm.amount')}<input value={atmForm.amount} onChange={(e) => setAtmForm({ ...atmForm, amount: e.target.value })} required /></label>
              </div>
              <button type="submit">{t('atm.submit')}</button>
            </form>
          ) : null}

          {section === 'cards' && cardsHere.length > 0 ? (
            <form className="panel" onSubmit={(event) => { event.preventDefault(); void run(`/api/cards/${chargeForm.cardId}/charge`, { code: chargeForm.code, amount: chargeForm.amount === '' ? 0 : Number(chargeForm.amount) }); }}>
              <h2>{t('charge.title')}</h2>
              <p className="hint">{t('charge.hint')}</p>
              <div className="fields">
                <label>{t('spend.card')}
                  <select value={chargeForm.cardId} onChange={(e) => setChargeForm({ ...chargeForm, cardId: e.target.value })} required>
                    <option value="">{t('card.pick')}</option>
                    {cardsHere.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}
                  </select>
                </label>
                <label>{t('charge.event')}
                  <select value={chargeForm.code} onChange={(e) => setChargeForm({ ...chargeForm, code: e.target.value })} required>
                    <option value="">{t('card.pick')}</option>
                    {data.events.map((event) => <option key={event.id} value={event.code}>{t(`event.${event.code}`, { defaultValue: event.name })}</option>)}
                  </select>
                </label>
                <label>{t('charge.base')}<input value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} /></label>
              </div>
              <button type="submit">{t('charge.submit')}</button>
            </form>
          ) : null}

          {section === 'activity' ? <section className="panel">
            <h2>{t('tx.title')}</h2>
            <table>
              <thead><tr><th>{t('tx.time')}</th><th>{t('tx.org')}</th><th>{t('tx.what')}</th><th>{t('tx.amount')}</th><th>{t('tx.orgFee')}</th><th>{t('tx.userFee')}</th></tr></thead>
              <tbody>
                {data.spends.filter((row) => orgs.some((org) => org.id === row.orgId)).slice(0, 12).map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString(dateLocale[i18n.language.slice(0, 2)] || 'en-US')}</td>
                    <td>{orgs.find((org) => org.id === row.orgId)?.name}</td>
                    <td>{row.merchant}</td>
                    <td>{usd(row.amount)}</td>
                    <td>{usd(row.orgFee ?? row.fee)}</td>
                    <td>{usd(row.userFee ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section> : null}
    </div>
  );
}
