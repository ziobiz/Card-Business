import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import snsWebSdk from '@sumsub/websdk';
import { apiAuth } from '../session';

type Profile = {
  ownerWallet: string;
  ownerEmail: string;
  corporationAddress: string;
  corporationName: string;
  registrationNumber: string;
  registrationCountry: string;
  chainId: number;
  onChainDone: boolean;
  registeredAt?: string | null;
  lastLoginAt?: string | null;
  corporationTokenReady?: boolean;
  partnerTokenReady?: boolean;
  verificationStatus?: string | null;
  lastError?: string | null;
  corporationId?: string | null;
  employeeId?: string | null;
  role?: string | null;
};

type Steps = {
  partner?: boolean;
  onChain?: boolean;
  register?: boolean;
  login?: boolean;
  kyb?: boolean;
};

type Workspace = {
  profile: Profile;
  steps: Steps;
  mock?: boolean;
  tokenOk?: boolean;
  chainName?: string;
  apiBase?: string;
  corporation?: {
    verification_status?: string;
    capabilities?: Array<{ type: string; status: string }>;
    corporation_name?: string;
  };
  note?: string;
};

type Employee = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: string;
  role_id?: string;
};

type CardRow = {
  id: string;
  status?: string;
  employee_id?: string;
  card_data?: { card_name?: string; card_number_last_4?: string; type?: string };
  limit?: { daily_limit?: number; monthly_limit?: number; transaction_limit?: number; currency?: string };
};

type Tab = 'onboard' | 'employees' | 'cards' | 'activities';
type Activity = {
  id?: string;
  type?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  created_at?: string;
  description?: string;
};

