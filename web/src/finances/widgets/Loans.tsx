// Loans, read to zero: each with what it owes, what goes to it a month,
// and at its rate the month it is paid off and the interest still to pay;
// in amber when the payment does not keep up with the interest, or none
// goes to it. Under them, the loan picked, its balance month by month to
// zero, with a table for a screen reader. Loans owing nothing are listed
// apart, as paid off. A card carrying a balance (a rate, paid down by a
// payment into it) is read with them. Where Finances may be changed, Pay
// more: what an extra amount a paycheck does to the loan picked, and with
// two or more, the highest rate first against the smallest balance first.
import { useState } from 'preact/hooks';
import { Row, Rows } from '../../parts/Row';
import { Segmented } from '../../parts/Segmented';
import { Amount } from '../ui/Amount';
import { AreaChart } from '../ui/charts';
import { Widget } from '../ui/Widget';
import { AcctMark } from '../Mark';
import { amortize, type Debt, payDown } from '../payoffPlan';
import { currencySign, dayShort, type Lookup, money, monthName, parseAmount, perMonth, plural, tick } from '../money';
import { paydaysAMonth } from './Goals';

/** "Mar 2029" from "2029-03". */
const monthOf = (ym: string) => `${monthName(ym + '-01').slice(0, 3)} ${ym.slice(0, 4)}`;

