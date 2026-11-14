// Finances › Dashboard: the widgets laid on the board, nothing drawn here.
// First checking now and after the next paycheck, each with how it adds up
// (on a phone after Coming up and the goals); then checking over the next month and the paycheck picked side by side; a
// month's cash flow (its bills pick the paycheck), where the spending goes,
// and net worth; what the balances are taken to hold, when anything is;
// and every account after each paycheck. A new household starts with the
// three things to type in. On a phone it opens with what is coming up (the
// next two weeks of bills) and the goals, then the paycheck.
import { Card } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Mark } from './Mark';
import { Widget } from './ui/Widget';
import type { Lookup } from './money';
import { CheckingWidget } from './widgets/Checking';
import { NowWidget } from './widgets/Now';
import { PricesWidget } from './widgets/Prices';
import { MissingWidget } from './widgets/Missing';
import { AveragesWidget } from './widgets/Averages';
import { CashFlowWidget, MoneyFlowWidget, SpendingWidget } from './widgets/Flow';
import { PaycheckWidget, paydayTitle, periodTitle } from './widgets/Paycheck';
import { keepBy, PeriodBar, type PeriodBarProps, type PeriodBy, pickedOf, readBy } from './widgets/Period';
import { PastWidget } from './widgets/Past';
import { PlannedWidget } from './widgets/Planned';
import { monthPeriods, pastPeriods } from './model';
import { dayShort, isoDay, parseDay } from './money';
import { dayText } from '../format';
import { useState } from 'preact/hooks';
import { RenewingWidget } from './widgets/Subscriptions';
import { BudgetsWidget, toWatch } from './widgets/Budgets';
import { NetWorthWidget } from './widgets/Worth';
import { SinceWidget, type SinceState } from './widgets/Ledger';
import { ComingUpWidget } from './widgets/ComingUp';
import { GoalsWidget } from './widgets/Goals';
import { LatestWidget } from './widgets/Latest';
import { SpentWidget } from './widgets/Spent';
import { TrendWidget } from './widgets/Trend';
import { ArrangedBoard } from './Arrange';
import type { showTransactions } from './Transactions';

/** What the dashboard draws; add, edit, and setSince are left out on a phone allowed only to look, so it offers no way to change anything. */
export interface OverviewProps {
  v: finance.View;
  L: Lookup;
  /** The period picked: 0 is now, 1 the next paycheck. */
  sel: number;
  pick: (i: number) => void;
  add?: (what: 'account' | 'person' | 'payment', kind?: string) => void;
  /** Opens a payment's form, a goal's (the phone's Goals), or a transaction's (from the money flow). */
  edit?: (what: 'payment' | 'goal' | 'transaction', id: string) => void;
  /** The ledger, for a real month's money flow; null until it is read. */
  ledger?: finance.Ledger | null;
  /** Says what became of a paycheck or payment taken as done: counted, waiting (it comes today), or a bill the balance has already. */
  setSince?: (key: string, state: SinceState) => Promise<boolean>;
  /** Keeps the plan (a subscription's new price); left out on a phone allowed only to look. */
  keep?: (plan: finance.Plan) => Promise<boolean>;
  /** Shows Net worth. */
  openWorth: () => void;
  /** Shows Recurring's Subscriptions. */
  openSubscriptions?: () => void;
  /** Shows Recurring: a typical month, payment by payment; with a filter, on those payments (Bills, Cards…). */
  openRecurring?: (filter?: string) => void;
  /** Shows Transactions filtered (a category of this month's spending). */
  showIn?: (f: Parameters<typeof showTransactions>[0]) => void;
  /** Shows Transactions (and its budgets). */
  openTransactions?: () => void;
  /** Shows the Calendar, on a day when one is given (the checking chart's). */
  openCalendar?: (day?: string) => void;
  /** Shows Paychecks: each pay period ahead. */
  openPay?: () => void;
  /** Shows an account's own page. */
  openAccount?: (id: string) => void;
  /** Drawn on a phone (the companion): what is coming up first, and the goals. */
  phone?: boolean;
}

/**
 * The three things a plan starts with (usability task 15, item 1): each row
 * ticked once it's there ("✓ Example Checking"), its button gone; the card
 * goes only once all three are there.
 */
