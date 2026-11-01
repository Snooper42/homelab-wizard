// A month of money: what is left of it (Cash flow), where the spending
// goes (Where it goes), and how it flows, pay to bills, saving, and what
// is left (Money flow). The pay period card picks a paycheck.
import { Amount, Stat, Tiles } from '../ui/Amount';
import { Donut, FlowChart, type FlowPart } from '../ui/charts';
import { Legend, SplitBar } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { kindName, month, surplus } from '../model';
import { dayShort, type Lookup, money, perMonth, whole } from '../money';


export function CashFlowWidget({ v, L }: { v: finance.View; L: Lookup }) {
  const m = month(v, L);
  return (
    <Widget title="Cash flow" kind="fx-flow">
      <Stat value={<Amount value={m.left} sign tone="auto" />} caption="Left in a typical month" />
      <SplitBar label="A typical month's pay" parts={[{ label: 'Spent', value: m.spent, color: 'out' }, { label: 'Saved', value: m.saved, color: 'save' }, { label: 'Left', value: Math.max(0, m.left), color: 'in' }]} />
      <Tiles items={[
        { label: 'Income', value: whole(m.in), tone: 'in' },
        { label: 'Spending', value: whole(m.spent), tone: 'out' },
        { label: 'Saved', value: m.in ? `${Math.round(((m.saved + m.viaPay) / (m.in + m.viaPay)) * 100)}%` : whole(m.saved), tone: 'save' },
      ]} />
    </Widget>
  );
}

/** Each payment kind keeps its colour on the donut and in its legend. */
const kindHue: Record<string, number> = { home: 8, cards: 7, spending: 2, car: 1, utilities: 3, subscriptions: 5, loans: 4, other: 6 };

export function SpendingWidget({ v, L }: { v: finance.View; L: Lookup }) {
  const m = month(v, L);
  if (!m.byKind.length) return null;
  const slices = m.byKind.map((k) => ({ label: kindName(k.kind), value: k.amount, color: kindHue[k.kind] ?? 6 }));
  return (
    <Widget title="Where it goes" kind="fx-spend">
      <Stat value={<Amount value={-m.spent} />} caption="Spent in a typical month" />
      <div class="fx-donutrow">
        <Donut slices={slices} label="A typical month's spending" center={<><strong>{whole(m.spent)}</strong>a month</>} />
        <Legend items={slices.slice(0, 6).map((s) => ({ label: s.label, color: s.color, value: whole(s.value) }))} />
      </div>
    </Widget>
  );
}

/**
 * Money flow: a typical month, each person's pay into one month's pay, and
 * out of it each kind of bill, what is saved, and what is left over (or,
 * when the month takes more than comes in, what comes out of the accounts
 * too). A legend with every amount under the picture, and a table for a
 * screen reader.
 */
export function MoneyFlowWidget({ v, L }: { v: finance.View; L: Lookup }) {
  const m = month(v, L);
  const people = v.plan.people || [];
  if (!people.length || m.in <= 0) return null;
  const from: FlowPart[] = people.map((e) => ({ label: `${e.name}'s pay`, value: e.net * perMonth(e.schedule), color: 'in' as const }));
  if (m.left < -0.005) from.push({ label: 'From the accounts', value: -m.left, color: 'muted' });
  const to: FlowPart[] = [...m.byKind.map((k) => ({ label: kindName(k.kind), value: k.amount, color: (kindHue[k.kind] ?? 6) as FlowPart['color'] })),
    { label: 'Saved', value: m.saved, color: 'save' as const }, { label: 'Left over', value: Math.max(0, m.left), color: 'in' as const }].filter((p) => p.value > 0.005);
  return (
    <Widget title="Money flow" span="all" kind="fx-moneyflow">
      <FlowChart from={from} to={to} label={`A typical month: ${whole(m.in)} of pay, to ${to.map((p) => p.label.toLowerCase()).join(', ')}. The lists under it have every amount.`} />
      <div class="fx-flowlegend">
        <Legend items={from.map((p) => ({ label: p.label, color: p.color, value: whole(p.value) }))} />
        <Legend items={to.map((p) => ({ label: p.label, color: p.color, value: whole(p.value) }))} />
      </div>
      <table class="sr"><caption>A typical month's money, in and out</caption>
        <thead><tr><th scope="col">From or to</th><th scope="col">A month</th></tr></thead>
        <tbody>{[...from.map((p) => ['In: ' + p.label, p.value] as const), ...to.map((p) => ['Out: ' + p.label, p.value] as const)].map(([k, n]) => <tr key={k}><th scope="row">{k}</th><td>{money(n)}</td></tr>)}</tbody>
      </table>
    </Widget>
  );
}
