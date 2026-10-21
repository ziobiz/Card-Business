import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiAuth } from '../session';

type Level = 'hq' | 'large' | 'middle' | 'small';
type Rate = { pct: number; fixed: number };
type FeeEvent = { id: string; name: string; code: string };
type FeeItem = { id: string; name: string; eventId: string; payer: 'org' | 'user'; threshold: number | null; w: Rate; hq: Rate };
type Markup = { orgId: string; feeItemId: string; pct: number; fixed: number };
type OrgRef = { id: string; name: string; level: Level; parentId: string | null };
type FeeBook = { role: 'hq' | 'org'; orgId: string; level: Level; events: FeeEvent[]; items: FeeItem[]; markups: Markup[]; orgs: OrgRef[] };
type Cell = { pct: string; fixed: string };
type Draft = { name: string; payer: 'org' | 'user'; threshold: string; w: Cell; hq: Cell; large: Cell; middle: Cell; small: Cell };

const layers = [
  { key: 'w', label: 'W' },
  { key: 'hq', label: 'HQ' },
  { key: 'large', label: 'BL' },
  { key: 'middle', label: 'ML' },
  { key: 'small', label: 'SL' },
] as const;

const builtin = new Set(['issue', 'monthly', 'spend', 'block', 'unblock', 'reissue', 'atm', 'under']);

function chainOf(orgs: OrgRef[], id: string) {
  const chain: OrgRef[] = [];
  const seen = new Set<string>();
  let current = orgs.find((org) => org.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? orgs.find((org) => org.id === current?.parentId) : undefined;
  }
  return chain;
}

function cell(rate?: Rate): Cell {
  return { pct: String(rate?.pct ?? 0), fixed: String(rate?.fixed ?? 0) };
}

