// Finances › Reports: what the ledger says about a stretch of time (this
// month, last month, three months, this year, or all): money in and out,
// spending by category (each group, its own categories under it), money in
// against out month by month, where the money went by payee, and by tag;
// a tag picked narrows every one of them to what carries it. Each
// chart has a table beside it for a screen reader. Transfers between the
// household's own accounts are neither in nor out.
import { useState } from 'preact/hooks';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Amount, Stat } from './ui/Amount';
import { StackedBars } from './ui/charts';
import { Dot } from './ui/Legend';
import { Widget } from './ui/Widget';
import { brandOf, Mark } from './Mark';
import { iconOf } from './Transactions';
import { money, plural, tick } from './money';
import { byCategory, byMonth, byTag, ranges, tagsOf, topPayees, totals } from './reportData';

export function Reports({ v, ledger }: { v: finance.View; ledger: finance.Ledger | null }) {
  const [key, setKey] = useState('month');
  const [tag, setTag] = useState('');
  if (!ledger) return <div class="fin"><Empty>Reading…</Empty></div>;
  const tags = tagsOf(ledger.transactions);
  const picked = tags.includes(tag) ? tag : '';
  const txs = picked ? ledger.transactions.filter((t) => t.tags?.includes(picked)) : ledger.transactions;
  const all = ranges(v.today, txs[0]?.date || v.today);
  const r = all.find((x) => x.key === key) || all[0];
  const sum = totals(txs, r);
  const groups = byCategory(txs, v.categories || [], r);
  const months = byMonth(txs, r);
  const payees = topPayees(txs, r);
  const tagged = picked ? [] : byTag(txs, v.categories || [], r);
  const most = groups[0]?.amount || 1;
  const spent = groups.reduce((s, g) => s + g.amount, 0);
  return (
    <div class="fin">
      <div class="fx-board">
        <Widget title={picked ? `Reports, tagged ${picked}` : 'Reports'} span="all" kind="fx-reportsum" actions={<>
          {!!tags.length && <select class="fx-reporttag" aria-label="Tag" value={picked} onChange={(e) => setTag((e.target as HTMLSelectElement).value)}>
            <option value="">Every tag</option>
            {tags.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>}
          <Segmented label="Which stretch" value={r.key} pick={setKey} options={all.map((x) => [x.key, x.label])} />
        </>}>
          <div class="fx-stats">
            <Stat value={<Amount value={sum.in} form="whole" tone="in" />} caption="Money in" />
            <Stat value={<Amount value={sum.out} form="whole" tone="out" />} caption="Money out" />
            <Stat value={<Amount value={sum.in - sum.out} form="whole" sign tone="auto" />} caption={sum.in >= sum.out ? 'Kept' : 'More out than in'} />
          </div>
        </Widget>
        {!txs.length ? <Widget title="Nothing yet" span="all"><Empty>Reports read the transactions: add some on Transactions, and they show here.</Empty></Widget> : <>
          <Widget title="Spending by category" kind="fx-bycat">
            {groups.length ? <Rows kind="fx-rows">
              {groups.map((g) => {
                const icon = iconOf(v.categories, g.name);
                return <Row key={g.name} lead={<Mark kind={icon} type={icon} name={g.name} />} title={g.name}
                  sub={g.children.length ? g.children.map((c) => `${c.name} ${money(c.amount)}`).join(' · ') : `${Math.round((g.amount / (spent || 1)) * 100)}% of the spending`}
                  when={<Amount value={g.amount} form="full" />} whenPlain>
                  <span class="fx-budgetbar fx-catbar" aria-hidden="true"><span style={{ width: `${Math.max(1, (g.amount / most) * 100)}%` }} /></span>
                </Row>;
              })}
            </Rows> : <Empty>Nothing spent in this stretch.</Empty>}
          </Widget>
          <Widget title="Where it went" kind="fx-payees">
            {payees.length ? <Rows kind="fx-rows">
              {payees.map((p) => <Row key={p.payee} lead={<Mark brand={brandOf(undefined, p.payee)} name={p.payee} />} title={p.payee} sub={plural(p.count, 'time')}
                when={<Amount value={p.amount} form="full" />} whenPlain />)}
            </Rows> : <Empty>Nothing paid out in this stretch.</Empty>}
          </Widget>
          {!!tagged.length && <Widget title="By tag" kind="fx-bytag">
            <Rows kind="fx-rows">
              {tagged.map((x) => <Row key={x.tag} title={<span class="fx-tag">{x.tag}</span>} sub={plural(x.count, 'transaction')}
                when={<Amount value={x.amount} form="full" />} whenPlain onOpen={() => setTag(x.tag)} openLabel="see only these" />)}
            </Rows>
          </Widget>}
          {months.length > 1 && <Widget title="In and out, month by month" span="all" kind="fx-inout">
            <StackedBars format={tick} height={220}
              label={`Money in above the line and out below it, each month ${r.label.toLowerCase()}; the line is what was kept. The table under it has every number.`}
              columns={months.map((m) => ({ label: m.label, up: [{ value: m.in, color: 'in' }], down: [{ value: m.out, color: 'out' }], line: m.in - m.out }))}
              tip={(i) => <>
                <div class="fx-caption">{months[i].label} {months[i].month.slice(0, 4)}</div>
                <div class="fx-tiprow"><Dot color="in" /><span>Money in</span><Amount value={months[i].in} form="full" /></div>
                <div class="fx-tiprow"><Dot color="out" /><span>Money out</span><Amount value={-months[i].out} form="full" /></div>
                <div class="fx-tiptotal"><span>Kept</span><Amount value={months[i].in - months[i].out} form="full" /></div>
              </>} />
            <table class="sr"><caption>Money in and out by month</caption>
              <thead><tr><th scope="col">Month</th><th scope="col">In</th><th scope="col">Out</th></tr></thead>
              <tbody>{months.map((m) => <tr key={m.month}><th scope="row">{m.label} {m.month.slice(0, 4)}</th><td>{money(m.in)}</td><td>{money(m.out)}</td></tr>)}</tbody>
            </table>
          </Widget>}
        </>}
      </div>
    </div>
  );
}
