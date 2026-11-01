// Finances › Net worth, laid from the kit: today's figure, its change over
// the range picked, and what is owed; month by month, what is owned
// stacked above zero (a home or car as its equity) and what else is owed
// below it, net worth the line through them and the months ahead (read
// forward from the paychecks) faded, with or without the home and car; and
// what the household owns and owes, account by account, each opening its
// form; then the goals, each counting shares of the accounts.
import { useState } from 'preact/hooks';
import { Card } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Amount, Delta, Stat } from './ui/Amount';
import { StackedBars } from './ui/charts';
import { Dot, Legend } from './ui/Legend';
import { Widget } from './ui/Widget';
import { AcctMark, Mark } from './Mark';
import { PostPayWidget } from './widgets/Ledger';
import { GoalsWidget } from './widgets/Goals';
import { firstKept, groups, netWorth, rateOf, todayOf, type WorthMonth, worthByMonth, worthOf, worthOn } from './model';
import { compact, daysBetween, dayShort, type Lookup, money, moneyIn, monthName, owed, parseDay, tick, whole } from './money';

interface WorthProps {
  v: finance.View;
  L: Lookup;
  /** Opens the form for one, or a new one; none on a phone allowed only to look. */
  edit?: (what: 'account' | 'person' | 'payment' | 'goal', id?: string) => void;
  /** The pay period picked, for every account paycheck by paycheck; its columns pick one. */
  sel: number;
  pick: (i: number) => void;
  /** Opens Update balances; none on a phone allowed only to look. */
  update?: () => void;
}

/** How far back the chart goes: months. */
const ranges: [string, string, number][] = [['3', '3 months', 3], ['6', '6 months', 6], ['12', '1 year', 12], ['all', 'All', 600]];

/** "updated today", "updated 3 days ago", "updated Oct 2". */
function ago(day: string | undefined, today: string): string {
  if (!day) return 'not typed in yet';
  const n = daysBetween(day, today);
  return n <= 0 ? 'updated today' : n === 1 ? 'updated yesterday' : n < 14 ? `updated ${n} days ago` : `updated ${dayShort(day)}`;
}

const month = (day: string) => monthName(day).slice(0, 3);

