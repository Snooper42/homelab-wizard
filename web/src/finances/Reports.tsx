// Finances › Reports: what the ledger says about a stretch of time (this
// month, last month, three months, this year, or all): money in and out,
// spending by category (each group, its own categories under it), money in
// against out month by month, where the money went by payee, and by tag;
// a category's last twelve months, and this month so far against the same
// days a year before;
// a tag picked narrows every one of them to what carries it. Export CSV
// saves the stretch's transactions (the tag's, when one is picked) for a
// spreadsheet: on the computer where you choose, on a phone shared. Each
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
import { inHome } from './model';
import { currencyCode, dayShort, money, monthName, parseDay, plural, tick } from './money';
import { byCategory, byMonth, byTag, categoryTrend, csvName, ranges, tagsOf, toCsv, topPayees, totals, twelveMonths, yearOnYear } from './reportData';

export function Reports({ v, ledger, exportFile }: { v: finance.View; ledger: finance.Ledger | null; exportFile?: (name: string, text: string) => Promise<string> }) {
  const [key, setKey] = useState('month');
  const [saved, setSaved] = useState('');
  const [tag, setTag] = useState('');
  const [trendOf, setTrendOf] = useState('');
  if (!ledger) return <div class="fin"><Empty>Reading…</Empty></div>;
  const tags = tagsOf(ledger.transactions);
  const picked = tags.includes(tag) ? tag : '';
  const typed = picked ? ledger.transactions.filter((t) => t.tags?.includes(picked)) : ledger.transactions;
  // Read in the plan's currency, so an account kept in another adds up; the export keeps each as typed.
  const txs = inHome(v.plan, typed);
  const all = ranges(v.today, txs[0]?.date || v.today);
  const r = all.find((x) => x.key === key) || all[0];
  const sum = totals(txs, r);
  const groups = byCategory(txs, v.categories || [], r);
  const months = byMonth(txs, r);
  const payees = topPayees(txs, r);
  const tagged = picked ? [] : byTag(txs, v.categories || [], r);
  const account = (id: string) => v.plan.accounts?.find((a) => a.id === id)?.name || id;
  const save = async () => {
    setSaved('Saving…');
    try {
      const currency = v.plan.rates && Object.keys(v.plan.rates).length ? (id: string) => v.plan.accounts?.find((a) => a.id === id)?.currency || currencyCode() : undefined;
      setSaved(await exportFile!(csvName(r, picked), toCsv(typed, r, account, currency)));
    } catch (e) { setSaved(`Not saved: ${(e as Error)?.message || e}`); }
  };
  const yearGroups = byCategory(txs, v.categories || [], twelveMonths(v.today));
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
          {exportFile && !!txs.length && <button type="button" class="small" onClick={save}>Export CSV</button>}
        </>}>
          <div class="fx-stats">
            <Stat value={<Amount value={sum.in} form="whole" tone="in" />} caption="Money in" />
            <Stat value={<Amount value={sum.out} form="whole" tone="out" />} caption="Money out" />
            <Stat value={<Amount value={sum.in - sum.out} form="whole" sign tone="auto" />} caption={sum.in >= sum.out ? 'Kept' : 'More out than in'} />
          </div>
          <p class="fx-sub fx-exported" role="status">{saved}</p>
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
          {!!yearGroups.length && <Trend v={v} txs={txs} groups={yearGroups} group={trendOf} pick={setTrendOf} />}
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

/** A category's last twelve months, bar by bar, with a table for a screen reader; over them, this month so far against the same days a year before. */
function Trend({ v, txs, groups, group, pick }: { v: finance.View; txs: finance.Transaction[]; groups: { name: string }[]; group: string; pick: (name: string) => void }) {
  const cats = v.categories || [];
  const g = groups.find((x) => x.name === group) || groups[0];
  const trend = categoryTrend(txs, cats, g.name, v.today);
  const yoy = yearOnYear(txs, cats, g.name, v.today);
  const d = parseDay(v.today);
  const lastYear = `${monthName(v.today)} ${d.getFullYear() - 1}`;
  const diff = yoy.then === null ? 0 : yoy.now - yoy.then;
  return (
    <Widget title={`${g.name}, month by month`} span="all" kind="fx-trend"
      actions={groups.length > 1 && <select class="fx-reporttag" aria-label="Which category" value={g.name} onChange={(e) => pick((e.target as HTMLSelectElement).value)}>
        {groups.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
      </select>}>
      <p class="fx-sub fx-yoy">
        This month to {dayShort(v.today)}: <Amount value={yoy.now} form="full" />
        {yoy.then === null ? '. A year before is not in the transactions yet.'
          : <>; the same days of {lastYear}: <Amount value={yoy.then} form="full" />{Math.abs(diff) < 0.005 ? ', the same.' : yoy.then > 0
            ? `, ${money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} (${Math.round((Math.abs(diff) / yoy.then) * 100)}%).` : '.'}</>}
      </p>
      <StackedBars lineless format={tick} height={180}
        label={`${g.name}: what was spent each of the last 12 months. The table under it has every number.`}
        columns={trend.map((t) => ({ label: t.label, up: [{ value: Math.max(0, t.amount), color: 'out' }], down: [], line: 0 }))}
        tip={(i) => <>
          <div class="fx-caption">{monthName(trend[i].month + '-01')} {trend[i].month.slice(0, 4)}</div>
          <div class="fx-tiptotal"><span>{g.name}</span><Amount value={trend[i].amount} form="full" /></div>
        </>} />
      <table class="sr"><caption>{g.name} by month</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Spent</th></tr></thead>
        <tbody>{trend.map((t) => <tr key={t.month}><th scope="row">{monthName(t.month + '-01')} {t.month.slice(0, 4)}</th><td>{money(t.amount)}</td></tr>)}</tbody>
      </table>
    </Widget>
  );
}
