import type { ComponentChildren } from 'preact';
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { TxMark, txTitle } from '../Transactions';
import { dayShort, type Lookup } from '../money';
import { Dot } from '../ui/Legend';
import { categoryHue } from '../hues';

/** How many it lists. */
export const latestCount = 5;

/** The newest first: by day, and on a day the one entered last first, as Transactions lists them. */
export function latest(txs: finance.Transaction[], n = latestCount): finance.Transaction[] {
  return txs.map((t, i) => ({ t, i })).sort((a, b) => b.t.date.localeCompare(a.t.date) || b.i - a.i).slice(0, n).map((x) => x.t);
}

/** One transaction's row, as the Dashboard lists them: its mark, payee, day, category and account, and amount; it opens its form where it may. */
export function TxRow({ t, v, L, edit, end, compact }: { t: finance.Transaction; v: finance.View; L: Lookup; edit?: (what: 'transaction', id: string) => void; end?: ComponentChildren;
  compact?: boolean }) {
  const a = L.account[t.account];
  const what = t.splits?.length ? t.splits.map((sp) => sp.category).join(', ') : t.category || (t.to ? 'Transfer' : 'No category');
  const day = t.date === v.today ? 'Today' : dayShort(t.date);
  const amount = <Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 && !t.to ? 'in' : ''} form="full" currency={a?.currency} />;
  if (compact) {
    // Its category's colour; 0 is none (income): no dot then, and no room kept for one beside the word.
    const catHue = t.splits?.length || t.category ? categoryHue(t.splits?.length ? t.splits[0].category : t.category, v.categories) : 0;
    return <Row lead={<TxMark t={t} categories={v.categories} />} title={txTitle(t, L)}
      sub={<span class="fx-txcat">{!!catHue && <Dot color={catHue} />}{what}</span>}
      end={end} when={<span class="fx-whenstack">{amount}<span class="fx-sub">{day}</span></span>} whenPlain
      onOpen={edit ? () => edit('transaction', t.id) : undefined} openLabel={edit ? 'edit' : undefined} />;
  }
  return <Row lead={<TxMark t={t} categories={v.categories} />} title={txTitle(t, L)}
    sub={`${t.date === v.today ? 'Today' : dayShort(t.date)} · ${what} · ${t.to ? `${a?.name || t.account} → ${L.account[t.to]?.name || t.to}` : a?.name || t.account}`}
    end={end} when={<Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 && !t.to ? 'in' : ''} form="full" currency={a?.currency} />} whenPlain
    onOpen={edit ? () => edit('transaction', t.id) : undefined} openLabel={edit ? 'edit' : undefined} />;
}

export function LatestWidget({ v, L, ledger, edit, all, count = latestCount }: { v: finance.View; L: Lookup; ledger?: finance.Ledger | null; edit?: (what: 'transaction', id: string) => void; all?: () => void;
  /** How many (the computer's Dashboard: nine, beside the lead card down two rows). */ count?: number }) {
  const list = latest(ledger?.transactions || [], count);
  if (!list.length) return null;
  return (
    <Widget title="Latest transactions" kind="fx-latest" open={all} openLabel="Open Transactions">
      <Rows kind="fx-rows">
        {list.map((t) => <TxRow key={t.id} t={t} v={v} L={L} edit={edit} compact />)}
      </Rows>
    </Widget>
  );
}
