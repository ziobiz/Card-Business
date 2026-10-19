import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { levelCode, type OrgLevel } from '../levels';
import { apiAuth, isAuthError } from '../session';

type OrgNode = {
  id: string;
  name: string;
  level: OrgLevel;
  remainingCards: number;
  remainingLimit: number;
  limitBudget: number;
  limitUsed?: number;
  profile?: { useYn?: 'Y' | 'N' | 'S' };
  children: OrgNode[];
};
type CardRow = { id: string; name: string; status: string; orgId: string; format?: 'virtual' | 'plastic' };
type SpendRow = { id: string; orgId: string; amount: number; orgFee?: number; userFee?: number; fee: number; merchant: string };
type Overview = { tree: OrgNode; cards: CardRow[]; spends: SpendRow[]; users: { id: string; orgId?: string }[] };

function flatten(node: OrgNode): OrgNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function useOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void apiAuth<Overview>('/api/overview').then(setData).catch((err: Error) => {
      setError(err.message);
      if (isAuthError(err)) navigate('/admin/login', { replace: true });
    });
  }, [navigate]);
  return { data, error };
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function accountLine(org: OrgNode) {
  return `${levelCode[org.level]} ${org.name}`;
}

function operating(org: OrgNode) {
  const use = org.profile?.useYn;
  return use !== 'N' && use !== 'S';
}