export function NetWorth({ v, L, edit, sel, pick, update }: WorthProps) {
  const [range, setRange] = useState('3');
  const [counted, setCounted] = useState('all');
  const accounts = v.plan.accounts || [];
  if (!accounts.length && !edit) return <div class="fin"><Card kind="finstart"><Empty>No accounts typed in yet.</Empty></Card></div>;
  if (!accounts.length) {
    return (
      <div class="fin"><div class="fx-board"><Widget title="Nothing here yet" span="all" kind="finstart">
        <Rows kind="fx-rows">
          <Row lead={<Mark kind="checking" name="Accounts" />} title="Bank accounts, cards, and investments" sub="What each holds, typed in" end={<button class="small" onClick={() => edit('account')}>Add an account</button>} />
          <Row lead={<Mark kind="home" name="Home" />} title="A home or a car" sub="What it is worth, and the loan against it: its equity" end={<button class="small" onClick={() => edit('account')}>Add property</button>} />
        </Rows>
      </Widget></div></div>
    );
  }
  // As far back as balances were kept, at most the range picked.
  const kept = parseDay(firstKept(v)), today = parseDay(v.today);
  const back = Math.max(1, Math.min(ranges.find(([k]) => k === range)?.[2] ?? 3, (today.getFullYear() - kept.getFullYear()) * 12 + today.getMonth() - kept.getMonth()));
  const months = worthByMonth(v, back, 3);
  const start = months[0];
  const now = netWorth(v);
  // A card or loan paid off is still owed, at $0, as the chart counts it.
  const owned = accounts.filter((a) => !owed(a.kind));
  const debts = accounts.filter((a) => owed(a.kind));
  const owes = debts.reduce((t, a) => t - worthOf(v, a), 0);
  const loans = debts.filter((a) => a.kind === 'loan');
  const onLoans = loans.reduce((t, a) => t - worthOf(v, a), 0);
  const loanDrop = loans.reduce((t, a) => t + (worthOf(v, a) - worthOn(v, a, start.date)), 0);
  const ownedKeys = groups.filter((g) => g.key !== 'cards' && g.key !== 'loans' && months.some((m) => (m.owned[g.key] || 0) > 0));
  // A home or car stands as its equity, its loan taken from it: a house and its mortgage would otherwise
  // set the scale, above zero and mirrored below it, and leave cash a sliver. Net worth is the same.
  // Without them (picked), what is left is drawn at a scale of its own: cash and savings beside investments.
  const netted = months.some((m) => m.secured > 0);
  const hasHome = ownedKeys.some((g) => g.key === 'property');
  const homeToo = counted === 'all' || !hasHome;
  const keys = ownedKeys.filter((g) => homeToo || g.key !== 'property');
  const named = (g: { key: string; name: string }) => (netted && g.key === 'property' ? `${g.name}, less their loans` : g.name);
  const bars = (m: WorthMonth) => {
    const equity = (m.owned.property || 0) - m.secured;
    const up = keys.map((g) => ({ key: g.key, value: g.key === 'property' ? Math.max(equity, 0) : m.owned[g.key] || 0, color: g.color }));
    return { up, down: m.owes - m.secured + (homeToo ? Math.max(-equity, 0) : 0), net: homeToo ? m.net : m.net - equity };
  };
  const owedName = netted ? 'Other debts' : 'Owed';
  const netName = homeToo ? 'Net worth' : 'Net worth without Home & Car';
  const sorted = (list: finance.Account[]) => [...list].sort((a, b) => Math.abs(worthOf(v, b)) - Math.abs(worthOf(v, a)));
  const row = (a: finance.Account) => {
    const w = worthOf(v, a), d = w - worthOn(v, a, start.date);
    const loan = a.loan ? accounts.find((x) => x.id === a.loan) : undefined;
    const paid = a.original ? Math.max(0, Math.min(1, (a.original - a.balance) / a.original)) : -1;
    // Kept in another currency: its own figure first, as the bank shows it.
    const own = a.currency ? `${moneyIn(Math.abs(todayOf(v, a)) / rateOf(v.plan, a), a.currency)} · ` : '';
    const sub = own + (loan ? `${money(todayOf(v, a) - todayOf(v, loan))} equity` : paid >= 0 ? `${Math.round(paid * 100)}% of ${a.currency ? moneyIn(a.original!, a.currency).replace(/\.\d\d$/, '') : whole(a.original)} paid` : a.kind === 'card' && a.pending ? `${moneyIn(a.pending, a.currency)} pending` : ago(a.updated, v.today));
    return <Row key={a.id} lead={<AcctMark a={a} />} title={a.name} sub={sub}
      end={Math.abs(d) >= 0.5 ? <span class={'fx-change ' + (d > 0 ? 'fx-in' : 'fx-out')} title={`Since ${dayShort(start.date)}`}><span aria-hidden="true">{(d > 0) === (w >= 0) ? '↑ ' : '↓ '}</span>{compact(Math.abs(d))}<span class="fx-hidden"> {w >= 0 ? (d > 0 ? 'more' : 'less') : d > 0 ? 'less owed' : 'more owed'} since {dayShort(start.date)}</span></span> : undefined}
      when={<Amount value={Math.abs(w)} form="full" />} whenPlain
      onOpen={edit ? () => edit('account', a.id) : undefined} openLabel="edit" />;
  };
  return (
    <div class="fin">
      <div class="fx-board">
        <Widget title="Net worth" kind="fx-figurecard">
          <Stat size="lg" value={<Amount value={now} />} />
        </Widget>
        <Widget title={`Since ${dayShort(start.date)}`} kind="fx-figurecard">
          <Stat size="lg" value={<Amount value={now - start.net} sign tone="auto" />} aside={<Delta value={now - start.net} base={start.net} shareOnly />} />
        </Widget>
        <Widget title="What's owed" kind="fx-figurecard">
          <p class="fx-say">You owe <Amount value={owes} form="full" tone="out" />{loans.length ? <>{onLoans > owes / 2 ? ', most of it on loans. They are' : '. Your loans are'} <Amount value={Math.abs(loanDrop)} form="whole" /> {loanDrop >= 0 ? 'smaller' : 'larger'} than on {dayShort(start.date)}.</> : '.'}</p>
        </Widget>

        <Widget title="Net worth by month" span="all" kind="fx-worthchart"
          actions={<>
            {hasHome && <Segmented label="What it counts" value={counted} pick={setCounted} options={[['all', 'Everything'], ['liquid', 'Without Home & Car']]} />}
            <Segmented label="How far back" value={range} pick={setRange} options={ranges.map(([k, t]) => [k, t])} />
          </>}>
          <StackedBars format={tick} height={280}
            label={`${netName} at each month's end, what is owned stacked above zero${homeToo && netted ? ' (a home and car less their loans)' : ''} and what is owed below: ${months.map((m) => `${month(m.date)} ${money(bars(m).net)}${m.ahead ? ' ahead' : ''}`).join(', ')}.`}
            columns={months.map((m) => ({
              label: m.date === v.today ? 'Now' : month(m.date),
              up: bars(m).up.map(({ value, color }) => ({ value, color })),
              down: [{ value: bars(m).down, color: 8 }],
              line: bars(m).net,
              ahead: m.ahead,
            }))}
            tip={(i) => {
              const m = months[i], b = bars(m);
              return <>
                <div class="fx-caption">{m.date === v.today ? 'Today' : `${dayShort(m.date)}${m.ahead ? ', ahead' : ''}`}</div>
                <div class="fx-tiphead fx-gap"><span>Owned</span><Amount value={b.up.reduce((t, p) => t + p.value, 0)} form="full" tone="in" /></div>
                {keys.map((g, k) => <div key={g.key} class="fx-tiprow"><Dot color={g.color} /><span>{named(g)}</span><Amount value={b.up[k].value} form="full" /></div>)}
                <div class="fx-tiphead fx-gap"><span>{owedName}</span><Amount value={-b.down} form="full" tone="out" /></div>
                <div class="fx-tiptotal"><span>{netName}</span><Amount value={b.net} form="full" /></div>
              </>;
            }} />
          <Legend layout="inline" items={[
            ...keys.map((g) => ({ label: named(g), color: g.color })),
            { label: owedName, color: 8 },
            { label: netName, color: 'muted', shape: 'line' },
            ...(months.some((m) => m.ahead) ? [{ label: 'Ahead, from your paychecks and bills', color: 'muted' as const, shape: 'dash' as const }] : []),
          ]} />
        </Widget>

        <Widget title={<>What you own <span class="fx-sub"><Amount value={owned.reduce((t, a) => t + worthOf(v, a), 0)} form="whole" /></span></>} kind="fx-ownlist" span={2}>
          <Rows kind="fx-rows">{sorted(owned).map(row)}</Rows>
        </Widget>
        <Widget title={<>What you owe <span class="fx-sub"><Amount value={owes} form="whole" /></span></>} kind="fx-owelist">
          {debts.length ? <Rows kind="fx-rows">{sorted(debts).map(row)}</Rows> : <Empty>Nothing owed.</Empty>}
        </Widget>
        <GoalsWidget v={v} L={L} edit={edit} />
        <PostPayWidget v={v} L={L} sel={Math.min(sel, v.periods.length - 1)} pick={pick} update={update} />
      </div>
    </div>
  );
}