function StartThree({ v, add }: { v: finance.View; add: NonNullable<OverviewProps['add']> }) {
  const acct = (v.plan.accounts || []).find((a) => a.kind === 'checking');
  const person = (v.plan.people || [])[0];
  const bill = (v.plan.payments || [])[0];
  const row = (done: string, lead: preact.ComponentChildren, title: string, sub: string, label: string, onAdd: () => void) => (
    <Row lead={lead} title={done ? `✓ ${done}` : title} sub={done ? 'Done' : sub} end={done ? undefined : <button class="small" onClick={onAdd}>{label}</button>} />
  );
  return (
    <Widget title="Start with three things" span="all" kind="finstart">
      <Rows kind="fx-rows">
        {row(acct?.name || '', <Mark kind="checking" name="Checking" />, 'Your checking account', 'Where paychecks land and bills come out', 'Add an account', () => add('account', 'checking'))}
        {row(person ? `${person.name}'s paycheck` : '', <Mark kind="savings" name="Pay" />, 'Who gets paid, and when', 'Every other Friday, the 26th, twice a month', 'Add a paycheck', () => add('person'))}
        {row(bill?.name || '', <Mark kind="home" name="Bills" />, 'What comes out each month', 'The mortgage, the car, subscriptions, a card\u2019s balance', 'Add a payment', () => add('payment'))}
      </Rows>
    </Widget>
  );
}

/**
 * Whether a plan is past its start: a paycheck and a payment are in. A
 * missing checking account after that is the note's to say, as before.
 */
const startedThree = (v: finance.View) => !!v.plan.people?.length && !!v.plan.payments?.length;

