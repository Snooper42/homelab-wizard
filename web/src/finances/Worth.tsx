// Finances › Net worth, laid from the kit: today's figure, its change over
// the range picked, and what is owed; month by month, what is owned
// stacked above zero and what is owed below it, net worth the line through
// them and the months ahead (read forward from the paychecks) faded; and
// what the household owns and owes, account by account, each opening its
// form.
import { useState } from 'preact/hooks';
import { Card } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Amount, Delta, Stat } from './ui/Amount';
import { StackedBars } from './ui/charts';
import { Dot, Legend } from './ui/Legend';
import { Widget } from './ui/Widget';
import { Mark } from './Mark';
import { firstKept, groups, netWorth, worthByMonth, worthOf, worthOn } from './model';
import { compact, daysBetween, dayShort, type Lookup, money, monthName, parseDay, tick, whole } from './money';

interface WorthProps {
  v: finance.View;
  L: Lookup;
  /** Opens the form for one, or a new one; none on a phone allowed only to look. */
  edit?: (what: 'account' | 'person' | 'payment', id?: string) => void;
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

export function NetWorth({ v, L, edit }: WorthProps) {
  const [range, setRange] = useState('3');
  const accounts = v.plan.accounts || [];
  if (!accounts.length && !edit) return <Card kind="finstart"><Empty>No accounts typed in yet.</Empty></Card>;
  if (!accounts.length) {
    return (
      <Card kind="finstart">
        <h2>Nothing here yet</h2>
        <Rows>
          <Row lead={<Mark kind="checking" name="Accounts" />} title="Bank accounts, cards, and investments" sub="What each holds, typed in" end={<button class="small" onClick={() => edit('account')}>Add an account</button>} />
          <Row lead={<Mark kind="home" name="Home" />} title="A home or a car" sub="What it is worth, and the loan against it: its equity" end={<button class="small" onClick={() => edit('account')}>Add property</button>} />
        </Rows>
      </Card>
    );
  }
  // As far back as balances were kept, at most the range picked.
  const kept = parseDay(firstKept(v)), today = parseDay(v.today);
  const back = Math.max(1, Math.min(ranges.find(([k]) => k === range)?.[2] ?? 3, (today.getFullYear() - kept.getFullYear()) * 12 + today.getMonth() - kept.getMonth()));
  const months = worthByMonth(v, back, 3);
  const start = months[0];
  const now = netWorth(v);
  const owned = accounts.filter((a) => worthOf(v, a) >= 0);
  const debts = accounts.filter((a) => worthOf(v, a) < 0);
  const owes = debts.reduce((t, a) => t - worthOf(v, a), 0);
  const loanDrop = debts.filter((a) => a.kind === 'loan').reduce((t, a) => t + (worthOf(v, a) - worthOn(v, a, start.date)), 0);
  const ownedKeys = groups.filter((g) => g.key !== 'cards' && g.key !== 'loans' && months.some((m) => (m.owned[g.key] || 0) > 0));
  const sorted = (list: finance.Account[]) => [...list].sort((a, b) => Math.abs(worthOf(v, b)) - Math.abs(worthOf(v, a)));
  const row = (a: finance.Account) => {
    const w = worthOf(v, a), d = w - worthOn(v, a, start.date);
    const loan = a.loan ? accounts.find((x) => x.id === a.loan) : undefined;
    const paid = a.original ? Math.max(0, Math.min(1, (a.original - a.balance) / a.original)) : -1;
    const sub = loan ? `${money(a.balance - loan.balance)} equity` : paid >= 0 ? `${Math.round(paid * 100)}% of ${whole(a.original)} paid` : a.kind === 'card' && a.pending ? `${money(a.pending)} pending` : ago(a.updated, v.today);
    return <Row key={a.id} lead={<Mark brand={a.institution} kind={a.kind} name={a.name} />} title={a.name} sub={sub}
      end={Math.abs(d) >= 0.5 ? <span class={'fx-change ' + (d > 0 ? 'fx-in' : 'fx-out')} title={`Since ${dayShort(start.date)}`}><span aria-hidden="true">{(d > 0) === (w >= 0) ? '↑ ' : '↓ '}</span>{compact(Math.abs(d))}<span class="fx-hidden"> {w >= 0 ? (d > 0 ? 'more' : 'less') : d > 0 ? 'less owed' : 'more owed'} since {dayShort(start.date)}</span></span> : undefined}
      when={<Amount value={Math.abs(w)} form="full" />} whenPlain
      onOpen={edit ? () => edit('account', a.id) : undefined} openLabel={`${a.name}, ${money(Math.abs(w))}: edit`} />;
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
          <p class="fx-say">You owe <Amount value={owes} form="full" tone="out" />{debts.some((a) => a.kind === 'loan') && <>, most of it on loans. They are <Amount value={Math.abs(loanDrop)} form="whole" /> {loanDrop >= 0 ? 'smaller' : 'larger'} than on {dayShort(start.date)}.</>}</p>
        </Widget>

        <Widget title="Net worth by month" span="all" kind="fx-worthchart"
          actions={<Segmented label="How far back" value={range} pick={setRange} options={ranges.map(([k, t]) => [k, t])} />}>
          <StackedBars format={tick} height={280}
            label={`Net worth at each month's end, what is owned stacked above zero and what is owed below: ${months.map((m) => `${month(m.date)} ${money(m.net)}${m.ahead ? ' ahead' : ''}`).join(', ')}.`}
            columns={months.map((m) => ({
              label: m.date === v.today ? 'Now' : month(m.date),
              up: ownedKeys.map((g) => ({ value: m.owned[g.key] || 0, color: g.color })),
              down: [{ value: m.owes, color: 8 }],
              line: m.net,
              ahead: m.ahead,
            }))}
            tip={(i) => {
              const m = months[i];
              const owns = ownedKeys.reduce((t, g) => t + (m.owned[g.key] || 0), 0);
              return <>
                <div class="fx-caption">{m.date === v.today ? 'Today' : `${dayShort(m.date)}${m.ahead ? ', ahead' : ''}`}</div>
                <div class="fx-tiphead fx-gap"><span>Owned</span><Amount value={owns} form="full" tone="in" /></div>
                {ownedKeys.map((g) => <div key={g.key} class="fx-tiprow"><Dot color={g.color} /><span>{g.name}</span><Amount value={m.owned[g.key] || 0} form="full" /></div>)}
                <div class="fx-tiphead fx-gap"><span>Owed</span><Amount value={-m.owes} form="full" tone="out" /></div>
                <div class="fx-tiptotal"><span>Net worth</span><Amount value={m.net} form="full" /></div>
              </>;
            }} />
          <Legend layout="inline" items={[
            ...ownedKeys.map((g) => ({ label: g.name, color: g.color })),
            { label: 'Owed', color: 8 },
            { label: 'Net worth', color: 'muted', shape: 'line' },
            ...(months.some((m) => m.ahead) ? [{ label: 'Ahead, from your paychecks and bills', color: 'muted' as const, shape: 'dash' as const }] : []),
          ]} />
        </Widget>

        <Widget title={<>What you own <span class="fx-sub"><Amount value={owned.reduce((t, a) => t + worthOf(v, a), 0)} form="whole" /></span></>} kind="fx-ownlist" span={2}>
          <Rows kind="fx-rows">{sorted(owned).map(row)}</Rows>
        </Widget>
        <Widget title={<>What you owe <span class="fx-sub"><Amount value={owes} form="whole" /></span></>} kind="fx-owelist">
          {debts.length ? <Rows kind="fx-rows">{sorted(debts).map(row)}</Rows> : <Empty>Nothing owed.</Empty>}
        </Widget>
      </div>
    </div>
  );
}
