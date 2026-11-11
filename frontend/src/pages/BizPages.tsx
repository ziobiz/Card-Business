import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiAuth } from '../session';

type OrgOpt = { id: string; name: string; level: string; parentId?: string | null };
type Member = {
  id: string;
  orgId: string;
  orgName?: string;
  orgCode?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  wirexEmployeeId?: string;
};
type IssuedCard = {
  id: string;
  orgId: string;
  orgName?: string;
  orgCode?: string;
  userId: string;
  userName?: string;
  name: string;
  format: string;
  status: string;
  purpose?: string;
  wirexCardId?: string;
  nameOnCard?: string;
  dailyLimit?: number;
  monthlyLimit?: number;
  transactionLimit?: number;
  cardLimit?: number;
  createdAt?: string;
};
type SpendRow = {
  id: string;
  orgId: string;
  orgName?: string;
  orgCode?: string;
  cardId: string;
  cardName?: string;
  merchant: string;
  amount: number;
  createdAt: string;
};

function usd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function MembersPage() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgOpt[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });

  async function load(filterOrg = orgId) {
    const row = await apiAuth<{ members: Member[]; orgs: OrgOpt[] }>(
      `/api/biz/members${filterOrg ? `?orgId=${encodeURIComponent(filterOrg)}` : ''}`,
    );
    setMembers(row.members || []);
    setOrgs(row.orgs || []);
    if (!orgId && row.orgs?.[0]?.id) setOrgId(row.orgs.find((o) => o.level !== 'hq')?.id || row.orgs[0].id);
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!orgId) return setError(t('biz.orgRequired'));
    setBusy(true);
    setError('');
    try {
      await apiAuth('/api/biz/members', {
        method: 'POST',
        body: JSON.stringify({ orgId, ...form }),
      });
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '' });
      await load(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel support-portal">
      <h2>{t('biz.membersTitle')}</h2>
      <div className="support-body">
        <p className="support-lead">{t('biz.membersLead')}</p>
        {error ? <p className="banner-bad">{error}</p> : null}
        <form className="support-block" onSubmit={onSubmit}>
          <h3>{t('biz.registerMember')}</h3>
          <div className="support-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label>
              {t('biz.org')}
              <select value={orgId} onChange={(e) => { setOrgId(e.target.value); void load(e.target.value).catch(() => undefined); }} required>
                <option value="">—</option>
                {orgs.filter((o) => o.level !== 'hq').map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
                ))}
              </select>
            </label>
            <label>{t('biz.firstName')}<input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></label>
            <label>{t('biz.lastName')}<input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></label>
            <label>{t('biz.email')}<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>{t('biz.phone')}<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+8210..." required /></label>
            <label>{t('biz.password')}<input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="optional 8+" /></label>
          </div>
          <div className="btn-row-left">
            <button type="submit" className="btn-compact" disabled={busy}>{t('biz.registerMember')}</button>
            <button type="button" className="btn-compact" disabled={busy} onClick={() => void load(orgId)}>{t('biz.refresh')}</button>
          </div>
        </form>
        <div className="support-block">
          <h3>{t('biz.membersTitle')}</h3>
          {members.length ? (
            <div className="support-table-wrap">
              <table className="corp-cards-table">
                <thead>
                  <tr>
                    <th>{t('biz.orgCode')}</th>
                    <th>{t('biz.orgName')}</th>
                    <th>{t('biz.firstName')}</th>
                    <th>{t('biz.lastName')}</th>
                    <th>{t('biz.email')}</th>
                    <th>{t('biz.phone')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 0 ? 'odd' : 'even'}>
                      <td>{row.orgCode || row.orgId}</td>
                      <td>{row.orgName}</td>
                      <td>{row.firstName || '—'}</td>
                      <td>{row.lastName || '—'}</td>
                      <td>{row.email}</td>
                      <td>{row.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="support-note">{t('biz.emptyMembers')}</p>}
        </div>
      </div>
    </section>
  );
}

