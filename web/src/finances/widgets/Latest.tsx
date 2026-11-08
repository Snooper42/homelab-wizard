// Latest transactions: the five newest from the ledger on the Dashboard,
// each opening its own form (or nothing, on a phone allowed only to look),
// and See all for Transactions. None yet, no card: the Dashboard reads the
// plan first, and a household that keeps no ledger has nothing to see here.
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { TxMark, txTitle } from '../Transactions';
import { dayShort, type Lookup } from '../money';

/** How many it lists. */
export const latestCount = 5;

/** The newest first: by day, and on a day the one entered last first, as Transactions lists them. */
export function latest(txs: finance.Transaction[], n = latestCount): finance.Transaction[] {
  return txs.map((t, i) => ({ t, i })).sort((a, b) => b.t.date.localeCompare(a.t.date) || b.i - a.i).slice(0, n).map((x) => x.t);
}

export function LatestWidget({ v, L, ledger, edit, all }: { v: finance.View; L: Lookup; ledger?: finance.Ledger | null; edit?: (what: 'transaction', id: string) => void; all?: () => void }) {
  const list = latest(ledger?.transactions || []);
  if (!list.length) return null;
  return (
    <Widget title="Latest transactions" span="all" kind="fx-latest" actions={all && <button type="button" class="small" onClick={all}>See all</button>}>
      <Rows kind="fx-rows">
        {list.map((t) => {
          const a = L.account[t.account];
          const what = t.splits?.length ? t.splits.map((sp) => sp.category).join(', ') : t.category || (t.to ? 'Transfer' : 'No category');
          return <Row key={t.id} lead={<TxMark t={t} categories={v.categories} />} title={txTitle(t, L)}
            sub={`${t.date === v.today ? 'Today' : dayShort(t.date)} · ${what} · ${t.to ? `${a?.name || t.account} → ${L.account[t.to]?.name || t.to}` : a?.name || t.account}`}
            when={<Amount value={t.amount} sign={t.amount > 0} tone={t.amount > 0 && !t.to ? 'in' : ''} form="full" currency={a?.currency} />} whenPlain
            onOpen={edit ? () => edit('transaction', t.id) : undefined} openLabel={edit ? 'edit' : undefined} />;
        })}
      </Rows>
    </Widget>
  );
}
