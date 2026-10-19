import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LangBar from '../components/LangBar';
import { levelCode } from '../levels';
import { apiAuth, clearToken, isAuthError, type SessionAccount } from '../session';

type CardRow = { id: string; name: string; format: string; status: string };
type SpendRow = { id: string; cardId: string; merchant: string; amount: number; fee: number; orgFee?: number; userFee?: number; createdAt: string };
type ChargeRow = { id: string; feeName: string; eventCode: string; payer: 'org' | 'user'; total: number; createdAt: string };
type Me = { account: SessionAccount; cards: CardRow[]; spends: SpendRow[]; charges: ChargeRow[] };

const onSpend = new Set(['spend', 'under', 'atm']);
const dateLocale: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', th: 'th-TH', zh: 'zh-CN' };

function usd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default function UserPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<Me | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiAuth<Me>('/api/me').then(setData).catch((e: Error) => {
      setError(e.message);
      if (isAuthError(e)) navigate('/login', { replace: true });
    });
  }, [navigate]);

  if (!data) return <div className="user-app"><p className="boot">{error || t('boot')}</p></div>;

  const when = (value: string) => new Date(value).toLocaleString(dateLocale[i18n.language.slice(0, 2)] || 'en-US');
  const cardStatus = (status: string) => (status === 'active' ? t('status.active') : status === 'blocked' ? t('status.blocked') : t('status.closed'));

  return (
    <div className="user-app">
      <main className="user-wrap">
        <header className="user-top">
          <img src="/brand/icocard-logo-dark.png" alt="ICOCARD" />
          <div>
            <strong>{data.account.name}</strong>
            <p>{data.account.orgName} · {levelCode[data.account.level]}</p>
          </div>
          <LangBar />
          <button type="button" onClick={() => { clearToken(); navigate('/login'); }}>{t('nav.logout')}</button>
        </header>
        <section className="user-cards">
          {data.cards.length === 0 ? <p>{t('user.empty')}</p> : data.cards.map((card) => (
            <article key={card.id} className="user-card">
              <span>{card.format === 'plastic' ? t('card.plastic') : t('card.virtual')}</span>
              <strong>{card.name}</strong>
              <em>{cardStatus(card.status)}</em>
            </article>
          ))}
        </section>
        <section className="user-tx">
          <h1>{t('user.tx')}</h1>
          <p>{t('user.lead')}</p>
          <table>
            <thead><tr><th>{t('tx.time')}</th><th>{t('tx.what')}</th><th>{t('tx.amount')}</th><th>{t('tx.myFee')}</th><th>{t('tx.orgFee')}</th></tr></thead>
            <tbody>
              {data.spends.map((row) => (
                <tr key={row.id}>
                  <td>{when(row.createdAt)}</td>
                  <td>{row.merchant}</td>
                  <td>{usd(row.amount)}</td>
                  <td>{usd(row.userFee ?? 0)}</td>
                  <td>{usd(row.orgFee ?? row.fee)}</td>
                </tr>
              ))}
              {data.charges.filter((row) => !onSpend.has(row.eventCode)).map((row) => (
                <tr key={row.id}>
                  <td>{when(row.createdAt)}</td>
                  <td>{row.feeName}</td>
                  <td>{usd(0)}</td>
                  <td>{row.payer === 'user' ? usd(row.total) : usd(0)}</td>
                  <td>{row.payer === 'org' ? usd(row.total) : usd(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