/** The month (YYYY-MM) n months on from a day. */
const monthsOn = (day: string, n: number) => { const d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** A loan's payoff in words. */
export function payoffWords(p: finance.Payoff): string {
  if (p.balance <= 0.005) return 'Paid off';
  if (!p.monthly) return 'Nothing is paid to it: add a payment that goes to it';
  if (p.never) return `${money(p.monthly)} a month does not keep up with its interest`;
  return `${money(p.monthly)} a month: paid off ${monthOf(p.date!)}${p.interest ? `, ${money(p.interest)} interest still to pay` : ''}`;
}

/** "Dec 9, 2026". */
const dayYear = (d: string) => `${dayShort(d)}, ${d.slice(0, 4)}`;

/** The payments ring: how many of a loan's payments are made, as a circle filling. */
function Ring({ made, of }: { made: number; of: number }) {
  const r = 52, round = 2 * Math.PI * r, part = of ? Math.min(1, made / of) : 0;
  return (
    <div class="fx-ring" role="img" aria-label={`${made} of ${of} payments made`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="fx-ringtrack" cx="60" cy="60" r={r} />
        <circle class="fx-ringfill" cx="60" cy="60" r={r} stroke-dasharray={`${(part * round).toFixed(2)} ${round.toFixed(2)}`} transform="rotate(-90 60 60)" />
      </svg>
      <div class="fx-ringtext" aria-hidden="true"><strong>{made}</strong><span>of {of}</span><small>payments</small></div>
    </div>
  );
}

/**
 * A loan read from its papers: the ring of payments made, what is paid
 * down of what was borrowed, the next payment split into what pays the
 * loan down and what is interest, who pays it each month when more than
 * one payment goes into it, when it is half paid and paid off, and every
 * payment in a table to open.
 */
function Papers({ v, L, p }: { v: finance.View; L: Lookup; p: finance.Payoff }) {
  const a = L.account[p.account], rows = p.rows!, made = p.made || 0;
  const original = rows.reduce((t, x) => t + x.principal, 0);
  const down = Math.max(0, original - p.balance), share = original ? down / original : 0;
  const next = rows[made];
  const half = rows.findIndex((x) => x.after <= original / 2 + 0.005);
  const last = rows[rows.length - 1];
  const paidIn = rows.slice(0, made).reduce((t, x) => t + x.interest, 0);
  // Who pays it: each payment into it a month, and what the papers' payment leaves for someone else.
  const into = (v.plan.payments || []).filter((x) => x.to === p.account).map((x) => ({ name: x.name, amount: x.amount * perMonth(x.schedule, v.plan.people, v.checking) }));
  const planned = into.reduce((t, x) => t + x.amount, 0), rest = p.monthly - planned;
  return (
    <div class="fx-papers">
      <Ring made={made} of={rows.length} />
      <div class="fx-papersfacts">
        <p class="fx-papersdown"><strong>{money(down)}</strong> of {money(original)} paid down, {Math.round(share * 100)}%</p>
        <div class="fx-papersbar" aria-hidden="true"><span style={{ width: `${(share * 100).toFixed(1)}%` }} /></div>
        {next && <p><strong>Next, {dayYear(next.date)}:</strong> {money(next.payment)}{next.interest > 0.005 ? <> ({money(next.principal)} pays it down, {money(next.interest)} is interest)</> : ', all of it paying it down'}.</p>}
        {(into.length > 1 || (into.length && rest > 0.005)) && <p><strong>Each month:</strong> {into.map((x) => `${x.name} ${money(x.amount)}`).join(', ')}{rest > 0.005 ? `, and ${money(rest)} paid another way` : ''}.</p>}
        <p>{half > 0 && <>{half < made ? 'Half paid off' : 'Half paid off on'} {dayYear(rows[half].date)}. </>}Paid off {dayYear(last.date)}, after {plural(rows.length - made, 'more payment')}{p.interest ? `, ${money(p.interest)} of interest still to pay` : ''}{paidIn > 0.005 ? ` (${money(paidIn)} paid so far)` : ''}.</p>
        <details class="fx-papersrows">
          <summary>Every payment</summary>
          <div class="fx-paperstable"><table>
            <caption class="sr">{a.name}: each payment, what pays it down, its interest, and what is owed after</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Due</th><th scope="col">Payment</th><th scope="col">Paid down</th><th scope="col">Interest</th><th scope="col">Owed after</th></tr></thead>
            <tbody>{rows.map((x, i) => <tr key={x.date} class={i < made ? 'fx-made' : i === made ? 'fx-nextrow' : undefined}><td>{i + 1}</td><th scope="row">{dayYear(x.date)}</th><td>{money(x.payment)}</td><td>{money(x.principal)}</td><td>{money(x.interest)}</td><td>{money(x.after)}</td></tr>)}</tbody>
          </table></div>
        </details>
      </div>
    </div>
  );
}

/** Pay more: an extra amount a paycheck on the loan picked, and every debt paid down the two ways. Changes nothing. */
function PayMore({ v, L, shown, owing }: { v: finance.View; L: Lookup; shown?: finance.Payoff; owing: finance.Payoff[] }) {
  const [text, setText] = useState('');
  const extra = Math.max(0, parseAmount(text) || 0) * paydaysAMonth(v);
  const debts: Debt[] = owing.filter((p) => p.monthly > 0).map((p) => ({ id: p.account, balance: p.balance, rate: p.rate || 0, monthly: p.monthly }));
  const one = shown && extra > 0 ? amortize(shown.balance, shown.rate || 0, shown.monthly + extra) : null;
  const ways = debts.length > 1 && extra > 0 ? (['avalanche', 'snowball'] as const).map((w) => ({ w, s: payDown(debts, extra, w) })) : [];
  const when = (n: number) => { const d = new Date(+v.today.slice(0, 4), +v.today.slice(5, 7) - 1 + n, 1); return `${monthName(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`).slice(0, 3)} ${d.getFullYear()}`; };
  const name = (id: string) => L.account[id]?.name || id;
  return (
    <section class="fx-paymore" aria-label="Pay more">
      <h3>Pay more</h3>
      <label class="fx-paymorefield"><span class="moneyfield"><span aria-hidden="true">{currencySign()}</span><input inputmode="decimal" aria-label="More a paycheck" value={text} placeholder="100" onInput={(e) => setText((e.target as HTMLInputElement).value)} /></span> more a paycheck{extra > 0 && ` (about ${money(extra)} a month)`}</label>
      <p class="fx-sub" role="status">
        {!one && 'Type an amount to see what it saves. Nothing is saved.'}
        {one && shown && (one.ok ? <>{name(shown.account)} paid off {when(one.months)}{shown.months ? `, ${plural(shown.months - one.months, 'month')} sooner` : ''}{shown.interest ? `, ${money(Math.max(0, shown.interest - one.interest))} less interest` : ''}.</> : <>{name(shown.account)} is still never paid off at that.</>)}
      </p>
      {!!ways.length && <ul class="fx-ways">
        {ways.map(({ w, s }) => <li key={w}><strong>{w === 'avalanche' ? 'Highest rate first' : 'Smallest balance first'}:</strong> {s.ok ? <>all paid off {when(s.months)}, {money(s.interest)} interest. In turn: {s.order.map((o) => `${name(o.id)} ${when(o.month)}`).join(', ')}.</> : 'never all paid off at that.'}</li>)}
      </ul>}
    </section>
  );
}

export function LoansWidget({ v, L, edit }: { v: finance.View; L: Lookup; edit?: (what: 'account', id?: string) => void }) {
  const loans = (v.loans || []).filter((p) => L.account[p.account]);
  const owing = loans.filter((p) => p.balance > 0.005), done = loans.filter((p) => p.balance <= 0.005);
  const charted = owing.filter((p) => p.path?.length);
  const [pick, setPick] = useState('');
  if (!loans.length) return null;
  const shown = charted.find((p) => p.account === pick) || charted[0];
  const row = (p: finance.Payoff) => {
    const a = L.account[p.account];
    const bad = p.balance > 0.005 && (p.never || !p.monthly);
    return <Row key={p.account} lead={<AcctMark a={a} />} title={a.name}
      sub={<span class={bad ? 'fx-warn' : ''}>{p.rows?.length ? `${p.made || 0} of ${p.rows.length} payments made · ` : ''}{payoffWords(p)}{p.rate ? ` · ${p.rate}% a year` : ''}</span>}
      when={<Amount value={p.balance} form="full" />} whenPlain
      onOpen={edit ? () => edit('account', p.account) : undefined} openLabel={edit ? 'edit' : undefined} />;
  };
  // A year's mark under the chart: each January, or each fifth one for a long loan.
  const path = shown?.path || [];
  const every = path.length > 120 ? 60 : 12;
  const xLabels = path.map((_, i) => ({ i, label: monthsOn(v.today, i + 1) })).filter((x) => x.label.endsWith('-01') && (+x.label.slice(0, 4)) % (every / 12) === 0).map((x) => ({ i: x.i, label: x.label.slice(0, 4) }));
  return (
    <Widget title={loans.some((p) => L.account[p.account]?.kind === 'card') ? 'Loans and cards carrying a balance' : 'Loans'} span="all" kind="fx-loans">
      {!!owing.length && <Rows kind="fx-rows">{owing.map(row)}</Rows>}
      {shown && <div class="fx-loanchart">
        <div class="fx-loanhead">
          <h3>{L.account[shown.account].name}, to zero</h3>
          {charted.length > 1 && <Segmented label="Which loan" value={shown.account} pick={setPick} options={charted.map((p) => [p.account, L.account[p.account].name])} />}
        </div>
        {!!shown.rows?.length && <Papers v={v} L={L} p={shown} />}
        <AreaChart values={[shown.balance, ...path]} xLabels={xLabels.map((x) => ({ i: x.i + 1, label: x.label }))} height={160} format={tick}
          label={`${L.account[shown.account].name}: what it owes each month until it is paid off in ${monthOf(shown.date!)}. The table under it has the balance each year.`}
          tip={(i) => <><div class="fx-caption">{i === 0 ? 'Today' : monthOf(monthsOn(v.today, i))}</div><div class="fx-tiptotal"><span>Owed</span><Amount value={i === 0 ? shown.balance : path[i - 1]} form="full" /></div></>} />
        <table class="sr"><caption>{L.account[shown.account].name} owed, each year</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">Owed</th></tr></thead>
          <tbody>{path.map((b, i) => ({ b, m: monthsOn(v.today, i + 1) })).filter((x, i) => x.m.endsWith('-12') || i === path.length - 1).map((x) => <tr key={x.m}><th scope="row">{monthOf(x.m)}</th><td>{money(x.b)}</td></tr>)}</tbody>
        </table>
      </div>}
      {edit && !!owing.length && <PayMore v={v} L={L} shown={shown} owing={owing} />}
      {!!done.length && <>
        <h3 class="fx-loansdone">Paid off</h3>
        <Rows kind="fx-rows">{done.map(row)}</Rows>
      </>}
    </Widget>
  );
}
