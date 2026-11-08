// A month of money: what is left of it (Cash flow), where the spending
// goes (Where it goes), and how it flows, pay to bills, saving, and what
// is left (Money flow). The pay period card picks a paycheck.
import { useState } from 'preact/hooks';
import { Empty } from '../../parts/Empty';
import { Row, Rows } from '../../parts/Row';
import { Amount, Stat, Tiles } from '../ui/Amount';
import { Donut } from '../ui/charts';
import { Sankey } from '../ui/sankey';
import { Dot, Legend, SplitBar } from '../ui/Legend';
import { IconButton, Widget } from '../ui/Widget';
import { inHome, kindName, month, surplus } from '../model';
import { byMonth } from '../reportData';
import type { showTransactions } from '../Transactions';
import { kindHueOf, ledgerMonths, monthFlow, savedHue, typicalFlow } from '../flowData';
import { dayShort, type Lookup, money, monthName, whole } from '../money';


/**
 * The last six months as the ledger has them, in against out a month,
 * each month a button opening its transactions. Only with two months or
 * more that have any: one alone says nothing a typical month does not.
 */
function LastMonths({ v, ledger, open }: { v: finance.View; ledger?: finance.Ledger | null; open?: (f: Parameters<typeof showTransactions>[0]) => void }) {
  if (!ledger?.transactions.length) return null;
  const t = new Date(+v.today.slice(0, 4), +v.today.slice(5, 7) - 1, 1);
  const from = new Date(t.getFullYear(), t.getMonth() - 5, 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const months = byMonth(inHome(v.plan, ledger.transactions), { key: 'six', label: '', from: iso(from), to: v.today.slice(0, 7) + '-31' });
  if (months.filter((x) => x.in > 0.005 || x.out > 0.005).length < 2) return null;
  const most = Math.max(...months.map((x) => Math.max(x.in, x.out)), 1);
  const bar = (n: number) => ({ height: `${Math.max(n > 0.005 ? 2 : 0, (n / most) * 100)}%` });
  return (
    <div class="fx-lastmonths" role="group" aria-label="The last six months, from your transactions">
      <div class="fx-caption">Your last six months</div>
      <div class="fx-monthbars">
        {months.map((x) => {
          // Its name starts with the month as shown (Sep), the figures after it unseen: a screen reader and a voice say the same.
          const said = `${monthName(x.month + '-01')}: ${money(x.in)} in, ${money(x.out)} out`;
          const body = <><span class="fx-barpair" aria-hidden="true"><i class="fx-h-in" style={bar(x.in)} /><i class="fx-h-out" style={bar(x.out)} /></span>
            <span class="fx-sub">{x.label}<span class="fx-hidden"> {x.month.slice(0, 4)}: {money(x.in)} in, {money(x.out)} out{open ? ', see its transactions' : ''}</span></span></>;
          return open ? <button key={x.month} type="button" class="fx-monthbar" title={said} onClick={() => open({ month: x.month })}>{body}</button>
            : <span key={x.month} class="fx-monthbar" title={said}>{body}</span>;
        })}
      </div>
    </div>
  );
}

export function CashFlowWidget({ v, L, open, ledger, showIn }: { v: finance.View; L: Lookup; open?: () => void; ledger?: finance.Ledger | null; showIn?: (f: Parameters<typeof showTransactions>[0]) => void }) {
  const m = month(v, L);
  return (
    <Widget title="Cash flow" kind="fx-flow" actions={open && <IconButton icon="open" label="Open Recurring: a typical month, payment by payment" onClick={open} />}>
      <Stat value={<Amount value={m.left} sign tone="auto" />} caption="Left in a typical month" />
      <SplitBar label="A typical month's pay" parts={[{ label: 'Spent', value: m.spent, color: 'out' }, { label: 'Saved', value: m.saved, color: 'save' }, { label: 'Left', value: Math.max(0, m.left), color: 'in' }]} />
      <Tiles items={[
        { label: 'Income', value: whole(m.in), tone: 'in' },
        { label: 'Spending', value: whole(m.spent), tone: 'out' },
        { label: 'Saved', value: m.in ? `${Math.round(((m.saved + m.viaPay) / (m.in + m.viaPay)) * 100)}%` : whole(m.saved), tone: 'save' },
      ]} />
      <LastMonths v={v} ledger={ledger} open={showIn} />
    </Widget>
  );
}


export function SpendingWidget({ v, L, open }: { v: finance.View; L: Lookup; open?: () => void }) {
  const m = month(v, L);
  if (!m.byKind.length) return null;
  const slices = m.byKind.map((k) => ({ label: kindName(k.kind), value: k.amount, color: kindHueOf(k.kind, v.categories) }));
  return (
    <Widget title="Where it goes" kind="fx-spend" actions={open && <IconButton icon="open" label="Open Recurring: a typical month, payment by payment" onClick={open} />}>
      <Stat value={<Amount value={-m.spent} />} caption="Spent in a typical month" />
      <div class="fx-donutrow">
        <Donut slices={slices} label="A typical month's spending" center={<><strong>{whole(m.spent)}</strong>a month</>} />
        <Legend items={slices.slice(0, 6).map((s) => ({ label: s.label, color: s.color, value: whole(s.value) }))} />
      </div>
    </Widget>
  );
}

/** How many of each column a month's flow shows before the rest are one Other. */
const tops: [string, string][] = [['5', 'Top 5'], ['8', 'Top 8'], ['0', 'All']];

/** A month as people say it: "Oct 2026", or "A typical month". */
const periodName = (p: string) => (p === typical ? 'A typical month' : `${monthName(p + '-01').slice(0, 3)} ${p.slice(0, 4)}`);
const typical = 'typical';

/**
 * Money flow: where a month's money came from, through all of it, to
 * taxes, spending, and saving, and on to each kind of spending and each
 * account it was saved in (or kept as cash). ‹ › step through the months
 * the ledger has, and a typical month from the plan; Top 8 keeps the
 * largest of each column, the rest as Other. Above it, income, taxes,
 * expenses, and saved, each as a share of income. Picking a box shows
 * what is behind it under the chart: its transactions, or the planned
 * payments and pay, each opening its form. A table says it all to a
 * screen reader.
 */
export function MoneyFlowWidget({ v, L, ledger, edit, title = 'Money flow' }: { v: finance.View; L: Lookup; ledger?: finance.Ledger | null; edit?: (what: 'transaction' | 'payment', id: string) => void; title?: string }) {
  const months = ledgerMonths(ledger || null);
  const periods = [typical, ...[...months].reverse()];
  // This month once the ledger has it (it is read after the plan), until one is picked.
  const [period, setPeriod] = useState('');
  const [top, setTop] = useState('8');
  const [picked, setPicked] = useState('');
  const p = periods.includes(period) ? period : months.includes(v.today.slice(0, 7)) ? v.today.slice(0, 7) : typical;
  const at = periods.indexOf(p);
  const f = p === typical || !ledger ? typicalFlow(v, L, Number(top)) : monthFlow(v, L, ledger, p, Number(top));
  if (f.income <= 0.005 && f.expenses <= 0.005) {
    if (p === typical && !months.length) return null;
  }
  const node = f.nodes.find((n) => n.id === picked);
  const share = (n: number) => (f.income > 0.005 ? `${Math.round((n / f.income) * 100)}%` : '');
  const go = (i: number) => { setPeriod(periods[i]); setPicked(''); };
  const items = node ? [...node.items].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)) : [];
  const many = 40;
  return (
    <Widget title={title} span="all" kind="fx-moneyflow"
      actions={<>
        <span class="fx-period">
          <IconButton icon="prev" label="The month before" disabled={at <= 0} onClick={() => go(at - 1)} />
          <span class="fx-periodname" aria-live="polite">{periodName(p)}</span>
          <IconButton icon="next" label="The month after" disabled={at >= periods.length - 1} onClick={() => go(at + 1)} />
        </span>
        <select class="fx-top" aria-label="How many of each to show" value={top} onChange={(e) => { setTop((e.target as HTMLSelectElement).value); setPicked(''); }}>
          {tops.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </>}>
      <div class="fx-flowstrip">
        {[
          { label: 'Income', hue: 'in' as const, value: f.income, sub: p === typical ? 'a month, before taxes' : 'this month' },
          { label: 'Taxes', hue: 7, value: f.taxes, sub: `${share(f.taxes)} of income` },
          { label: 'Expenses', hue: 'out' as const, value: f.expenses, sub: `${share(f.expenses)} of income` },
          { label: f.saved < 0 ? 'Short' : 'Saved', hue: savedHue, value: Math.abs(f.saved), sub: f.saved < 0 ? 'more out than in' : `${share(f.saved)} savings rate` },
        ].map((t) => (
          <div key={t.label} class="fx-flowtile">
            <span class="fx-caption"><Dot color={t.hue} shape="square" /> {t.label}</span>
            <span class="fx-flowfig"><Amount value={t.value} form="full" /></span>
            <span class="fx-sub">{t.sub}</span>
          </div>
        ))}
      </div>
      {f.nodes.length > 1
        ? <Sankey nodes={f.nodes} links={f.links} money={money} picked={picked} pick={(id) => setPicked(id === picked ? '' : id)}
          label={`${periodName(p)}: ${money(f.income)} in, ${money(f.taxes)} in taxes, ${money(f.expenses)} spent, ${money(f.saved)} saved. Each box is a button that shows what is behind it; the table under it has every amount.`} />
        : <Empty>Nothing came in or went out {p === typical ? 'in the plan' : `in ${periodName(p)}`} yet.</Empty>}
      {node && <section class="fx-flowpick" aria-label={`What makes up ${node.label}`}>
        <div class="fx-flowpickhead">
          <h3>{node.label} <span class="fx-sub">{periodName(p)} · {money(node.value)}</span></h3>
          <button type="button" class="small" onClick={() => setPicked('')}>Close</button>
        </div>
        {node.id === 'kept:cash'
          ? <p class="fx-sub">What was left after taxes, spending, and what went into savings accounts: it stayed where it came in.</p>
          : node.id === 'src:accounts'
            ? <p class="fx-sub">More went out than came in: the rest came out of what the accounts held.</p>
            : <Rows kind="fx-rows">
              {items.slice(0, many).map((it, i) => <Row key={i} title={it.label} sub={[it.date && dayShort(it.date), it.note].filter(Boolean).join(' · ') || (it.payment ? 'Planned, a month' : it.person ? 'Pay, a month' : '')}
                when={<Amount value={it.amount} sign={it.amount > 0} tone={it.amount > 0 ? 'in' : ''} form="full" />} whenPlain
                onOpen={edit && (it.tx || it.payment) ? () => edit(it.tx ? 'transaction' : 'payment', (it.tx || it.payment)!) : undefined} openLabel={edit ? 'edit' : undefined} />)}
              {!items.length && <li><Empty>Nothing behind it.</Empty></li>}
            </Rows>}
        {items.length > many && <p class="fx-sub">And {items.length - many} more.</p>}
      </section>}
      {/* In a box of its own: a table is as wide as its words, and would stick out of the card in a small window. */}
      <div class="sr"><table><caption>{periodName(p)}: money in and out</caption>
        <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Amount</th></tr></thead>
        <tbody>{f.links.map((l) => <tr key={l.from + l.to}><td>{f.nodes.find((n) => n.id === l.from)?.label}</td><td>{f.nodes.find((n) => n.id === l.to)?.label}</td><td>{money(l.value)}</td></tr>)}</tbody>
      </table></div>
    </Widget>
  );
}
