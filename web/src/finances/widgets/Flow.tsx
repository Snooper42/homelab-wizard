// A month of money: what is left of it (Cash flow) and where the spending
// goes (Where it goes). The pay period card picks a paycheck.
import { Amount, Stat, Tiles } from '../ui/Amount';
import { Donut } from '../ui/charts';
import { Legend, SplitBar } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { kindName, month, surplus } from '../model';
import { dayShort, type Lookup, money, whole } from '../money';


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
