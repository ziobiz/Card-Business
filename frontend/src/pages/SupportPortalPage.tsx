import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiAuth } from '../session';

type Cap = {
  id: string;
  section: 'verification' | 'cards' | 'statements' | 'ticket';
  portal: string;
  status: 'api' | 'partial' | 'portal_only' | 'local';
  note: string;
};

type Catalog = {
  note: string;
  capabilities: Cap[];
  templates: { ko: { title: string; body: string }; en: { title: string; body: string } };
  escalation: string[];
};

type WirexStatus = {
  apiBase?: string;
  chainId?: number;
  chainName?: string;
  credentialsSet?: boolean;
  partnerIdSet?: boolean;
  mock?: boolean;
  configReachable?: boolean;
  tokenOk?: boolean;
  tokenError?: string;
  note?: string;
  corporationTokenHint?: string;
};

type Lookup = {
  hint: string;
  users: Array<{ id: string; name: string; email: string; role: string; orgName: string; status: string }>;
  cards: Array<{
    id: string;
    name: string;
    format: string;
    status: string;
    cardLimit: number | null;
    userName: string;
    userEmail: string;
    orgName: string;
  }>;
};

type Tab = 'verification' | 'cards' | 'statements';

export default function SupportPortalPage() {
  const { t, i18n } = useTranslation();
  const statusLabel: Record<Cap['status'], string> = {
    api: t('support.statusApi'),
    partial: t('support.statusPartial'),
    portal_only: t('support.statusPortal'),
    local: t('support.statusLocal'),
  };
  const [tab, setTab] = useState<Tab>('verification');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [wirex, setWirex] = useState<WirexStatus | null>(null);
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [periodStart, setPeriodStart] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [stmtMsg, setStmtMsg] = useState('');

  useEffect(() => {
    void Promise.all([
      apiAuth<Catalog>('/api/support/capabilities'),
      apiAuth<WirexStatus>('/api/support/wirex-status'),
    ])
      .then(([caps, status]) => {
        setCatalog(caps);
        setWirex(status);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const sectionCaps = useMemo(
    () => (catalog?.capabilities || []).filter((row) => row.section === tab || (tab === 'verification' && row.section === 'ticket')),
    [catalog, tab],
  );

  const template = catalog?.templates?.[i18n.language.startsWith('ko') ? 'ko' : 'en'] || catalog?.templates?.en;

  async function runLookup(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const row = await apiAuth<Lookup>(`/api/support/lookup?q=${encodeURIComponent(query.trim())}`);
      setLookup(row);
    } catch (err) {
      setLookup(null);
      setError(err instanceof Error ? err.message : 'lookup_failed');
    }
  }

  async function copyTemplate() {
    if (!template) return;
    await navigator.clipboard.writeText(`${template.title}\n\n${template.body}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function previewStatement(event: FormEvent) {
    event.preventDefault();
    setStmtMsg('');
    const start = Math.floor(new Date(`${periodStart}T00:00:00Z`).getTime() / 1000);
    const end = Math.floor(new Date(`${periodEnd}T23:59:59Z`).getTime() / 1000);
    try {
      const row = await apiAuth<{ message?: string; reason?: string; error?: string }>('/api/support/statements/preview', {
        method: 'POST',
        body: JSON.stringify({ start, end, chainId: wirex?.chainId }),
      });
      setStmtMsg(row.message || row.reason || row.error || 'ok');
    } catch (err) {
      setStmtMsg(err instanceof Error ? err.message : 'statement_failed');
    }
  }

  return (
    <section className="panel support-portal">
      <h2>{t('support.title')}</h2>
      <div className="support-body">
        <p className="support-lead">{t('support.lead')}</p>
        {error ? <p className="banner-bad">{error}</p> : null}

        <div className="support-status">
          <article>
            <span>{t('support.api')}</span>
            <strong>{wirex?.apiBase || '—'}</strong>
          </article>
          <article>
            <span>{t('support.chain')}</span>
            <strong>{wirex?.chainName || wirex?.chainId || '—'}</strong>
          </article>
          <article>
            <span>{t('support.keys')}</span>
            <strong>{wirex?.credentialsSet ? t('support.yes') : t('support.no')}</strong>
          </article>
          <article>
            <span>{t('support.token')}</span>
            <strong>{wirex?.tokenOk ? t('support.ok') : t('support.fail')}</strong>
          </article>
        </div>
        {wirex?.tokenError || wirex?.note ? <p className="support-note">{wirex.tokenError || wirex.note}</p> : null}
        {wirex?.corporationTokenHint ? <p className="support-note">{wirex.corporationTokenHint}</p> : null}

        <div className="support-search-box">
          <h3>{t('support.searchTitle')}</h3>
          <p className="support-note">{t('support.searchHelp')}</p>
          <form className="support-search" onSubmit={runLookup}>
            <label>
              {t('support.userId')}
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('support.userIdPh')} required />
            </label>
            <button type="submit">{t('support.show')}</button>
          </form>
          {lookup ? <p className="support-note">{lookup.hint}</p> : null}
        </div>

        <div className="support-tabs">
          {([
            ['verification', t('support.tabVerif')],
            ['cards', t('support.tabCards')],
            ['statements', t('support.tabStmt')],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'verification' ? (
          <div className="support-block">
            <h3>{t('support.template')}</h3>
            <pre className="support-template">{template ? `${template.title}\n\n${template.body}` : ''}</pre>
            <div className="support-template-actions">
              <button type="button" onClick={() => void copyTemplate()}>{copied ? t('support.copied') : t('support.copy')}</button>
            </div>
            <h3>{t('support.escalation')}</h3>
            <ul className="support-list">{(catalog?.escalation || []).map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        ) : null}

        {tab === 'cards' ? (
          <div className="support-block">
            <h3>{t('support.localUsers')}</h3>
            {lookup?.users?.length ? (
              <div className="support-table-wrap">
                <table>
                  <thead>
                    <tr><th>ID</th><th>{t('support.name')}</th><th>{t('support.email')}</th><th>{t('support.org')}</th><th>{t('support.status')}</th></tr>
                  </thead>
                  <tbody>
                    {lookup.users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{user.orgName}</td>
                        <td>{user.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="support-note">{t('support.emptyUsers')}</p>}
            <h3>{t('support.localCards')}</h3>
            {lookup?.cards?.length ? (
              <div className="support-table-wrap">
                <table>
                  <thead>
                    <tr><th>ID</th><th>{t('support.name')}</th><th>{t('support.format')}</th><th>{t('support.status')}</th><th>{t('support.limit')}</th><th>{t('support.holder')}</th></tr>
                  </thead>
                  <tbody>
                    {lookup.cards.map((card) => (
                      <tr key={card.id}>
                        <td>{card.id}</td>
                        <td>{card.name}</td>
                        <td>{card.format}</td>
                        <td>{card.status}</td>
                        <td>{card.cardLimit ?? '∞'}</td>
                        <td>{card.userName || card.userEmail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="support-note">{t('support.emptyCards')}</p>}
            <p className="support-note">{t('support.chargebackHint')}</p>
          </div>
        ) : null}

        {tab === 'statements' ? (
          <div className="support-block">
            <form className="support-fields" onSubmit={previewStatement}>
              <label>{t('support.periodStart')}<input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required /></label>
              <label>{t('support.periodEnd')}<input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required /></label>
              <label>{t('support.chain')}<input value={String(wirex?.chainId ?? '')} readOnly /></label>
              <button type="submit">{t('support.apply')}</button>
            </form>
            {stmtMsg ? <p className="support-note">{stmtMsg}</p> : null}
            <p className="support-note">{t('support.stmtHint')}</p>
          </div>
        ) : null}

        <div className="support-block">
          <h3>{t('support.matrix')}</h3>
          <p className="support-note">{catalog?.note}</p>
          <div className="support-table-wrap">
            <table className="support-matrix">
              <thead>
                <tr><th>{t('support.portalFeature')}</th><th>{t('support.canDo')}</th><th>{t('support.note')}</th></tr>
              </thead>
              <tbody>
                {sectionCaps.map((row) => (
                  <tr key={row.id}>
                    <td>{row.portal}</td>
                    <td className="support-matrix-status"><span className={`support-pill support-${row.status}`}>{statusLabel[row.status]}</span></td>
                    <td>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