function ratio(org: OrgNode) {
  if (org.limitBudget <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((org.remainingLimit / org.limitBudget) * 100)));
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data, error } = useOverview();
  if (!data) return <p className="boot">{error || t('boot')}</p>;
  const orgs = flatten(data.tree);
  const live = orgs.filter(operating);
  const paused = orgs.length - live.length;
  const openCards = data.cards.filter((card) => card.status !== 'closed');
  const virtual = openCards.filter((card) => card.format !== 'plastic').length;
  const plastic = openCards.filter((card) => card.format === 'plastic').length;
  const used = orgs.reduce((sum, org) => sum + (org.limitUsed || 0), 0);
  return (
    <>
      <section className="panel">
        <h2>{accountLine(data.tree)}</h2>
        <div className="stat-row desk-stats">
          <article><span>{t('desk.live')}</span><strong>{live.length}</strong></article>
          <article><span>{t('desk.virtual')}</span><strong>{virtual}</strong></article>
          <article><span>{t('desk.plastic')}</span><strong className="plastic">{plastic}</strong></article>
          <article><span>{t('desk.loaded')}</span><strong>{money(data.tree.limitBudget)}</strong></article>
          <article><span>{t('desk.used')}</span><strong>{money(used)}</strong></article>
          <article><span>{t('desk.balance')}</span><strong>{money(data.tree.remainingLimit)}</strong></article>
        </div>
      </section>
      <section className="panel">
        <h2>{t('desk.board')}{paused ? ` · ${t('desk.paused', { n: paused })}` : ''}</h2>
        {live.length === 0 ? <p className="hint">{t('desk.empty')}</p> : (
          <table className="desk-table">
            <thead>
              <tr>
                <th>{t('desk.orgs')}</th>
                <th>{t('desk.level')}</th>
                <th className="num">{t('desk.virtual')}</th>
                <th className="num">{t('desk.plastic')}</th>
                <th className="num">{t('desk.loaded')}</th>
                <th className="num">{t('desk.used')}</th>
                <th className="num">{t('desk.balance')}</th>
                <th>{t('desk.ratio')}</th>
              </tr>
            </thead>
            <tbody>
              {live.map((org) => {
                const cards = openCards.filter((card) => card.orgId === org.id);
                const v = cards.filter((card) => card.format !== 'plastic');
                const p = cards.filter((card) => card.format === 'plastic');
                const vBlocked = v.filter((card) => card.status === 'blocked').length;
                const pBlocked = p.filter((card) => card.status === 'blocked').length;
                const users = data.users.filter((user) => user.orgId === org.id).length;
                const left = ratio(org);
                const tone = left <= 20 ? 'bad' : left <= 50 ? 'warn' : '';
                return (
                  <tr key={org.id} className={left <= 20 && org.limitBudget > 0 ? 'is-low' : ''}>
                    <td className="desk-org">{org.name}<small>{t('desk.usersN', { n: users })}</small></td>
                    <td>{levelCode[org.level]}</td>
                    <td className="num">{v.length}{vBlocked ? <small>{t('desk.blockedN', { n: vBlocked })}</small> : null}</td>
                    <td className="num">{p.length}{pBlocked ? <small>{t('desk.blockedN', { n: pBlocked })}</small> : null}</td>
                    <td className="num">{money(org.limitBudget)}</td>
                    <td className="num">{money(org.limitUsed || 0)}</td>
                    <td className="num">{money(org.remainingLimit)}</td>
                    <td><span className={`desk-bar ${tone}`}><i style={{ width: `${left}%` }} /></span><small>{left}%</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export function RiskPage() {
  const { t } = useTranslation();
  const { data, error } = useOverview();
  if (!data) return <p className="boot">{error || t('boot')}</p>;
  const low = flatten(data.tree).filter((org) => org.limitBudget > 0 && org.remainingLimit / org.limitBudget <= 0.2);
  const blocked = data.cards.filter((card) => card.status === 'blocked');
  return (
    <>
      <p className="hint">{t('desk.riskLead')}</p>
      <section className="panel"><h2>{t('desk.low')}</h2>
        <table><tbody>{low.map((org) => <tr key={org.id}><td>{levelCode[org.level]} {org.name}</td><td>{money(org.remainingLimit)}</td></tr>)}</tbody></table>
      </section>
      <section className="panel"><h2>{t('desk.blocked')}</h2>
        <table><tbody>{blocked.map((card) => <tr key={card.id}><td>{card.name}</td><td>{card.status}</td></tr>)}</tbody></table>
      </section>
    </>
  );
}

export function RevenuePage() {
  const { t } = useTranslation();
  const { data, error } = useOverview();
  if (!data) return <p className="boot">{error || t('boot')}</p>;
  const orgFee = data.spends.reduce((sum, row) => sum + (row.orgFee ?? row.fee), 0);
  const userFee = data.spends.reduce((sum, row) => sum + (row.userFee ?? 0), 0);
  return (
    <>
      <p className="hint">{t('desk.revenueLead')}</p>
      <div className="stat-row">
        <article><span>{t('desk.orgFee')}</span><strong>{money(orgFee)}</strong></article>
        <article><span>{t('desk.userFee')}</span><strong>{money(userFee)}</strong></article>
      </div>
    </>
  );
}

export function BrandPage() {
  const { t } = useTranslation();
  return (
    <section className="panel">
      <h2>ICOCARD</h2>
      <p>{t('desk.brandLead')}</p>
      <img src="/brand/icocard-logo.png" alt="ICOCARD" style={{ maxHeight: 48 }} />
    </section>
  );
}

export function AccessPage() {
  const { t } = useTranslation();
  const rows = [
    ['Admin', 'dashboard, orgs, risk, revenue, usage, fees, orgOps, users, activity, access, manual'],
    ['Accountant', 'dashboard, revenue, fees, activity, manual'],
    ['General', 'dashboard, orgs, users, usage, activity, manual'],
    ['Operator', 'dashboard, usage, activity, manual'],
  ];
  return (
    <section className="panel">
      <h2>{t('menu.access')}</h2>
      <p>{t('desk.accessLead')}</p>
      <table><tbody>{rows.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td></tr>)}</tbody></table>
    </section>
  );
}

export function PlatformPage() {
  const { t } = useTranslation();
  return (
    <section className="panel">
      <h2>{t('menu.platform')}</h2>
      <p>{t('desk.platformLead')}</p>
      <table>
        <tbody>
          <tr><th>{t('desk.domain')}</th><td>business.icocard.net</td></tr>
          <tr><th>{t('desk.ssl')}</th><td>HTTPS</td></tr>
          <tr><th>{t('desk.chain')}</th><td>Base Sepolia 84532</td></tr>
        </tbody>
      </table>
    </section>
  );
}

export function ManualPage() {
  const { t } = useTranslation();
  return (
    <section className="panel">
      <h2>{t('menu.manual')}</h2>
      <p>{t('desk.manualLead')}</p>
    </section>
  );
}
