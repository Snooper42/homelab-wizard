// Net worth, small: today's, its change over the month, and month by
// month (the months ahead hatched), opening the Net worth view. And the
// sidebar's balances: each group of accounts with its total, the way a
// glance at the side of the screen answers "how are we doing".
import { render } from 'preact';
import { Amount, Delta, Stat } from '../ui/Amount';
import { AreaChart } from '../ui/charts';
import { Dot } from '../ui/Legend';
import { IconButton, Widget } from '../ui/Widget';
import { grouped, netWorth, worthOf, worthByMonth } from '../model';
import { compact, dayShort, money, tick } from '../money';

export function NetWorthWidget({ v, open }: { v: finance.View; open: () => void }) {
  if (!(v.plan.accounts || []).length) return null;
  const now = netWorth(v);
  // Each day kept, ending on today's estimate; and its change over the last month.
  const kept = (v.worth || []).filter((p) => p.date < v.today);
  const values = [...kept.map((p) => p.amount), now];
  const month = worthByMonth(v, 1, 0)[0];
  const each = (v.plan.accounts || []).map((a) => worthOf(v, a));
  const owned = each.filter((n) => n > 0).reduce((t, n) => t + n, 0), owes = -each.filter((n) => n < 0).reduce((t, n) => t + n, 0);
  return (
    <Widget title="Net worth" kind="fx-worthmini" actions={<IconButton icon="open" label="Open Net worth" onClick={open} />}>
      <Stat value={<Amount value={now} />} caption="Today" aside={month && <Delta value={now - month.net} base={month.net} shareOnly />} />
      {values.length > 2 && <AreaChart values={values} zero={false} axis={false} height={92} format={tick}
        xLabels={[{ i: 0, label: dayShort(kept[0]?.date || v.today) }, { i: values.length - 1, label: 'Today' }]}
        label={`Net worth from ${money(values[0])} on ${dayShort(kept[0]?.date || v.today)} to ${money(now)} today.`}
        tip={(i) => <div class="fx-tiphead"><span>{i === values.length - 1 ? 'Today' : dayShort(kept[i].date)}</span><Amount value={values[i]} form="whole" /></div>} />}
      <div class="fx-pair">
        <Stat size="sm" value={<Amount value={owned} form="whole" />} caption="Owned" />
        <Stat size="sm" value={<Amount value={owes} form="whole" />} caption="Owed" />
      </div>
    </Widget>
  );
}

/** The sidebar's balances under Finances: each group and its total; picking one opens Net worth. */
function Balances({ v, open }: { v: finance.View; open: (group: string) => void }) {
  const list = grouped(v);
  if (!list.length) return null;
  return (
    <div class="fx-balances" role="group" aria-label="Balances">
      <div class="fx-caption">Accounts</div>
      {list.map((g) => (
        <button key={g.key} type="button" class="fx-balance" onClick={() => open(g.key)}>
          <Dot color={g.color} />
          <span class="fx-legendlabel">{g.name}</span>
          <Amount value={g.total} form="compact" tone={g.total < 0 ? 'out' : ''} />
        </button>
      ))}
      <div class="fx-balance total"><span class="fx-legendlabel">Net worth</span><span class="fx-amount">{compact(netWorth(v))}</span></div>
    </div>
  );
}

export function mountBalances(el: Element, v: finance.View | null, open: (group: string) => void) {
  render(v ? <Balances v={v} open={open} /> : null, el);
}
