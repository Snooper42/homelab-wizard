// Loans, read to zero: each with what it owes, what goes to it a month,
// and at its rate the month it is paid off and the interest still to pay;
// in amber when the payment does not keep up with the interest, or none
// goes to it. Under them, the loan picked, its balance month by month to
// zero, with a table for a screen reader. Loans owing nothing are listed
// apart, as paid off.
import { useState } from 'preact/hooks';
import { Row, Rows } from '../../parts/Row';
import { Segmented } from '../../parts/Segmented';
import { Amount } from '../ui/Amount';
import { AreaChart } from '../ui/charts';
import { Widget } from '../ui/Widget';
import { AcctMark } from '../Mark';
import { type Lookup, money, monthName, tick } from '../money';

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
      sub={<span class={bad ? 'fx-warn' : ''}>{payoffWords(p)}{p.rate ? ` · ${p.rate}% a year` : ''}</span>}
      when={<Amount value={p.balance} form="full" />} whenPlain
      onOpen={edit ? () => edit('account', p.account) : undefined} openLabel={edit ? 'edit' : undefined} />;
  };
  // A year's mark under the chart: each January, or each fifth one for a long loan.
  const path = shown?.path || [];
  const every = path.length > 120 ? 60 : 12;
  const xLabels = path.map((_, i) => ({ i, label: monthsOn(v.today, i + 1) })).filter((x) => x.label.endsWith('-01') && (+x.label.slice(0, 4)) % (every / 12) === 0).map((x) => ({ i: x.i, label: x.label.slice(0, 4) }));
  return (
    <Widget title="Loans" span="all" kind="fx-loans">
      {!!owing.length && <Rows kind="fx-rows">{owing.map(row)}</Rows>}
      {shown && <div class="fx-loanchart">
        <div class="fx-loanhead">
          <h3>{L.account[shown.account].name}, to zero</h3>
          {charted.length > 1 && <Segmented label="Which loan" value={shown.account} pick={setPick} options={charted.map((p) => [p.account, L.account[p.account].name])} />}
        </div>
        <AreaChart values={[shown.balance, ...path]} xLabels={xLabels.map((x) => ({ i: x.i + 1, label: x.label }))} height={160} format={tick}
          label={`${L.account[shown.account].name}: what it owes each month until it is paid off in ${monthOf(shown.date!)}. The table under it has the balance each year.`}
          tip={(i) => <><div class="fx-caption">{i === 0 ? 'Today' : monthOf(monthsOn(v.today, i))}</div><div class="fx-tiptotal"><span>Owed</span><Amount value={i === 0 ? shown.balance : path[i - 1]} form="full" /></div></>} />
        <table class="sr"><caption>{L.account[shown.account].name} owed, each year</caption>
          <thead><tr><th scope="col">Month</th><th scope="col">Owed</th></tr></thead>
          <tbody>{path.map((b, i) => ({ b, m: monthsOn(v.today, i + 1) })).filter((x, i) => x.m.endsWith('-12') || i === path.length - 1).map((x) => <tr key={x.m}><th scope="row">{monthOf(x.m)}</th><td>{money(x.b)}</td></tr>)}</tbody>
        </table>
      </div>}
      {!!done.length && <>
        <h3 class="fx-loansdone">Paid off</h3>
        <Rows kind="fx-rows">{done.map(row)}</Rows>
      </>}
    </Widget>
  );
}
