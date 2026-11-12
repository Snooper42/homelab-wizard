// An account's own page (the owner, Nov 12: clicking an account on Net worth
// opened the form to update its balance and logo): what it holds today, a
// chart of it over the last 30 or 90 days or a year, its latest
// transactions, and Update balance and Edit as buttons, not the page itself.
// A card or a loan says what it owes. A home, a car or a collectible, whose
// worth no transaction moves, charts what was typed in over time.
import { useState } from 'preact/hooks';
import { Empty } from '../parts/Empty';
import { Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Amount, Stat } from './ui/Amount';
import { AreaChart } from './ui/charts';
import { Widget } from './ui/Widget';
import { AcctMark } from './Mark';
import { ago } from './Worth';
import { TxRow } from './widgets/Latest';
import { balanceAfter, runsFrom, todayOf, worthOn } from './model';
import { compact, dayShort, type Lookup, money, owed } from './money';

const kindName: Record<string, string> = { checking: 'Checking', savings: 'Savings', card: 'Credit card', investment: 'Investments', retirement: 'Retirement', loan: 'Loan', home: 'Home', car: 'Car', collectible: 'Collectible' };
const spans: [string, string, number][] = [['30', '30 days', 30], ['90', '90 days', 90], ['365', 'A year', 365]];

/** The day `n` days before an ISO day. */
const back = (day: string, n: number): string => {
  const d = new Date(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface AccountProps {
  v: finance.View;
  L: Lookup;
  ledger: finance.Ledger | null;
  /** The account's id. */
  id: string;
  /** Back to Net worth. */
  done: () => void;
  /** Its form (Edit); none on a phone allowed only to look. */
  edit?: () => void;
  /** Update balances; none on a phone allowed only to look. */
  update?: () => void;
  /** Transactions, this account picked. */
  toTx: (f: { account: string }) => void;
  /** A transaction's form; none on a phone allowed only to look. */
  editTx?: (what: 'transaction', id: string) => void;
}

export function AccountPage({ v, L, ledger, id, done, edit, update, toTx, editTx }: AccountProps) {
  const [span, setSpan] = useState('90');
  const a = (v.plan.accounts || []).find((x) => x.id === id);
  if (!a) return <Empty>This account isn't in the plan any more. <button class="small" onClick={done}>Net worth</button></Empty>;
  const owes = owed(a.kind);
  const all = ledger?.transactions || [];
  const mine = all.filter((t) => t.account === a.id || t.to === a.id).sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  const runs = runsFrom(a) && !!mine.length;
  const days = spans.find(([k]) => k === span)![2];
  const steps = Array.from({ length: days + 1 }, (_, i) => back(v.today, days - i));
  // Each day's end: worked through its transactions, else what was typed in by then (a home, a car, no transactions).
  const values = steps.map((d) => (runs ? balanceAfter(a, all, d) : Math.abs(worthOn(v, a, d))));
  const low = values.reduce((m, x, i) => (x < values[m] ? i : m), 0);
  const thisMonth = mine.filter((t) => t.date.startsWith(v.today.slice(0, 7)));
  const into = (t: finance.Transaction) => (t.to === a.id ? -t.amount : t.amount);
  const cameIn = thisMonth.reduce((s, t) => s + Math.max(0, into(t)), 0), wentOut = thisMonth.reduce((s, t) => s + Math.min(0, into(t)), 0);
  const sub = [kindName[a.kind] || a.kind, ago(a.updated, v.today)].join(' · ');
  return (
    <div class="fin fx-account">
      <div class="fx-accthead">
        <button type="button" class="link" onClick={done}>‹ Net worth</button>
        <div class="fx-accttitle">
          <AcctMark a={a} size="lg" />
          <div class="grow"><h2>{a.name}</h2><p class="muted">{sub}</p></div>
          {(edit || update) && <span class="actions">{edit && <button class="btn" onClick={edit}>Edit</button>}{update && <button class="btn fx-primary" onClick={update}>Update balance</button>}</span>}
        </div>
      </div>
      <div class="fx-board">
        <Widget title={owes ? 'Owed today' : a.kind === 'home' || a.kind === 'car' || a.kind === 'collectible' ? 'Worth today' : 'Balance today'} span="all" kind="fx-acctbalance"
          actions={<Segmented label="How far back" value={span} pick={setSpan} options={spans.map(([k, t]) => [k, t] as [string, string])} />}>
          <Stat size="lg" value={<Amount value={Math.abs(todayOf(v, a))} />}
            aside={thisMonth.length ? <dl class="fx-acctmonth"><div><dt>Came in this month</dt><dd><Amount value={cameIn} sign tone="in" form="full" /></dd></div><div><dt>Went out</dt><dd><Amount value={wentOut} form="full" /></dd></div></dl> : undefined} />
          <AreaChart values={values} xLabels={[0, Math.round(days / 2), days].map((i) => ({ i, label: i === days ? 'Today' : dayShort(steps[i]) }))} zero={false} height={180} format={compact}
            label={`${a.name}, ${owes ? 'owed' : 'held'} at the end of each day over the last ${spans.find(([k]) => k === span)![1].toLowerCase()}: lowest ${money(values[low])} on ${dayShort(steps[low])}, ${money(values[values.length - 1])} today`}
            tip={(i) => <><strong>{dayShort(steps[i])}</strong><br />{money(values[i])}</>} />
          <p class="fx-sub">{runs ? `Lowest ${money(values[low])}, ${dayShort(steps[low])}. Worked from the balance typed in ${dayShort(a.updated!)} through its transactions.` : 'From the balances typed in over time.'}</p>
        </Widget>
        <Widget title="Latest transactions" span="all" kind="fx-acctlatest" actions={mine.length ? <button class="small" onClick={() => toTx({ account: a.id })}>All of them in Transactions</button> : undefined}>
          {mine.length ? <Rows kind="fx-rows">{mine.slice(0, 8).map((t) => <TxRow key={t.id} t={t} v={v} L={L} edit={editTx} />)}</Rows>
            : <Empty>No transactions in or out of it yet. An import or one typed in shows here.</Empty>}
        </Widget>
      </div>
    </div>
  );
}