export function CardIssuePage() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgOpt[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    orgId: '',
    purpose: 'company' as 'company' | 'personal',
    format: 'virtual' as 'virtual' | 'plastic',
    card_name: '',
    name_on_card: '',
    userId: '',
    cardLimit: '100',
    delivery_provider: 'DHL',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'KR',
  });

  async function loadOrgs() {
    const row = await apiAuth<{ orgs: OrgOpt[] }>('/api/biz/members');
    setOrgs(row.orgs || []);
  }

  async function loadMembers(orgId: string) {
    if (!orgId) {
      setMembers([]);
      return;
    }
    const row = await apiAuth<{ members: Member[] }>(`/api/biz/members?orgId=${encodeURIComponent(orgId)}`);
    setMembers(row.members || []);
  }

  useEffect(() => {
    void loadOrgs().catch((e: Error) => setError(e.message));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.orgId) return setError(t('biz.orgRequired'));
    setBusy(true);
    setError('');
    try {
      const path = form.format === 'plastic' ? '/api/biz/issued-cards/plastic' : '/api/biz/issued-cards/virtual';
      const body: Record<string, unknown> = {
        orgId: form.orgId,
        purpose: form.purpose,
        card_name: form.card_name,
        name_on_card: form.purpose === 'company' ? form.name_on_card : undefined,
        userId: form.purpose === 'personal' ? form.userId : undefined,
        cardLimit: Number(form.cardLimit),
      };
      if (form.format === 'plastic') {
        body.delivery_provider = form.delivery_provider;
        body.delivery_address = {
          line1: form.line1,
          line2: form.line2,
          city: form.city,
          state: form.state,
          postal_code: form.postal_code,
          country: form.country,
        };
      }
      await apiAuth(path, { method: 'POST', body: JSON.stringify(body) });
      setForm((prev) => ({
        ...prev,
        card_name: '',
        name_on_card: '',
        userId: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postal_code: '',
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel support-portal">
      <h2>{t('biz.cardIssueTitle')}</h2>
      <div className="support-body">
        <p className="support-lead">{t('biz.cardIssueLead')}</p>
        {error ? <p className="banner-bad">{error}</p> : null}
        <form className="support-block" onSubmit={onSubmit}>
          <div className="support-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label>
              {t('biz.org')}
              <select
                value={form.orgId}
                onChange={(e) => {
                  const orgId = e.target.value;
                  setForm({ ...form, orgId, userId: '' });
                  void loadMembers(orgId);
                }}
                required
              >
                <option value="">—</option>
                {orgs.filter((o) => o.level !== 'hq').map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
                ))}
              </select>
            </label>
            <label>
              {t('biz.purpose')}
              <select
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value as 'company' | 'personal', name_on_card: '', userId: '' })}
              >
                <option value="company">{t('biz.purposeCompany')}</option>
                <option value="personal">{t('biz.purposePersonal')}</option>
              </select>
            </label>
            <label>
              {t('biz.format')}
              <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as 'virtual' | 'plastic' })}>
                <option value="virtual">{t('biz.virtual')}</option>
                <option value="plastic">{t('biz.plastic')}</option>
              </select>
            </label>
            <label>{t('biz.cardName')}<input value={form.card_name} onChange={(e) => setForm({ ...form, card_name: e.target.value })} required /></label>
            <label>
              {t('biz.nameOnCard')}
              <input
                value={form.name_on_card}
                onChange={(e) => setForm({ ...form, name_on_card: e.target.value })}
                disabled={form.purpose !== 'company'}
                required={form.purpose === 'company'}
                placeholder={form.purpose === 'company' ? 'Acme Inc' : '—'}
              />
            </label>
            <label>{t('biz.cardLimit')}<input value={form.cardLimit} onChange={(e) => setForm({ ...form, cardLimit: e.target.value })} required /></label>
            {form.purpose === 'personal' ? (
              <label>
                {t('biz.member')}
                <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
                  <option value="">{t('biz.pickMember')}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {form.format === 'plastic' ? (
              <>
                <label>{t('biz.deliveryProvider')}<input value={form.delivery_provider} onChange={(e) => setForm({ ...form, delivery_provider: e.target.value })} required /></label>
                <label>{t('biz.addrLine1')}<input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required /></label>
                <label>{t('biz.addrLine2')}<input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></label>
                <label>{t('biz.addrCity')}<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label>
                <label>{t('biz.addrState')}<input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>
                <label>{t('biz.addrPostal')}<input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} required /></label>
                <label>{t('biz.addrCountry')}<input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} maxLength={2} required /></label>
              </>
            ) : null}
          </div>
          <div className="btn-row-left">
            <button type="submit" className="btn-compact" disabled={busy}>
              {form.format === 'plastic' ? t('biz.issuePlastic') : t('biz.issueVirtual')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export function IssuedCardsPage() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgOpt[]>([]);
  const [cards, setCards] = useState<IssuedCard[]>([]);
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [limits, setLimits] = useState<Record<string, { daily: string; monthly: string; perTx: string }>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  async function load(filter = orgId) {
    const row = await apiAuth<{ cards: IssuedCard[]; orgs: OrgOpt[] }>(
      `/api/biz/issued-cards${filter ? `?orgId=${encodeURIComponent(filter)}` : ''}`,
    );
    setCards(row.cards || []);
    setOrgs(row.orgs || []);
    const next: Record<string, { daily: string; monthly: string; perTx: string }> = {};
    for (const card of row.cards || []) {
      next[card.id] = {
        daily: String(card.dailyLimit ?? -1),
        monthly: String(card.monthlyLimit ?? -1),
        perTx: String(card.transactionLimit ?? -1),
      };
    }
    setLimits(next);
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, []);

  function confirmDanger(action: 'block' | 'unblock' | 'close', card: IssuedCard) {
    const actionLabel = t(`biz.${action}`);
    const label = card.name || card.wirexCardId || card.id;
    if (!window.confirm(t('biz.confirm1', { action: actionLabel, card: label, id: card.id }))) return false;
    return window.confirm(t('biz.confirm2', { action: actionLabel, card: label, id: card.id }));
  }

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await action();
      await load(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : label);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="panel support-portal">
      <h2>{t('biz.issuedTitle')}</h2>
      <div className="support-body">
        <p className="support-lead">{t('biz.issuedLead')}</p>
        {error ? <p className="banner-bad">{error}</p> : null}
        <div className="support-block">
          <div className="support-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label>
              {t('biz.org')}
              <select
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  void load(e.target.value).catch((err: Error) => setError(err.message));
                }}
              >
                <option value="">{t('biz.refresh')} — all</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.id})</option>
                ))}
              </select>
            </label>
          </div>
          <div className="btn-row-left">
            <button type="button" className="btn-compact" disabled={Boolean(busy)} onClick={() => void load(orgId)}>{t('biz.refresh')}</button>
          </div>
          {cards.length ? (
            <div className="support-table-wrap">
              <table className="corp-cards-table">
                <thead>
                  <tr>
                    <th>{t('biz.orgCode')}</th>
                    <th>{t('biz.orgName')}</th>
                    <th>{t('biz.cardName')}</th>
                    <th>{t('biz.purpose')}</th>
                    <th>{t('biz.wirexId')}</th>
                    <th>{t('biz.status')}</th>
                    <th>{t('biz.daily')}</th>
                    <th>{t('biz.monthly')}</th>
                    <th>{t('biz.perTx')}</th>
                    <th>{t('biz.manage')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card, idx) => {
                    const on = Boolean(editing[card.id]);
                    return (
                      <tr key={card.id} className={idx % 2 === 0 ? 'odd' : 'even'}>
                        <td>{card.orgCode || card.orgId}</td>
                        <td>{card.orgName}</td>
                        <td>{card.name}</td>
                        <td>{card.purpose === 'personal' ? t('biz.purposePersonal') : t('biz.purposeCompany')}</td>
                        <td>{card.wirexCardId || '—'}</td>
                        <td><span className="support-pill support-local">{card.status}</span></td>
                        <td>
                          <input
                            value={limits[card.id]?.daily ?? ''}
                            disabled={!on || Boolean(busy)}
                            onChange={(e) => setLimits({ ...limits, [card.id]: { ...limits[card.id], daily: e.target.value } })}
                          />
                        </td>
                        <td>
                          <input
                            value={limits[card.id]?.monthly ?? ''}
                            disabled={!on || Boolean(busy)}
                            onChange={(e) => setLimits({ ...limits, [card.id]: { ...limits[card.id], monthly: e.target.value } })}
                          />
                        </td>
                        <td>
                          <input
                            value={limits[card.id]?.perTx ?? ''}
                            disabled={!on || Boolean(busy)}
                            onChange={(e) => setLimits({ ...limits, [card.id]: { ...limits[card.id], perTx: e.target.value } })}
                          />
                        </td>
                        <td>
                          <div className="corp-cards-actions">
                            {!on ? (
                              <button type="button" className="btn-compact btn-edit" disabled={Boolean(busy)} onClick={() => setEditing({ ...editing, [card.id]: true })}>{t('biz.edit')}</button>
                            ) : (
                              <button
                                type="button"
                                className="btn-compact btn-save"
                                disabled={Boolean(busy)}
                                onClick={() => void run('limit', async () => {
                                  await apiAuth(`/api/biz/issued-cards/${card.id}/limit`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                      daily_limit: Number(limits[card.id]?.daily ?? -1),
                                      monthly_limit: Number(limits[card.id]?.monthly ?? -1),
                                      transaction_limit: Number(limits[card.id]?.perTx ?? -1),
                                    }),
                                  });
                                  setEditing({ ...editing, [card.id]: false });
                                })}
                              >
                                {t('biz.saveLimit')}
                              </button>
                            )}
                            <button type="button" className="btn-compact btn-block" disabled={Boolean(busy)} onClick={() => { if (!confirmDanger('block', card)) return; void run('block', async () => { await apiAuth(`/api/biz/issued-cards/${card.id}/block`, { method: 'PUT', body: '{}' }); }); }}>{t('biz.block')}</button>
                            <button type="button" className="btn-compact btn-unblock" disabled={Boolean(busy)} onClick={() => { if (!confirmDanger('unblock', card)) return; void run('unblock', async () => { await apiAuth(`/api/biz/issued-cards/${card.id}/unblock`, { method: 'PUT', body: '{}' }); }); }}>{t('biz.unblock')}</button>
                            <button type="button" className="btn-compact btn-close" disabled={Boolean(busy)} onClick={() => { if (!confirmDanger('close', card)) return; void run('close', async () => { await apiAuth(`/api/biz/issued-cards/${card.id}/close`, { method: 'PUT', body: '{}' }); }); }}>{t('biz.close')}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="support-note">{t('biz.emptyCards')}</p>}
        </div>
      </div>
    </section>
  );
}

