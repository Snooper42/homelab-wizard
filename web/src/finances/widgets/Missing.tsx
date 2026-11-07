// A bill not seen yet: a planned payment the ledger has paid before (so
// the household follows it there) with no transaction for its last day,
// three days or more after it, up to two weeks. The Dashboard says which,
// so a bill that didn't go through is caught; Transactions finds it.
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { PayMark } from '../Mark';
import { dayLong, daysBetween, type Lookup } from '../money';

/** Days after its day before a bill counts as not seen; and how long it is said. */
const grace = 3, said = 14;

/** A bill not seen yet: its payment and its day. */
export interface Missing { payment: string; due: string }

/** Each followed bill whose last day passed three days to two weeks ago with nothing paid for it. */
export function missingBills(v: finance.View): Missing[] {
  const paid = v.paid || [];
  const out: Missing[] = [];
  for (const x of v.plan.payments || []) {
    const due = v.last?.[x.id];
    if (!due || x.card || x.payer || !(x.amount > 0)) continue;
    const late = daysBetween(due, v.today);
    if (late < grace || late > said) continue;
    // Followed: paid in the ledger before; not seen: nothing for this day.
    if (!paid.some((p) => p.payment === x.id && p.due < due) || paid.some((p) => p.payment === x.id && p.due === due)) continue;
    out.push({ payment: x.id, due });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

export function MissingWidget({ v, L, open }: { v: finance.View; L: Lookup; open?: () => void }) {
  const list = missingBills(v).filter((m) => L.payment[m.payment]);
  if (!list.length) return null;
  return (
    <Widget title={list.length === 1 ? 'A bill not seen yet' : 'Bills not seen yet'} span="all" kind="fx-missing"
      actions={open && <button type="button" class="small" onClick={open}>Transactions</button>}>
      <p class="fx-sub fx-lead">{list.length === 1 ? 'Paid before, but nothing in your transactions pays it yet. If it went through, link it in Transactions.' : 'Paid before, but nothing in your transactions pays these yet. If one went through, link it in Transactions.'}</p>
      <Rows kind="fx-rows">
        {list.map((m) => {
          const x = L.payment[m.payment];
          return <Row key={m.payment} lead={<PayMark x={x} />} title={x.name} sub={`Due ${dayLong(m.due)}, ${daysBetween(m.due, v.today)} days ago`}
            when={<Amount value={-x.amount} form="full" />} whenPlain />;
        })}
      </Rows>
    </Widget>
  );
}