function draftOf(item: FeeItem, orgs: OrgRef[], markups: Markup[], selectedId: string): Draft {
  const chain = chainOf(orgs, selectedId);
  const at = (level: Level) => {
    const owner = chain.find((org) => org.level === level);
    const markup = owner ? markups.find((row) => row.orgId === owner.id && row.feeItemId === item.id) : undefined;
    return cell(markup);
  };
  return {
    name: item.name,
    payer: item.payer,
    threshold: item.threshold == null ? '' : String(item.threshold),
    w: cell(item.w),
    hq: cell(item.hq),
    large: at('large'),
    middle: at('middle'),
    small: at('small'),
  };
}

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function FeeBoard({ selectedId }: { selectedId: string }) {
  const { t } = useTranslation();
  const [book, setBook] = useState<FeeBook | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState('');
  const [eventForm, setEventForm] = useState({ name: '', code: '' });
  const [itemForm, setItemForm] = useState({ name: '', eventId: '', payer: 'org', threshold: '' });
  const [sample, setSample] = useState('100');

  const load = async () => {
    const next = await apiAuth<FeeBook>('/api/fees');
    setBook(next);
    setItemForm((current) => ({ ...current, eventId: current.eventId || next.events[0]?.id || '' }));
  };

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!book) return;
    const next: Record<string, Draft> = {};
    for (const item of book.items) next[item.id] = draftOf(item, book.orgs, book.markups, selectedId);
    setDrafts(next);
  }, [book, selectedId]);

  const selectedChain = useMemo(() => (book ? chainOf(book.orgs, selectedId) : []), [book, selectedId]);
  const ownerOf = (level: Level) => selectedChain.find((org) => org.level === level);

  const canEdit = (level: (typeof layers)[number]['key']) => {
    if (!book) return false;
    if (level === 'w' || level === 'hq') return book.role === 'hq';
    const owner = ownerOf(level);
    if (!owner) return false;
    return book.role === 'hq' || owner.id === book.orgId;
  };

  const saveItem = async (item: FeeItem) => {
    if (!book) return;
    const draft = drafts[item.id];
    if (!draft) return;
    setError('');
    const markups = (['large', 'middle', 'small'] as const).flatMap((level) => {
      const owner = ownerOf(level);
      if (!owner || !canEdit(level)) return [];
      return [{ orgId: owner.id, pct: num(draft[level].pct), fixed: num(draft[level].fixed) }];
    });
    const body: Record<string, unknown> = { markups };
    if (book.role === 'hq') {
      body.name = draft.name;
      body.payer = draft.payer;
      body.threshold = draft.threshold === '' ? null : num(draft.threshold);
      body.w = { pct: num(draft.w.pct), fixed: num(draft.w.fixed) };
      body.hq = { pct: num(draft.hq.pct), fixed: num(draft.hq.fixed) };
    }
    try {
      await apiAuth(`/api/fees/${item.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addEvent = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await apiAuth('/api/fee-events', { method: 'POST', body: JSON.stringify(eventForm) });
      setEventForm({ name: '', code: '' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const addItem = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await apiAuth('/api/fees', {
        method: 'POST',
        body: JSON.stringify({
          name: itemForm.name,
          eventId: itemForm.eventId,
          payer: itemForm.payer,
          threshold: itemForm.threshold === '' ? null : num(itemForm.threshold),
        }),
      });
      setItemForm({ name: '', eventId: book?.events[0]?.id ?? '', payer: 'org', threshold: '' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (path: string) => {
    setError('');
    try {
      await apiAuth(path, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!book) return <p className="boot">{error || t('fee.loading')}</p>;

  const chosenEvent = book.events.find((event) => event.id === itemForm.eventId);
  const sampleAmount = num(sample);

  return (
    <div className="fee-board">
      {error ? <p className="banner-bad">{error}</p> : null}
      <section className="panel">
        <h2>{t('fee.title')}</h2>
        <p className="hint">{t('fee.lead')}</p>
        <p className="hint">{t('fee.scope')}</p>
        <p className="hint">{t('fee.waterfall', { chain: selectedChain.map((org) => `${org.level === 'hq' ? 'HQ' : org.level === 'large' ? 'BL' : org.level === 'middle' ? 'ML' : 'SL'} ${org.name}`).join(' → ') })}</p>
        <label className="sample">{t('fee.sample')}
          <input value={sample} onChange={(e) => setSample(e.target.value)} />
        </label>
      </section>

      {book.role === 'hq' ? (
        <div className="fee-forms">
          <form className="panel" onSubmit={addEvent}>
            <h2>{t('fee.addEvent')}</h2>
            <label>{t('fee.eventName')}<input value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} required /></label>
            <label>{t('fee.eventCode')}<input value={eventForm.code} onChange={(e) => setEventForm({ ...eventForm, code: e.target.value })} placeholder="late_fee" required /></label>
            <button type="submit">{t('fee.addEventBtn')}</button>
          </form>
          <form className="panel" onSubmit={addItem}>
            <h2>{t('fee.addItem')}</h2>
            <label>{t('fee.eventName')}<input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required /></label>
            <label>{t('fee.when')}
              <select value={itemForm.eventId} onChange={(e) => setItemForm({ ...itemForm, eventId: e.target.value })}>
                {book.events.map((event) => <option key={event.id} value={event.id}>{t(`event.${event.code}`, { defaultValue: event.name })}</option>)}
              </select>
            </label>
            <label>{t('fee.payer')}
              <select value={itemForm.payer} onChange={(e) => setItemForm({ ...itemForm, payer: e.target.value })}>
                <option value="org">{t('fee.payerOrg')}</option>
                <option value="user">{t('fee.payerUser')}</option>
              </select>
            </label>
            {chosenEvent?.code === 'under' ? (
              <label>{t('fee.underAmount')}<input value={itemForm.threshold} onChange={(e) => setItemForm({ ...itemForm, threshold: e.target.value })} required /></label>
            ) : null}
            <button type="submit">{t('fee.addItemBtn')}</button>
          </form>
        </div>
      ) : null}

      <section className="panel">
        <h2>{t('fee.events')}</h2>
        <div className="event-list">
          {book.events.map((event) => (
            <span key={event.id}>
              {t(`event.${event.code}`, { defaultValue: event.name })}
              <em>{event.code}</em>
              {book.role === 'hq' && !builtin.has(event.code) ? (
                <button type="button" onClick={() => void remove(`/api/fee-events/${event.id}`)}>{t('fee.delete')}</button>
              ) : null}
            </span>
          ))}
        </div>
      </section>

      <section className="panel fee-wrap">
        <h2>{t('fee.markup')}</h2>
        <table className="fee-grid">
          <thead>
            <tr>
              <th>{t('fee.colFee')}</th>
              <th>{t('fee.colPayer')}</th>
              {layers.map((layer) => <th key={layer.key}>{layer.label}<small>{t('fee.unit')}</small></th>)}
              <th>{t('fee.total')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {book.items.map((item) => {
              const draft = drafts[item.id];
              if (!draft) return null;
              const event = book.events.find((row) => row.id === item.eventId);
              const pct = layers.reduce((sum, layer) => sum + num(draft[layer.key].pct), 0);
              const fixed = layers.reduce((sum, layer) => sum + num(draft[layer.key].fixed), 0);
              const total = Math.round((sampleAmount * pct / 100 + fixed) * 100) / 100;
              const setCell = (level: (typeof layers)[number]['key'], key: keyof Cell, value: string) => {
                setDrafts({ ...drafts, [item.id]: { ...draft, [level]: { ...draft[level], [key]: value } } });
              };
              return (
                <tr key={item.id}>
                  <td>
                    {book.role === 'hq' ? (
                      <input value={draft.name} onChange={(e) => setDrafts({ ...drafts, [item.id]: { ...draft, name: e.target.value } })} />
                    ) : draft.name}
                    <small>{event ? t(`event.${event.code}`, { defaultValue: event.name }) : ''}{event?.code === 'under' ? ` · ${t('fee.underNote', { amount: draft.threshold || item.threshold })}` : ''}</small>
                  </td>
                  <td>
                    {book.role === 'hq' ? (
                      <select value={draft.payer} onChange={(e) => setDrafts({ ...drafts, [item.id]: { ...draft, payer: e.target.value as 'org' | 'user' } })}>
                        <option value="org">{t('fee.org')}</option>
                        <option value="user">{t('fee.user')}</option>
                      </select>
                    ) : (draft.payer === 'org' ? t('fee.org') : t('fee.user'))}
                    {book.role === 'hq' && event?.code === 'under' ? (
                      <input value={draft.threshold} onChange={(e) => setDrafts({ ...drafts, [item.id]: { ...draft, threshold: e.target.value } })} />
                    ) : null}
                  </td>
                  {layers.map((layer) => (
                    <td key={layer.key}>
                      <input value={draft[layer.key].pct} disabled={!canEdit(layer.key)} onChange={(e) => setCell(layer.key, 'pct', e.target.value)} />
                      <input value={draft[layer.key].fixed} disabled={!canEdit(layer.key)} onChange={(e) => setCell(layer.key, 'fixed', e.target.value)} />
                    </td>
                  ))}
                  <td>{pct}% + {fixed}<strong>{total}</strong></td>
                  <td>
                    <button type="button" onClick={() => void saveItem(item)}>{t('fee.save')}</button>
                    {book.role === 'hq' ? <button type="button" onClick={() => void remove(`/api/fees/${item.id}`)}>{t('fee.delete')}</button> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {book.items.length === 0 ? <p className="hint">{t('fee.empty')}</p> : null}
      </section>
    </div>
  );
}
