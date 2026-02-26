import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Card, type CardLimitType } from '../api';
import CardVisual from '../components/CardVisual';

export default function Cards() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [createCardModal, setCreateCardModal] = useState(false);
  const [createCardType, setCreateCardType] = useState<'virtual' | 'plastic'>('virtual');
  const [limitModal, setLimitModal] = useState<Card | null>(null);
  const [newLimit, setNewLimit] = useState('');
  const [newLimitType, setNewLimitType] = useState<CardLimitType>('daily');
  const [depositModal, setDepositModal] = useState<Card | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositing, setDepositing] = useState(false);

  const fetchCards = () => {
    api.cards
      .list()
      .then((r) => setCards(r.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleCreateCard = async () => {
    setIssuing(true);
    try {
      const card = createCardType === 'virtual'
        ? await api.cards.createVirtual({ currency: 'USD' })
        : await api.cards.createPlastic({ currency: 'USD' });
      fetchCards();
      setCreateCardModal(false);
      setLimitModal(card);
      setNewLimit('5000');
      setNewLimitType('daily');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setIssuing(false);
    }
  };

  const handleBlock = async (c: Card) => {
    if (!confirm(t('cards.confirmBlock'))) return;
    try {
      await api.cards.block(c.id);
      fetchCards();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleUnblock = async (c: Card) => {
    try {
      await api.cards.unblock(c.id);
      fetchCards();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleSetLimit = async () => {
    if (!limitModal || !newLimit) return;
    const val = parseInt(newLimit, 10);
    if (isNaN(val) || val < 0) return;
    try {
      await api.cards.setLimit(limitModal.id, val, newLimitType);
      setLimitModal(null);
      setNewLimit('');
      fetchCards();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  function getLimitDisplay(card: Card): string {
    if (card.limitType === 'lifetime') {
      const limit = card.lifetimeLimit ?? 0;
      const used = card.lifetimeUsed ?? 0;
      const remaining = limit - used;
      return `${remaining.toLocaleString()} / ${limit.toLocaleString()} ${card.currency}`;
    }
    const limit = card.dailyLimit ?? card.limit ?? 0;
    const used = card.dailyUsed ?? 0;
    return `${(limit - used).toLocaleString()} / ${limit.toLocaleString()} ${card.currency}`;
  }

  const handleDeposit = async () => {
    if (!depositModal || !depositAmount) return;
    const val = parseFloat(depositAmount);
    if (isNaN(val) || val <= 0) return;
    setDepositing(true);
    try {
      await api.wallet.depositToCard(depositModal.id, val);
      setDepositModal(null);
      setDepositAmount('');
      fetchCards();
      alert(t('wallet.depositSuccess'));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDepositing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">{t('cards.title')}</h1>
      </div>

      {loading ? (
        <p className="muted-text">{t('common.loading')}</p>
      ) : cards.length === 0 ? (
        <div className="cards-wirex-layout">
          <div className="cards-row">
            <div className="card-tile card-tile-add">
              <button
                onClick={() => setCreateCardModal(true)}
                disabled={issuing}
                className="card-add-button"
              >
                <span className="card-add-icon">+</span>
                <span className="card-add-text">{t('cards.orderNewCard')}</span>
              </button>
            </div>
          </div>
          <p className="empty-text muted-text">{t('cards.noCards')}</p>
        </div>
      ) : (
        <div className="cards-wirex-layout">
          <div className="cards-row">
            {cards.map((card, idx) => (
              <div key={card.id} className="card-tile">
                <CardVisual
                  panLast4={card.panLast4}
                  status={card.status}
                  currency={card.currency}
                  type={card.type}
                  variant={['dark', 'blue', 'purple'][idx % 3] as 'dark' | 'blue' | 'purple'}
                />
                <div className="card-tile-label">Visa •••• {card.panLast4}</div>
                <div className="card-tile-meta">
                  {(card.balance ?? 0).toLocaleString()} {card.currency}
                  {card.limitType && (
                    <span className="card-limit-badge" title={getLimitDisplay(card)}>
                      {card.limitType === 'lifetime' ? t('cards.limitTypeLifetime') : t('cards.limitTypeDaily')}: {getLimitDisplay(card)}
                    </span>
                  )}
                </div>
                <div className="card-tile-actions">
                  <button
                    onClick={() => { setDepositModal(card); setDepositAmount(''); }}
                    className="btn-primary btn-compact"
                  >
                    {t('cards.depositShort')}
                  </button>
                  {card.status === 'blocked' ? (
                    <button onClick={() => handleUnblock(card)} className="btn-secondary">
                      {t('cards.unblock')}
                    </button>
                  ) : card.status === 'active' ? (
                    <button onClick={() => handleBlock(card)} className="btn-danger">
                      {t('cards.block')}
                    </button>
                  ) : null}
                  {card.status !== 'closed' && (
                    <button
                      onClick={() => {
                        setLimitModal(card);
                        const current = card.lifetimeLimit ?? card.dailyLimit ?? card.limit ?? 5000;
                        setNewLimit(String(current));
                        setNewLimitType(card.limitType ?? 'daily');
                      }}
                      className="btn-outline"
                    >
                      {t('dashboard.manage')}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="card-tile card-tile-add">
              <button
                onClick={() => setCreateCardModal(true)}
                disabled={issuing}
                className="card-add-button"
              >
                <span className="card-add-icon">+</span>
                <span className="card-add-text">{t('cards.orderNewCard')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {depositModal && (
        <div className="modal-overlay" onClick={() => setDepositModal(null)}>
          <div className="modal-content card-surface" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('wallet.depositModal')}</h3>
            <p className="muted-text modal-desc">
              •••• {depositModal.panLast4} · {depositModal.currency}
            </p>
            <p className="muted-text modal-desc">{t('wallet.depositNote')}</p>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              min={0}
              step={10}
              placeholder={t('wallet.depositAmount')}
              className="input modal-input"
            />
            <div className="modal-actions">
              <button onClick={() => setDepositModal(null)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={handleDeposit} disabled={depositing || !depositAmount} className="btn-primary">
                {depositing ? t('common.loading') : t('wallet.depositButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {createCardModal && (
        <div className="modal-overlay" onClick={() => setCreateCardModal(false)}>
          <div className="modal-content card-surface" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('cards.createCardModal')}</h3>
            <p className="muted-text modal-desc">{t('cards.createCardDesc')}</p>
            <div className="create-card-type-row">
              <button
                type="button"
                className={`create-card-type-btn ${createCardType === 'virtual' ? 'active' : ''}`}
                onClick={() => setCreateCardType('virtual')}
              >
                {t('cards.typeVirtual')}
              </button>
              <button
                type="button"
                className={`create-card-type-btn ${createCardType === 'plastic' ? 'active' : ''}`}
                onClick={() => setCreateCardType('plastic')}
              >
                {t('cards.typePlastic')}
              </button>
            </div>
            <p className="muted-text modal-desc-small">{t('cards.createCardLimitNote')}</p>
            <div className="modal-actions">
              <button onClick={() => setCreateCardModal(false)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={handleCreateCard} disabled={issuing} className="btn-primary">
                {issuing ? t('common.loading') : t('cards.createCard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {limitModal && (
        <div className="modal-overlay" onClick={() => setLimitModal(null)}>
          <div className="modal-content card-surface" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {limitModal.limitType ? t('cards.changeLimitModal') : t('cards.setLimitModal')}
            </h3>
            <p className="muted-text modal-desc">
              •••• {limitModal.panLast4} · {limitModal.type === 'plastic' ? t('cards.typePlastic') : t('cards.typeVirtual')}
            </p>
            <div className="limit-type-row">
              <label className="limit-type-option">
                <input
                  type="radio"
                  name="limitType"
                  checked={newLimitType === 'daily'}
                  onChange={() => setNewLimitType('daily')}
                />
                <span>{t('cards.limitTypeDaily')}</span>
                <small>{t('cards.limitTypeDailyDesc')}</small>
              </label>
              <label className="limit-type-option">
                <input
                  type="radio"
                  name="limitType"
                  checked={newLimitType === 'lifetime'}
                  onChange={() => setNewLimitType('lifetime')}
                />
                <span>{t('cards.limitTypeLifetime')}</span>
                <small>{t('cards.limitTypeLifetimeDesc')}</small>
              </label>
            </div>
            <input
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
              min={0}
              placeholder={t('cards.limitPlaceholder')}
              className="input modal-input"
            />
            <div className="modal-actions">
              <button onClick={() => setLimitModal(null)} className="btn-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={handleSetLimit} className="btn-primary">
                {limitModal.limitType ? t('common.change') : t('cards.setLimit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
