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
import { dayShort, monthName, whole } from '../money';
import type { showTransactions } from '../Transactions';

/** How many categories it names; the rest are one slice, Everything else. */
const named = 5;

/** Spent this month, or in the days given (a pay period before now, picked by the Dashboard's period bar). */
export function SpentWidget({ v, ledger, open, days }: { v: finance.View; ledger?: finance.Ledger | null; open?: (f: Parameters<typeof showTransactions>[0]) => void; days?: { from: string; to: string } }) {
  if (!ledger?.transactions.length) return null;
  const month = days ? { key: 'period', label: '', ...days } : ranges(v.today, v.today)[0];
  // A category opens its transactions of the month; for days within one month, of that month.
  const inMonth = !days || days.from.slice(0, 7) === days.to.slice(0, 7);
  const groups = byCategory(inHome(v.plan, ledger.transactions), v.categories || [], month);
  const total = groups.reduce((t, g) => t + g.amount, 0);
  const rest = groups.slice(named).reduce((t, g) => t + g.amount, 0);
  const hueOf = (name: string): Hue => categoryHue(name, v.categories) || 'muted';
  const slices = [...groups.slice(0, named).map((g) => ({ label: g.name, value: g.amount, color: hueOf(g.name) })), ...(rest > 0.005 ? [{ label: 'Everything else', value: rest, color: 'muted' as Hue }] : [])];
  return (
    <Widget title={days ? 'Where it went' : 'Spent this month'} kind="fx-spentmonth"
      open={open && (() => open(inMonth ? { month: month.from.slice(0, 7) } : {}))} openLabel={inMonth ? `Open ${monthName(month.from)}'s transactions` : 'Open Transactions'}>
      <Stat value={<Amount value={total} />} caption={days ? `From your transactions, ${dayShort(days.from)} – ${dayShort(days.to)}` : `From your transactions, to ${dayShort(v.today)}`} />
      {groups.length ? <div class="fx-donutrow">
        <Donut slices={slices} label={days ? 'Spending by category in these days' : "This month's spending by category"} center={<><strong>{whole(total)}</strong>{days ? 'spent' : 'so far'}</>} />
        <Rows kind="fx-rows fx-spentrows">
          {slices.map((s) => <Row key={s.label} lead={<Dot color={s.color} />} title={s.label} when={<Amount value={s.value} form="whole" />} whenPlain
            onOpen={open && s.label !== 'Everything else' && s.label !== 'No category' ? () => open(inMonth ? { category: s.label, month: month.from.slice(0, 7) } : { category: s.label }) : undefined} openLabel="see its transactions" />)}
        </Rows>
      </div> : <Empty>{days ? 'Nothing spent in these days.' : 'Nothing spent yet this month.'}</Empty>}
    </Widget>
  );
}
