import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type Card, type TokenBalance } from '../api';

export default function Dashboard() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<{
    primary: TokenBalance[];
    cardSummaries: { cardId: string; panLast4: string; balance: number; currency: string }[];
  } | null>(null);

  useEffect(() => {
    api.cards
      .list(1, 10)
      .then((r) => setCards(r.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.wallet.getBalance().then(setWalletBalance).catch(() => setWalletBalance(null));
  }, [cards]);

  const totalUsd =
    (walletBalance?.primary?.reduce((s, t) => s + t.balance, 0) ?? 0) +
    (walletBalance?.cardSummaries?.reduce((s, c) => s + c.balance, 0) ?? 0);

  return (
    <div className="app-container wirex-dashboard">
      <div className="dashboard-top">
        <div className="dashboard-balance">
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <div className="total-balance-row">
            <span className="total-balance-label">{t('dashboard.totalBalance')}</span>
            <span className="total-balance-value">
              ${loading ? '...' : totalUsd.toLocaleString()}
            </span>
          </div>
        </div>
        <Link to="/cards" className="btn-primary btn-add-funds">
          {t('dashboard.addFunds')}
        </Link>
      </div>

      <div className="card-surface accounts-section">
        <h3 className="section-title">{t('dashboard.accounts')}</h3>
        {walletBalance && (
          <>
            <div className="accounts-primary">
              <div className="stat-label">{t('wallet.primaryWallet')}</div>
              <div className="wallet-tokens">
                {walletBalance.primary.map((tok) => (
                  <Link key={tok.symbol} to="/cards" className="wallet-token-chip">
                    {tok.symbol}: {tok.balance.toLocaleString()}
                  </Link>
                ))}
              </div>
            </div>
            {walletBalance.cardSummaries.length > 0 && (
              <div className="accounts-linked">
                <div className="stat-label">{t('dashboard.linkedCards')}</div>
                <p className="muted-text linked-desc">{t('dashboard.linkedDesc')}</p>
                <div className="linked-cards-list">
                  {walletBalance.cardSummaries.map((c) => (
                    <Link
                      key={c.cardId}
                      to="/cards"
                      className="linked-card-item"
                    >
                      <span className="linked-card-pan">Visa •••• {c.panLast4}</span>
                      <span className="linked-card-balance">
                        {c.balance.toLocaleString()} {c.currency}
                      </span>
                      <span className="linked-card-manage">{t('dashboard.manage')}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="dashboard-stats">
        <div className="card-surface stat-card">
          <div className="stat-label">{t('dashboard.totalCards')}</div>
          <div className="stat-value">{loading ? '...' : cards.length}</div>
        </div>
        <div className="card-surface stat-card">
          <div className="stat-label">{t('dashboard.activeCards')}</div>
          <div className="stat-value stat-success">
            {loading ? '...' : cards.filter((c) => c.status === 'active').length}
          </div>
        </div>
      </div>

      <div className="card-surface dashboard-section">
        <div className="section-header">
          <h2 className="section-title">{t('dashboard.recentActivity')}</h2>
          <Link to="/cards" className="section-link">
            {t('dashboard.viewAll')} →
          </Link>
        </div>
        {loading ? (
          <p className="muted-text">{t('common.loading')}</p>
        ) : cards.length === 0 ? (
          <p className="muted-text">
            {t('dashboard.noActivity')}{' '}
            <Link to="/cards" className="primary-link">
              {t('dashboard.issueCard')}
            </Link>
          </p>
        ) : (
          <div className="activity-list">
            {cards.slice(0, 5).map((card) => (
              <div key={card.id} className="activity-item">
                <span className="activity-pan">•••• {card.panLast4}</span>
                <span className={`badge badge-${card.status}`}>
                  {t(`cards.status.${card.status}`)}
                </span>
                <span className="muted-text">
                  {card.currency} {(card.balance ?? 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