export function Overview({ v, L, sel, pick, add, edit, setSince, keep, ledger, openWorth, openSubscriptions, openRecurring, openTransactions, openCalendar, openPay, openAccount, showIn, phone }: OverviewProps) {
  // The period bar: by paycheck (now and the paychecks ahead, the plan's; before now, what happened, from the ledger)
  // or by month (before this one from the ledger, this one so far and then the plan, after it the plan).
  const [by, setByState] = useState<PeriodBy>(readBy);
  const { months, now: thisMonth } = monthPeriods(v);
  const [monthAt, setMonthAt] = useState(thisMonth);
  const setBy = (b: PeriodBy) => { keepBy(b); setByState(b); };
  const past = pastPeriods(v);
  const picked = pickedOf(v, past, sel);
  const month = by === 'month' ? months[Math.max(0, Math.min(monthAt, months.length - 1))] : undefined;
  const was = by === 'pay' && picked < 0 ? past[-picked - 1] : undefined;
  const p = by === 'pay' && picked >= 0 ? v.periods[picked] : undefined;
  const bar: PeriodBarProps | null = month
    ? { by, setBy, title: dayText(parseDay(month.start), { month: 'long', year: 'numeric' }),
      dates: `${dayShort(month.start)} – ${dayShort(month.last)}, ${month.when === 'past' ? 'what happened' : month.when === 'now' ? 'so far, then the plan' : 'the plan'}`,
      step: (d) => setMonthAt(Math.max(0, Math.min(months.length - 1, monthAt + d))), canBack: monthAt > 0, canOn: monthAt < months.length - 1,
      today: () => setMonthAt(thisMonth), atToday: monthAt === thisMonth }
    : p || was ? { by, setBy, title: p ? periodTitle(p, L) : paydayTitle(was!.pay, L),
      dates: p ? `${dayShort(p.start)} – ${dayShort(p.last)}${p.now ? ', from today' : ''}` : `${dayShort(was!.start)} – ${dayShort(was!.last)}, what happened`,
      step: (d) => pick(picked + d), canBack: picked > -past.length, canOn: picked < v.periods.length - 1, today: () => pick(0), atToday: picked === 0 }
    : null;
  // The cards the period picked puts in the paycheck card's place, and the days the spending ring reads.
  const read = month ? (month.when === 'ahead' ? undefined : { start: month.start, last: month.when === 'now' ? v.today : month.last }) : was;
  const spentDays = month ? (month.when === 'past' ? { from: month.start, to: month.last } : undefined) : was && { from: was.start, to: was.last };
  if (!v.plan.accounts?.length && !v.plan.people?.length && !add) return <div class="fin"><Card kind="finstart"><Empty>Nothing typed in yet: Finances are filled in on the computer, or on a phone allowed to change them.</Empty></Card></div>;
  if (!v.plan.accounts?.length && !v.plan.people?.length) {
    return <div class="fin"><div class="fx-board"><StartThree v={v} add={add} /></div></div>;
  }
  return (
    <div class="fin">
      {add && !startedThree(v) && <div class="fx-board"><StartThree v={v} add={add} /></div>}
      {/* The three things say it while they show; otherwise the note does (on a phone that only looks too). */}
      {!v.checking && !(add && !startedThree(v)) && (
        <Card kind="finnote" role="status">
          <Mark kind="checking" name="Checking" />
          <span class="grow"><strong>No checking account yet.</strong> Paychecks land in it and payments come out of it, so until there is one every balance below reads $0.00.</span>
          {add && <button class="small" onClick={() => add('account', 'checking')}>Add your checking account</button>}
        </Card>
      )}
      {bar && <PeriodBar {...bar} />}
      <ArrangedBoard phone={phone} slots={[
        { id: 'now', title: 'Checking now', width: 'full', node: !phone && <NowWidget v={v} L={L} /> },
        { id: 'since', title: 'Since the balances', width: 'full', node: !!v.since?.length && <SinceWidget v={v} L={L} set={setSince} /> },
        { id: 'missing', title: 'Bills not seen', width: 'full', node: <MissingWidget v={v} L={L} open={openTransactions} /> },
        { id: 'prices', title: 'New prices', width: 'full', node: <PricesWidget v={v} L={L} keep={keep} /> },
        { id: 'averages', title: "Bills' averages", width: 'full', node: <AveragesWidget v={v} L={L} keep={keep} /> },
        { id: 'comingup', title: 'Coming up', width: 'full', node: phone && <ComingUpWidget v={v} L={L} calendar={openCalendar} /> },
        { id: 'goals', title: 'Goals', width: 'full', node: phone && <GoalsWidget v={v} L={L} edit={edit && ((w, id) => edit(w, id!))} all={openWorth} /> },
        { id: 'nowphone', title: 'Checking now', width: 'full', node: phone && <NowWidget v={v} L={L} /> },
        { id: 'past', title: 'What happened', width: 'full', node: read && <PastWidget v={v} L={L} past={read} title={month?.when === 'now' ? 'So far this month' : undefined} ledger={ledger} edit={edit} /> },
        { id: 'planned', title: 'The plan', width: 'full', node: month && month.when !== 'past' && (() => {
          // The plan's days, from tomorrow for this month (today's are in So far), or the whole month after it.
          const from = month.when === 'now' ? isoDay(new Date(parseDay(v.today).getTime() + 864e5)) : month.start;
          return from <= month.last && <PlannedWidget v={v} L={L} title={month.when === 'now' ? 'Still to come' : 'The plan'} start={from} last={month.last} edit={edit} />;
        })() },
        { id: 'paycheck', title: 'This paycheck', width: 'full', node: p && <PaycheckWidget v={v} L={L} sel={picked} edit={edit} open={openPay} /> },
        { id: 'checking', title: 'Checking ahead', width: 'half', node: <CheckingWidget v={v} L={L} sel={p ? picked : -1} openDay={openCalendar} /> },
        { id: 'trend', title: 'Looking back', width: 'full', node: <TrendWidget v={v} ledger={ledger} openDay={openCalendar} openAccount={openAccount} /> },
        { id: 'renewing', title: 'Renewing soon', width: 'half', node: <RenewingWidget v={v} L={L} edit={edit} all={openSubscriptions} /> },
        { id: 'budgets', title: 'Budgets to watch', width: 'half', node: <BudgetsWidget v={v} only={toWatch} title="Budgets to watch" span={1} open={openTransactions} show={showIn && ((category, month) => showIn({ category, month }))} /> },
        { id: 'cashflow', title: 'Cash flow', width: 'half', node: <CashFlowWidget v={v} L={L} open={openRecurring && (() => openRecurring())} ledger={ledger} showIn={showIn} /> },
        { id: 'spending', title: 'Where it goes', width: 'half', node: <SpendingWidget v={v} L={L} open={openRecurring && (() => openRecurring())} openKind={openRecurring} /> },
        { id: 'latest', title: 'Latest transactions', width: 'half', node: !read && <LatestWidget v={v} L={L} ledger={ledger} edit={edit} all={openTransactions} /> },
        { id: 'spent', title: 'Spent this month', width: 'half', node: !(month?.when === 'ahead') && <SpentWidget v={v} ledger={ledger} open={showIn} days={spentDays} /> },
        { id: 'moneyflow', title: 'Money flow', width: 'full', node: <MoneyFlowWidget v={v} L={L} ledger={ledger} edit={edit} /> },
        { id: 'networth', title: 'Net worth', width: 'full', node: <NetWorthWidget v={v} open={openWorth} /> },
      ]} />
    </div>
  );
}
