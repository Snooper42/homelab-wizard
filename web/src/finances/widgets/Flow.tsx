// A month of money: what is left of it (Cash flow), where the spending
// goes (Where it goes), and what each paycheck leaves after its bills,
// as bars that pick the paycheck the dashboard shows.
import { Amount, Stat, Tiles } from '../ui/Amount';
import { Bars, Donut } from '../ui/charts';
import { Legend, SplitBar } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { kindName, month, surplus } from '../model';
import { dayShort, type Lookup, money, whole } from '../money';

/** How many paychecks the bars show. */
const ahead = 6;

export function CashFlowWidget({ v, L, sel, pick }: { v: finance.View; L: Lookup; sel: number; pick: (i: number) => void }) {
  const m = month(v, L);
  // The paychecks ahead (period 0 is now, before the next one, and brings nothing in).
  const first = v.periods[0]?.now ? 1 : 0;
  const periods = v.periods.slice(first, first + ahead);
  return (
    <Widget title="Cash flow" kind="fx-flow">
      <Stat value={<Amount value={m.left} sign tone="auto" />} caption="Left in a typical month" />
      <SplitBar label="A typical month's pay" parts={[{ label: 'Spent', value: m.spent, color: 'out' }, { label: 'Saved', value: m.saved, color: 'save' }, { label: 'Left', value: Math.max(0, m.left), color: 'in' }]} />
      <Tiles items={[
        { label: 'Income', value: whole(m.in), tone: 'in' },
        { label: 'Spending', value: whole(m.spent), tone: 'out' },
        { label: 'Saved', value: m.in ? `${Math.round(((m.saved + m.viaPay) / (m.in + m.viaPay)) * 100)}%` : whole(m.saved), tone: 'save' },
      ]} />
      {!!periods.length && <>
        <div class="fx-caption">Each paycheck, after its bills</div>
        <Bars bars={periods.map((p) => ({ label: dayShort(p.pay?.date || p.start), sub: p.pay?.people.map((id) => L.person[id]?.name || id).join(' & '), value: surplus(p) }))}
          picked={sel - first} pick={(i) => pick(i + first)}
          label="What each paycheck leaves after the bills it covers; pick one to see its payments."
          say={(b) => `${b.label}, ${b.sub}: ${b.value < 0 ? `short ${money(-b.value)}` : `${money(b.value)} left`}`} />
      </>}
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
