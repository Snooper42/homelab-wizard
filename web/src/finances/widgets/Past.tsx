// What happened in a pay period before now, the Dashboard's card for it in
// the paycheck card's place when the period bar steps back: what came in
// and went out, from the ledger (a move between the household's own
// accounts is neither), and that period's transactions, the newest first,
// each opening its own form. The plan says what was meant to happen; this
// says what did.
import { useState } from 'preact/hooks';
import { Empty } from '../../parts/Empty';
import { Rows } from '../../parts/Row';
import { Amount, Delta, Stat } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { inHome } from '../model';
import { totals } from '../reportData';
import { dayShort, type Lookup } from '../money';
import { latest, TxRow } from './Latest';

/** How many transactions show before Show all. */
const shown = 6;

/** What happened in the days given (a pay period before now, or a month, or this month so far). */
export function PastWidget({ v, L, past, title = 'What happened', ledger, edit }: { v: finance.View; L: Lookup; past: { start: string; last: string }; title?: string; ledger?: finance.Ledger | null; edit?: (what: 'transaction', id: string) => void }) {
  const [all, setAll] = useState(false);
  const range = { key: 'period', label: '', from: past.start, to: past.last };
  const txs = inHome(v.plan, ledger?.transactions || []).filter((t) => t.date >= past.start && t.date <= past.last);
  const sum = totals(txs, range);
  const list = latest(txs, all ? txs.length : shown);
  return (
    <Widget title={title} kind="fx-past" span="all">
      <p class="fx-sub fx-lead fx-dates">{dayShort(past.start)} – {dayShort(past.last)}, from your transactions</p>
      {txs.length ? <>
        <div class="fx-pastsums">
          <Stat value={<Amount value={sum.in} tone="in" />} caption="Came in" />
          <Stat value={<Amount value={sum.out} />} caption="Went out" aside={<Delta value={sum.in - sum.out} label="left over" />} />
        </div>
        <Rows kind="fx-rows">
          {list.map((t) => <TxRow key={t.id} t={t} v={v} L={L} edit={edit} />)}
        </Rows>
        {txs.length > shown && <p class="actions fx-more"><button type="button" class="small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${txs.length} transactions`}</button></p>}
      </> : <Empty>{ledger?.transactions.length ? 'No transactions kept for these days.' : 'What happened shows here once you import or add your transactions.'}</Empty>}
    </Widget>
  );
}
