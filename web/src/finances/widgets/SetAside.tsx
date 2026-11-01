// Set aside: the bills that come less often than monthly (every three
// months, once a year), each with what it costs a year, what to put aside
// from each paycheck so it is there when it comes, and when it next does;
// together, what each paycheck puts aside. Where Finances may be changed,
// a payment into savings with each paycheck can be added for it, or
// brought up to date when the bills changed.
import { Row, Rows } from '../../parts/Row';
import { Amount } from '../ui/Amount';
import { Widget } from '../ui/Widget';
import { PayMark } from '../Mark';
import { dayShort, money, perMonth, todayISO } from '../money';
import { paydaysAMonth } from './Goals';

/** The payment that sets the money aside, by its name. */
export const setAsideName = 'Set aside for bills';

export function SetAsideWidget({ v, keep }: { v: finance.View; keep?: (plan: finance.Plan) => Promise<boolean> }) {
  const bills = (v.plan.payments || []).filter((x) => ['3 months', 'year'].includes(x.schedule?.every) && !x.to && !x.card && x.amount > 0);
  const perYear = paydaysAMonth(v) * 12;
  if (!bills.length || perYear <= 0) return null;
  const yearly = (x: finance.Payment) => x.amount * perMonth(x.schedule) * 12;
  const each = (x: finance.Payment) => yearly(x) / perYear;
  const total = Math.ceil(bills.reduce((t, x) => t + each(x), 0) * 100) / 100;
  const had = (v.plan.payments || []).find((x) => x.name === setAsideName);
  const savings = (v.plan.accounts || []).find((a) => a.kind === 'savings');
  const keepIt = () => {
    const x: finance.Payment = { ...(had || { id: '', name: setAsideName, kind: 'savings', schedule: { every: 'paycheck', start: todayISO() } }), amount: total, to: had?.to || savings!.id };
    keep!({ ...v.plan, payments: had ? (v.plan.payments || []).map((q) => (q.id === had.id ? x : q)) : [...(v.plan.payments || []), x] });
  };
  const current = had && Math.abs(had.amount - total) < 0.005;
  return (
    <Widget title="Set aside for bills that come less often" span="all" kind="fx-setaside"
      actions={keep && savings && !current && <button type="button" class="small" onClick={keepIt}>{had ? `Make it ${money(total)} a paycheck` : 'Set it aside with each paycheck'}</button>}>
      <p class="fx-sub fx-setasidesays">{money(total)} from each paycheck covers them as they come{had ? (current ? `; “${setAsideName}” moves it into ${v.plan.accounts?.find((a) => a.id === had.to)?.name || 'savings'}.` : `; “${setAsideName}” moves ${money(had.amount)} now.`) : '.'}</p>
      <Rows kind="fx-rows">
        {bills.map((x) => <Row key={x.id} lead={<PayMark x={x} />} title={x.name}
          sub={`${money(yearly(x))} a year${v.next?.[x.id] ? ` · next ${dayShort(v.next[x.id])}${v.next[x.id].slice(0, 4) !== v.today.slice(0, 4) ? `, ${v.next[x.id].slice(0, 4)}` : ''}` : ''}`}
          when={<span><Amount value={each(x)} form="full" /> a paycheck</span>} whenPlain />)}
      </Rows>
    </Widget>
  );
}