export default function CorporatePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('onboard');
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [sdkToken, setSdkToken] = useState('');
  const [kybLevel, setKybLevel] = useState('SDD');
  const [copied, setCopied] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name?: string }>>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [wallets, setWallets] = useState<Array<{ currency?: string; balance?: string | number; address?: string; name?: string }>>([]);
  const [form, setForm] = useState({
    ownerWallet: '',
    ownerEmail: '',
    corporationAddress: '',
    corporationName: '',
    registrationNumber: '',
    registrationCountry: '',
    chainId: 84532,
    onChainDone: false,
  });
  const [invite, setInvite] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role_id: '',
    department: '',
    job_title: '',
  });
  const [cardForm, setCardForm] = useState({ card_name: '', name_on_card: '', employee_id: '' });
  const [limits, setLimits] = useState<Record<string, { daily: string; monthly: string; perTx: string }>>({});
  const [onchain, setOnchain] = useState<{
    contracts?: Record<string, string>;
    endpoints?: { rpcUrl?: string; bundlerUrl?: string; blockExplorerUrl?: string; chainName?: string };
    corporateValidatorInstallData?: string | null;
    corporation?: { exists?: boolean; statusLabel?: string; creator?: string; verificationLabel?: string } | null;
    deployerConfigured?: boolean;
    note?: string;
    ownerKeyStored?: boolean;
  } | null>(null);
  const [ownerKeyOnce, setOwnerKeyOnce] = useState('');
  const [importKey, setImportKey] = useState('');
  const [calldata, setCalldata] = useState('');
  const [sumsubOpen, setSumsubOpen] = useState(false);
  const sumsubRef = useRef<HTMLDivElement | null>(null);
  const sumsubInstance = useRef<{ destroy?: () => void } | null>(null);

  async function loadOnchain() {
    try {
      const row = await apiAuth<{
        contracts?: Record<string, string>;
        endpoints?: { rpcUrl?: string; bundlerUrl?: string; blockExplorerUrl?: string; chainName?: string };
        corporateValidatorInstallData?: string | null;
        corporation?: { exists?: boolean; statusLabel?: string; creator?: string; verificationLabel?: string } | null;
        deployerConfigured?: boolean;
        note?: string;
        ownerKeyStored?: boolean;
        profile?: Profile;
      }>('/api/corporate/onchain');
      setOnchain(row);
      if (row.profile?.ownerWallet) {
        setForm((prev) => ({
          ...prev,
          ownerWallet: row.profile?.ownerWallet || prev.ownerWallet,
          corporationAddress: row.profile?.corporationAddress || prev.corporationAddress,
          onChainDone: Boolean(row.profile?.onChainDone || row.corporation?.exists),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'onchain_failed');
    }
  }

  async function loadWorkspace() {
    setError('');
    try {
      const row = await apiAuth<Workspace>('/api/corporate/workspace');
      setWs(row);
      const p = row.profile;
      setForm({
        ownerWallet: p.ownerWallet || '',
        ownerEmail: p.ownerEmail || '',
        corporationAddress: p.corporationAddress || '',
        corporationName: p.corporationName || '',
        registrationNumber: p.registrationNumber || '',
        registrationCountry: p.registrationCountry || '',
        chainId: p.chainId || 84532,
        onChainDone: Boolean(p.onChainDone),
      });
      await loadOnchain();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'load_failed');
    }
  }

  async function loadEmployees() {
    try {
      const [emp, role] = await Promise.all([
        apiAuth<{ employees?: Employee[] }>('/api/corporate/employees'),
        apiAuth<{ roles?: Array<{ id: string; name?: string }> }>('/api/corporate/roles'),
      ]);
      setEmployees(emp.employees || []);
      setRoles(role.roles || []);
      if (!invite.role_id && role.roles?.[0]?.id) setInvite((prev) => ({ ...prev, role_id: role.roles![0].id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'employees_failed');
    }
  }

  async function loadCards() {
    try {
      const row = await apiAuth<{ data?: CardRow[] }>('/api/corporate/cards');
      const list = row.data || [];
      setCards(list);
      const next: Record<string, { daily: string; monthly: string; perTx: string }> = {};
      for (const card of list) {
        next[card.id] = {
          daily: String(card.limit?.daily_limit ?? -1),
          monthly: String(card.limit?.monthly_limit ?? -1),
          perTx: String(card.limit?.transaction_limit ?? -1),
        };
      }
      setLimits(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'cards_failed');
    }
  }

  async function loadActivities() {
    try {
      type WalletApi = {
        wallet_address?: string;
        wallet_name?: string;
        balances?: Array<{ token_symbol?: string; balance?: string | number }>;
        currency?: string;
        balance?: string | number;
        address?: string;
      };
      const [feed, walletRow] = await Promise.all([
        apiAuth<{ activities?: Activity[]; data?: Activity[] }>('/api/corporate/activities'),
        apiAuth<{ wallets?: WalletApi[]; data?: WalletApi[] }>('/api/corporate/wallets').catch((): { wallets: WalletApi[]; data?: WalletApi[] } => ({ wallets: [] })),
      ]);
      setActivities(feed.activities || feed.data || []);
      const raw = walletRow.wallets || walletRow.data || [];
      const flat: Array<{ currency?: string; balance?: string | number; address?: string; name?: string }> = [];
      for (const w of raw) {
        if (Array.isArray(w.balances) && w.balances.length) {
          for (const bal of w.balances) {
            flat.push({
              currency: bal.token_symbol,
              balance: bal.balance,
              address: w.wallet_address,
              name: w.wallet_name,
            });
          }
        } else {
          flat.push({
            currency: w.currency,
            balance: w.balance,
            address: w.address || w.wallet_address,
            name: w.wallet_name,
          });
        }
      }
      setWallets(flat);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'activities_failed');
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (tab === 'employees' && ws?.profile?.corporationTokenReady) void loadEmployees();
    if (tab === 'cards' && ws?.profile?.corporationTokenReady) {
      void loadEmployees();
      void loadCards();
    }
    if (tab === 'activities' && ws?.profile?.corporationTokenReady) void loadActivities();
  }, [tab, ws?.profile?.corporationTokenReady]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await action();
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : label);
    } finally {
      setBusy('');
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await run('save', async () => {
      await apiAuth('/api/corporate/profile', { method: 'PUT', body: JSON.stringify(form) });
    });
  }

  async function refreshKybToken() {
    const row = await apiAuth<{ token?: string }>('/api/corporate/kyb/level-token', {
      method: 'POST',
      body: JSON.stringify({ verification_level: kybLevel }),
    });
    return String(row.token || '');
  }

  async function launchSumsub(token: string) {
    if (!token) throw new Error('sumsub_token_missing');
    sumsubInstance.current?.destroy?.();
    sumsubInstance.current = null;
    setSumsubOpen(true);
    await new Promise((r) => window.setTimeout(r, 50));
    const el = sumsubRef.current;
    if (!el) throw new Error('sumsub_container_missing');
    el.innerHTML = '';
    let builder = snsWebSdk
      .init(token, () => refreshKybToken())
      .withConf({ lang: document.documentElement.lang || 'ko' })
      .withOptions({ addViewportTag: false, adaptIframeHeight: true })
      .on('idCheck.onApplicantStatusChanged', () => {
        void loadWorkspace();
      });
    if (token.includes('sbx') || token.startsWith('_act-sbx')) {
      builder = builder.onTestEnv();
    }
    const sdk = builder.build();
    sumsubInstance.current = sdk;
    sdk.launch(el);
  }

  const steps = [
    { key: 'partner', label: t('corp.stepPartner'), on: Boolean(ws?.steps?.partner || ws?.tokenOk) },
    { key: 'onChain', label: t('corp.stepOnChain'), on: Boolean(ws?.steps?.onChain) },
    { key: 'register', label: t('corp.stepRegister'), on: Boolean(ws?.steps?.register) },
    { key: 'login', label: t('corp.stepLogin'), on: Boolean(ws?.steps?.login || ws?.profile?.corporationTokenReady) },
    { key: 'kyb', label: t('corp.stepKyb'), on: Boolean(ws?.steps?.kyb) },
  ];

  return (
    <section className="panel support-portal">
      <h2>{t('corp.title')}</h2>
      <div className="support-body">
        <p className="support-lead">{t('corp.lead')}</p>
        {ws?.mock ? <p className="support-note">{t('corp.mockNote')}</p> : null}
        {error ? <p className="banner-bad">{error}</p> : null}
        {ws?.profile?.lastError ? <p className="banner-bad">{t('corp.lastError')}: {ws.profile.lastError}</p> : null}

        <div className="support-tabs">
          {([
            ['onboard', t('corp.tabOnboard')],
            ['employees', t('corp.tabEmployees')],
            ['cards', t('corp.tabCards')],
            ['activities', t('corp.tabActivities')],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'onboard' ? (
          <>
            <div className="support-block">
              <h3>{t('corp.steps')}</h3>
              <div className="support-table-wrap">
                <table className="corp-steps-table">
                  <thead>
                    <tr><th>{t('corp.type')}</th><th>{t('corp.status')}</th></tr>
                  </thead>
                  <tbody>
                    {steps.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="support-matrix-status">
                          <span className={`support-pill ${row.on ? 'support-api' : 'support-partial'}`}>
                            {row.on ? t('corp.done') : t('corp.pending')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="btn-row-left">
                <button type="button" className="btn-compact" disabled={Boolean(busy)} onClick={() => void loadWorkspace()}>{t('corp.refresh')}</button>
              </div>
            </div>

            <div className="support-block">
              <h3>{t('corp.onChainTitle')}</h3>
              <p className="support-note">{onchain?.note || t('corp.onChainHelp')}</p>
              <div className="btn-row-left">
                <button
                  type="button"
                  className="btn-compact"
                  disabled={Boolean(busy)}
                  onClick={() => void run('genOwner', async () => {
                    const row = await apiAuth<{ address: string; privateKeyOnce: string }>('/api/corporate/onchain/owner/generate', { method: 'POST', body: '{}' });
                    setOwnerKeyOnce(row.privateKeyOnce);
                    setForm((prev) => ({ ...prev, ownerWallet: row.address }));
                    await loadOnchain();
                  })}
                >
                  {t('corp.genOwner')}
                </button>
              </div>
              <div className="support-fields" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <label>{t('corp.privateKey')}<input value={importKey} onChange={(e) => setImportKey(e.target.value)} placeholder="0x..." /></label>
                <button
                  type="button"
                  className="btn-compact"
                  disabled={Boolean(busy)}
                  onClick={() => void run('importOwner', async () => {
                    const row = await apiAuth<{ address: string }>('/api/corporate/onchain/owner/import', { method: 'POST', body: JSON.stringify({ privateKey: importKey }) });
                    setForm((prev) => ({ ...prev, ownerWallet: row.address }));
                    setImportKey('');
                    await loadOnchain();
                  })}
                >
                  {t('corp.importOwner')}
                </button>
              </div>
              {ownerKeyOnce ? (
                <>
                  <p className="support-note">{t('corp.keyOnce')}</p>
                  <pre className="support-template">{ownerKeyOnce}</pre>
                </>
              ) : null}
              {onchain?.corporateValidatorInstallData ? (
                <>
                  <p className="support-note">{t('corp.installData')}</p>
                  <pre className="support-template">{onchain.corporateValidatorInstallData}</pre>
                </>
              ) : null}
              <div className="support-table-wrap">
                <table className="corp-steps-table">
                  <thead>
                    <tr><th>{t('corp.contracts')}</th><th>{t('corp.status')}</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(onchain?.contracts || {}).map(([name, address]) => (
                      <tr key={name}><td>{name}</td><td>{address}</td></tr>
                    ))}
                    <tr>
                      <td>{t('corp.onChainStatus')}</td>
                      <td>{onchain?.corporation?.exists ? `${t('corp.exists')} / ${onchain.corporation.statusLabel}` : t('corp.missing')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="support-note">{t('corp.fullOnboardHelp')}</p>
              <p className="support-note">{t('corp.deployerNeed')}</p>
              <div className="btn-row-left">
                <button
                  type="button"
                  className="btn-compact"
                  disabled={Boolean(busy)}
                  onClick={() => void run('deployWallet', async () => {
                    const row = await apiAuth<{ corporationAddress?: string; ownerAddress?: string; transactionHash?: string }>('/api/corporate/onchain/deploy', {
                      method: 'POST',
                      body: JSON.stringify({ ownerEmail: form.ownerEmail }),
                    });
                    if (row.corporationAddress) {
                      setForm((prev) => ({
                        ...prev,
                        corporationAddress: row.corporationAddress || prev.corporationAddress,
                        ownerWallet: row.ownerAddress || prev.ownerWallet,
                        onChainDone: true,
                      }));
                    }
                    if (row.transactionHash) setCalldata(`tx: ${row.transactionHash}`);
                    await loadWorkspace();
                  })}
                >
                  {t('corp.deployWallet')}
                </button>
                <button
                  type="button"
                  className="btn-compact"
                  disabled={Boolean(busy)}
                  onClick={() => void run('fullOnboard', async () => {
                    const row = await apiAuth<{ profile?: Profile; deployed?: { corporationAddress?: string; transactionHash?: string } }>('/api/corporate/onboard/full', {
                      method: 'POST',
                      body: JSON.stringify(form),
                    });
                    if (row.profile) {
                      setForm((prev) => ({
                        ...prev,
                        ownerWallet: row.profile?.ownerWallet || prev.ownerWallet,
                        corporationAddress: row.profile?.corporationAddress || prev.corporationAddress,
                        onChainDone: Boolean(row.profile?.onChainDone),
                      }));
                    }
                    if (row.deployed?.transactionHash) setCalldata(`tx: ${row.deployed.transactionHash}`);
                    await loadWorkspace();
                    setTab('employees');
                  })}
                >
                  {t('corp.fullOnboard')}
                </button>
                <button
                  type="button"
                  className="btn-compact"
                  disabled={Boolean(busy) || !form.corporationAddress}
                  onClick={() => void run('checkOnChain', async () => {
                    await apiAuth(`/api/corporate/onchain/corporation/${encodeURIComponent(form.corporationAddress)}`);
                    await loadWorkspace();
                  })}
                >
                  {t('corp.checkOnChain')}
                </button>
                <button
                  type="button"
                  className="btn-compact"
                  disabled={Boolean(busy) || !form.corporationAddress}
                  onClick={() => void run('createOnChain', async () => {
                    const row = await apiAuth<{ sent?: boolean; data?: string; to?: string; transactionHash?: string }>('/api/corporate/onchain/create', {
                      method: 'POST',
                      body: JSON.stringify({ corporationAddress: form.corporationAddress }),
                    });
                    if (row.data) setCalldata(`to: ${row.to}\ndata: ${row.data}`);
                    await loadWorkspace();
                  })}
                >
                  {t('corp.createOnChain')}
                </button>
                <button
                  type="button"
                  className="btn-compact"
                  disabled={Boolean(busy)}
                  onClick={() => void run('completeApi', async () => {
                    await apiAuth('/api/corporate/onboard/api', { method: 'POST', body: JSON.stringify(form) });
                    await loadWorkspace();
                  })}
                >
                  {t('corp.completeApi')}
                </button>
              </div>
              {calldata ? <pre className="support-template">{calldata}</pre> : null}
            </div>

            <form className="support-block" onSubmit={saveProfile}>
              <h3>{t('corp.profile')}</h3>
              <div className="support-fields" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <label>{t('corp.ownerWallet')}<input value={form.ownerWallet} onChange={(e) => setForm({ ...form, ownerWallet: e.target.value })} required /></label>
                <label>{t('corp.ownerEmail')}<input type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} required /></label>
                <label>{t('corp.corpAddress')}<input value={form.corporationAddress} onChange={(e) => setForm({ ...form, corporationAddress: e.target.value })} required /></label>
                <label>{t('corp.corpName')}<input value={form.corporationName} onChange={(e) => setForm({ ...form, corporationName: e.target.value })} required /></label>
                <label>{t('corp.regNo')}<input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value.toUpperCase() })} required /></label>
                <label>{t('corp.regCountry')}<input value={form.registrationCountry} onChange={(e) => setForm({ ...form, registrationCountry: e.target.value.toUpperCase() })} maxLength={2} required /></label>
                <label>{t('corp.chainId')}<input type="number" value={form.chainId} onChange={(e) => setForm({ ...form, chainId: Number(e.target.value) })} /></label>
                <label style={{ alignContent: 'end' }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={form.onChainDone} onChange={(e) => setForm({ ...form, onChainDone: e.target.checked })} />
                    {t('corp.onChainDone')}
                  </span>
                </label>
              </div>
              <p className="support-note">{t('corp.onChainHelp')}</p>
              <div className="support-template-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" disabled={Boolean(busy)}>{t('corp.save')}</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void run('partner', async () => { await apiAuth('/api/corporate/partner-token', { method: 'POST', body: '{}' }); })}>{t('corp.partnerToken')}</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void run('register', async () => { await apiAuth('/api/corporate/register', { method: 'POST', body: JSON.stringify(form) }); })}>{t('corp.register')}</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void run('login', async () => { await apiAuth('/api/corporate/login', { method: 'POST', body: JSON.stringify(form) }); })}>{t('corp.login')}</button>
              </div>
            </form>

            <div className="support-block">
              <h3>{t('corp.kybToken')}</h3>
              <p className="support-note">{t('corp.kybHelp')}</p>
              <form
                className="support-fields"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run('kyb', async () => {
                    const token = await refreshKybToken();
                    setSdkToken(token);
                    await launchSumsub(token);
                  });
                }}
              >
                <label>
                  {t('corp.level')}
                  <select value={kybLevel} onChange={(e) => setKybLevel(e.target.value)}>
                    <option value="SDD">SDD</option>
                    <option value="EDD">EDD</option>
                    <option value="XDDBridgeBase">XDDBridgeBase</option>
                    <option value="XDDOpenPaydBase">XDDOpenPaydBase</option>
                  </select>
                </label>
                <button type="submit" disabled={Boolean(busy) || !ws?.profile?.corporationTokenReady}>{t('corp.openKyb')}</button>
              </form>
              {sdkToken ? (
                <>
                  <pre className="support-template">{sdkToken}</pre>
                  <div className="support-template-actions">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(sdkToken);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1600);
                      }}
                    >
                      {copied ? t('corp.copied') : t('corp.copy')}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void run('kybRelaunch', async () => { await launchSumsub(sdkToken); })}
                    >
                      {t('corp.reopenKyb')}
                    </button>
                  </div>
                </>
              ) : null}
              {sumsubOpen ? (
                <div className="support-block" style={{ marginTop: 12 }}>
                  <div ref={sumsubRef} id="sumsub-websdk-container" style={{ minHeight: 480 }} />
                </div>
              ) : null}
            </div>

            {ws?.corporation ? (
              <div className="support-block">
                <h3>{t('corp.capabilities')}</h3>
                <p className="support-note">{ws.corporation.verification_status || ws.profile.verificationStatus || '—'}</p>
                <div className="support-table-wrap">
                  <table>
                    <thead>
                      <tr><th>{t('corp.type')}</th><th>{t('corp.status')}</th></tr>
                    </thead>
                    <tbody>
                      {(ws.corporation.capabilities || []).map((row) => (
                        <tr key={row.type}>
                          <td>{row.type}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'employees' ? (
          <>
            {!ws?.profile?.corporationTokenReady ? (
              <p className="banner-bad">{t('corp.needLoginFirst')}</p>
            ) : null}
            <form
              className="support-block"
              onSubmit={(event) => {
                event.preventDefault();
                void run('invite', async () => {
                  await apiAuth('/api/corporate/employees/invite', { method: 'POST', body: JSON.stringify(invite) });
                  await loadEmployees();
                });
              }}
            >
              <h3>{t('corp.invite')}</h3>
              <div className="support-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <label>{t('corp.firstName')}<input value={invite.first_name} onChange={(e) => setInvite({ ...invite, first_name: e.target.value })} required /></label>
                <label>{t('corp.lastName')}<input value={invite.last_name} onChange={(e) => setInvite({ ...invite, last_name: e.target.value })} required /></label>
                <label>{t('corp.email')}<input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required /></label>
                <label>{t('corp.phone')}<input value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} placeholder="+8210..." required /></label>
                <label>
                  {t('corp.roleId')}
                  <select value={invite.role_id} onChange={(e) => setInvite({ ...invite, role_id: e.target.value })} required>
                    <option value="">—</option>
                    {roles.map((role) => <option key={role.id} value={role.id}>{role.name || role.id}</option>)}
                  </select>
                </label>
                <label>{t('corp.department')}<input value={invite.department} onChange={(e) => setInvite({ ...invite, department: e.target.value })} /></label>
                <label>{t('corp.jobTitle')}<input value={invite.job_title} onChange={(e) => setInvite({ ...invite, job_title: e.target.value })} /></label>
              </div>
              <div className="btn-row-left">
                <button type="submit" className="btn-compact" disabled={Boolean(busy)}>{t('corp.invite')}</button>
              </div>
            </form>

            <div className="support-block">
              <h3>{t('corp.employees')}</h3>
              {employees.length ? (
                <div className="support-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>{t('corp.firstName')}</th>
                        <th>{t('corp.email')}</th>
                        <th>{t('corp.phone')}</th>
                        <th>{t('corp.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{[row.first_name, row.last_name].filter(Boolean).join(' ')}</td>
                          <td>{row.email}</td>
                          <td>{row.phone}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="support-note">{t('corp.emptyEmployees')}</p>}
              <div className="btn-row-left">
                <button type="button" className="btn-compact" disabled={Boolean(busy)} onClick={() => void loadEmployees()}>{t('corp.refresh')}</button>
              </div>
            </div>
          </>
        ) : null}

        {tab === 'cards' ? (
          <>
            {!ws?.profile?.corporationTokenReady ? (
              <p className="banner-bad">{t('corp.needLoginFirst')}</p>
            ) : null}
            {!ws?.steps?.kyb ? (
              <p className="support-note">{t('corp.needKybForCards')}</p>
            ) : null}
            <form
              className="support-block"
              onSubmit={(event) => {
                event.preventDefault();
                void run('issue', async () => {
                  await apiAuth('/api/corporate/cards/virtual', {
                    method: 'POST',
                    body: JSON.stringify({
                      card_name: cardForm.card_name,
                      name_on_card: cardForm.name_on_card,
                      employee_id: cardForm.employee_id || undefined,
                    }),
                  });
                  await loadCards();
                });
              }}
            >
              <h3>{t('corp.issueVirtual')}</h3>
              <div className="support-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <label>{t('corp.cardName')}<input value={cardForm.card_name} onChange={(e) => setCardForm({ ...cardForm, card_name: e.target.value })} required /></label>
                <label>{t('corp.nameOnCard')}<input value={cardForm.name_on_card} onChange={(e) => setCardForm({ ...cardForm, name_on_card: e.target.value })} required /></label>
                <label>
                  {t('corp.employeeId')}
                  <select value={cardForm.employee_id} onChange={(e) => setCardForm({ ...cardForm, employee_id: e.target.value })}>
                    <option value="">—</option>
                    {employees.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.email || row.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="btn-row-left">
                <button type="submit" className="btn-compact" disabled={Boolean(busy)}>{t('corp.issueVirtual')}</button>
              </div>
            </form>

            <div className="support-block">
              <h3>{t('corp.cards')}</h3>
              {cards.length ? (
                <div className="support-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>{t('corp.cardName')}</th>
                        <th>{t('corp.status')}</th>
                        <th>{t('corp.daily')}</th>
                        <th>{t('corp.monthly')}</th>
                        <th>{t('corp.perTx')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cards.map((card) => (
                        <tr key={card.id}>
                          <td>{card.id}</td>
                          <td>{card.card_data?.card_name || '—'} {card.card_data?.card_number_last_4 ? `····${card.card_data.card_number_last_4}` : ''}</td>
                          <td>{card.status}</td>
                          <td>
                            <input
                              value={limits[card.id]?.daily ?? ''}
                              onChange={(e) => setLimits({ ...limits, [card.id]: { ...limits[card.id], daily: e.target.value } })}
                            />
                          </td>
                          <td>
                            <input
                              value={limits[card.id]?.monthly ?? ''}
                              onChange={(e) => setLimits({ ...limits, [card.id]: { ...limits[card.id], monthly: e.target.value } })}
                            />
                          </td>
                          <td>
                            <input
                              value={limits[card.id]?.perTx ?? ''}
                              onChange={(e) => setLimits({ ...limits, [card.id]: { ...limits[card.id], perTx: e.target.value } })}
                            />
                          </td>
                          <td>
                            <div className="support-template-actions" style={{ gap: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                disabled={Boolean(busy)}
                                onClick={() => void run('limit', async () => {
                                  await apiAuth(`/api/corporate/cards/${card.id}/limit`, {
                                    method: 'PUT',
                                    body: JSON.stringify({
                                      daily_limit: Number(limits[card.id]?.daily ?? -1),
                                      monthly_limit: Number(limits[card.id]?.monthly ?? -1),
                                      transaction_limit: Number(limits[card.id]?.perTx ?? -1),
                                    }),
                                  });
                                  await loadCards();
                                })}
                              >
                                {t('corp.setLimit')}
                              </button>
                              <button type="button" disabled={Boolean(busy)} onClick={() => void run('block', async () => { await apiAuth(`/api/corporate/cards/${card.id}/block`, { method: 'PUT', body: '{}' }); await loadCards(); })}>{t('corp.block')}</button>
                              <button type="button" disabled={Boolean(busy)} onClick={() => void run('unblock', async () => { await apiAuth(`/api/corporate/cards/${card.id}/unblock`, { method: 'PUT', body: '{}' }); await loadCards(); })}>{t('corp.unblock')}</button>
                              <button type="button" disabled={Boolean(busy)} onClick={() => void run('close', async () => { await apiAuth(`/api/corporate/cards/${card.id}/close`, { method: 'PUT', body: '{}' }); await loadCards(); })}>{t('corp.close')}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="support-note">{t('corp.emptyCards')}</p>}
              <div className="btn-row-left">
                <button type="button" className="btn-compact" disabled={Boolean(busy)} onClick={() => void loadCards()}>{t('corp.refresh')}</button>
              </div>
            </div>
          </>
        ) : null}

        {tab === 'activities' ? (
          <>
          <div className="support-block">
            <h3>{t('corp.wallets')}</h3>
            {!ws?.profile?.corporationTokenReady ? (
              <p className="banner-bad">{t('corp.needLoginFirst')}</p>
            ) : null}
            {wallets.length ? (
              <div className="support-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('corp.amount')}</th>
                      <th>{t('corp.corpAddress')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((row, idx) => (
                      <tr key={`${row.currency || 'tok'}-${idx}`}>
                        <td>{row.balance != null ? `${row.balance} ${row.currency || ''}`.trim() : '—'}{row.name ? ` (${row.name})` : ''}</td>
                        <td>{row.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="support-note">{t('corp.emptyWallets')}</p>
            )}
          </div>
          <div className="support-block">
            <h3>{t('corp.tabActivities')}</h3>
            {activities.length ? (
              <div className="support-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t('corp.type')}</th>
                      <th>{t('corp.status')}</th>
                      <th>{t('corp.amount')}</th>
                      <th>{t('corp.when')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((row, idx) => (
                      <tr key={row.id || String(idx)}>
                        <td>{row.id || '—'}</td>
                        <td>{row.type || row.description || '—'}</td>
                        <td>{row.status || '—'}</td>
                        <td>{row.amount != null ? `${row.amount} ${row.currency || ''}`.trim() : '—'}</td>
                        <td>{row.created_at || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="support-note">{t('corp.emptyActivities')}</p>
            )}
            <div className="btn-row-left">
              <button type="button" className="btn-compact" disabled={Boolean(busy)} onClick={() => void loadActivities()}>{t('corp.refresh')}</button>
            </div>
          </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