export function SpendHistoryPage() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<OrgOpt[]>([]);
  const [spends, setSpends] = useState<SpendRow[]>([]);
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');

  async function load(filter = orgId) {
    const row = await apiAuth<{ spends: SpendRow[]; orgs: OrgOpt[] }>(
      `/api/biz/spend-history${filter ? `?orgId=${encodeURIComponent(filter)}` : ''}`,
    );
    setSpends(row.spends || []);
    setOrgs(row.orgs || []);
  }

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section className="panel support-portal">
      <h2>{t('biz.spendTitle')}</h2>
      <div className="support-body">
        <p className="support-lead">{t('biz.spendLead')}</p>
        {error ? <p className="banner-bad">{error}</p> : null}
        <div className="support-block">
          <div className="support-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label>
              {t('biz.org')}
              <select
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value);
                  void load(e.target.value).catch((err: Error) => setError(err.message));
                }}
              >
                <option value="">—</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="btn-row-left">
            <button type="button" className="btn-compact" onClick={() => void load(orgId)}>{t('biz.refresh')}</button>
          </div>
          {spends.length ? (
            <div className="support-table-wrap">
              <table className="corp-cards-table">
                <thead>
                  <tr>
                    <th>{t('biz.when')}</th>
                    <th>{t('biz.orgCode')}</th>
                    <th>{t('biz.orgName')}</th>
                    <th>{t('biz.cardName')}</th>
                    <th>{t('biz.merchant')}</th>
                    <th>{t('biz.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {spends.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 0 ? 'odd' : 'even'}>
                      <td>{row.createdAt}</td>
                      <td>{row.orgCode || row.orgId}</td>
                      <td>{row.orgName}</td>
                      <td>{row.cardName || row.cardId}</td>
                      <td>{row.merchant}</td>
                      <td>{usd(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="support-note">{t('biz.emptySpends')}</p>}
        </div>
      </div>
    </section>
  );
}
