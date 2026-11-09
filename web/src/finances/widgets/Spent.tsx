// Spent this month: what the ledger says went out since the 1st, by
// category, as a donut with each category's line under it; a line opens
// its transactions (this month's, of that category) on Transactions.
// Beside Latest transactions on the Dashboard; with no ledger, no card.
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount, Stat } from '../ui/Amount';
import { Donut } from '../ui/charts';
import { Dot, type Hue } from '../ui/Legend';
import { Widget } from '../ui/Widget';
import { inHome } from '../model';
import { categoryHue } from '../hues';
import { byCategory, ranges } from '../reportData';
import { dayShort, whole } from '../money';
import type { showTransactions } from '../Transactions';

/** How many categories it names; the rest are one slice, Everything else. */
const named = 5;

export function SpentWidget({ v, ledger, open }: { v: finance.View; ledger?: finance.Ledger | null; open?: (f: Parameters<typeof showTransactions>[0]) => void }) {
  if (!ledger?.transactions.length) return null;
  const month = ranges(v.today, v.today)[0];
  const groups = byCategory(inHome(v.plan, ledger.transactions), v.categories || [], month);
  const total = groups.reduce((t, g) => t + g.amount, 0);
  const rest = groups.slice(named).reduce((t, g) => t + g.amount, 0);
  const hueOf = (name: string): Hue => categoryHue(name, v.categories) || 'muted';
  const slices = [...groups.slice(0, named).map((g) => ({ label: g.name, value: g.amount, color: hueOf(g.name) })), ...(rest > 0.005 ? [{ label: 'Everything else', value: rest, color: 'muted' as Hue }] : [])];
  return (
    <Widget title="Spent this month" kind="fx-spentmonth">
      <Stat value={<Amount value={total} />} caption={`From your transactions, to ${dayShort(v.today)}`} />
      {groups.length ? <div class="fx-donutrow">
        <Donut slices={slices} label="This month's spending by category" center={<><strong>{whole(total)}</strong>so far</>} />
        <Rows kind="fx-rows fx-spentrows">
          {slices.map((s) => <Row key={s.label} lead={<Dot color={s.color} />} title={s.label} when={<Amount value={s.value} form="whole" />} whenPlain
            onOpen={open && s.label !== 'Everything else' && s.label !== 'No category' ? () => open({ category: s.label, month: month.from.slice(0, 7) }) : undefined} openLabel="see its transactions" />)}
        </Rows>
      </div> : <Empty>Nothing spent yet this month.</Empty>}
    </Widget>
  );
}
