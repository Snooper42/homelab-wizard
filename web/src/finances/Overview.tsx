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
import { PaycheckWidget } from './widgets/Paycheck';
import { RenewingWidget } from './widgets/Subscriptions';
import { BudgetsWidget, toWatch } from './widgets/Budgets';
import { NetWorthWidget } from './widgets/Worth';
import { SinceWidget, type SinceState } from './widgets/Ledger';
import { ComingUpWidget } from './widgets/ComingUp';
import { GoalsWidget } from './widgets/Goals';
import { LatestWidget } from './widgets/Latest';

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
  /** Shows Recurring: a typical month, payment by payment. */
  openRecurring?: () => void;
  /** Shows Transactions (and its budgets). */
  openTransactions?: () => void;
  /** Shows the Calendar. */
  openCalendar?: () => void;
  /** Drawn on a phone (the companion): what is coming up first, and the goals. */
  phone?: boolean;
}

export function Overview({ v, L, sel, pick, add, edit, setSince, keep, ledger, openWorth, openSubscriptions, openRecurring, openTransactions, openCalendar, phone }: OverviewProps) {
  const picked = Math.min(sel, v.periods.length - 1);
  if (!v.plan.accounts?.length && !v.plan.people?.length && !add) return <div class="fin"><Card kind="finstart"><Empty>Nothing typed in yet: Finances are filled in on the computer, or on a phone allowed to change them.</Empty></Card></div>;
  if (!v.plan.accounts?.length && !v.plan.people?.length) {
    return (
      <div class="fin"><div class="fx-board"><Widget title="Start with three things" span="all" kind="finstart">
        <Rows kind="fx-rows">
          <Row lead={<Mark kind="checking" name="Checking" />} title="Your checking account" sub="Where paychecks land and bills come out" end={<button class="small" onClick={() => add('account', 'checking')}>Add an account</button>} />
          <Row lead={<Mark kind="savings" name="Pay" />} title="Who gets paid, and when" sub="Every other Friday, the 26th, twice a month" end={<button class="small" onClick={() => add('person')}>Add a paycheck</button>} />
          <Row lead={<Mark kind="home" name="Bills" />} title="What comes out each month" sub="The mortgage, the car, subscriptions, a card's balance" end={<button class="small" onClick={() => add('payment')}>Add a payment</button>} />
        </Rows>
      </Widget></div></div>
    );
  }
  return (
    <div class="fin">
      {!v.checking && (
        <Card kind="finnote" role="status">
          <Mark kind="checking" name="Checking" />
          <span class="grow"><strong>No checking account yet.</strong> Paychecks land in it and payments come out of it, so until there is one every balance below reads $0.00.</span>
          {add && <button class="small" onClick={() => add('account', 'checking')}>Add your checking account</button>}
        </Card>
      )}
      <div class="fx-board">
        {!phone && <NowWidget v={v} L={L} />}
        {!!v.since?.length && <SinceWidget v={v} L={L} set={setSince} />}
        <MissingWidget v={v} L={L} open={openTransactions} />
        <PricesWidget v={v} L={L} keep={keep} />
        <AveragesWidget v={v} L={L} keep={keep} />
        {phone && <ComingUpWidget v={v} L={L} calendar={openCalendar} />}
        {phone && <GoalsWidget v={v} L={L} edit={edit && ((w, id) => edit(w, id!))} all={openWorth} />}
        {phone && <NowWidget v={v} L={L} />}
        <PaycheckWidget v={v} L={L} sel={picked} pick={pick} edit={edit} />
        <CheckingWidget v={v} L={L} sel={picked} />
        <RenewingWidget v={v} L={L} edit={edit} all={openSubscriptions} />
        <BudgetsWidget v={v} only={toWatch} title="Budgets to watch" span={1} open={openTransactions} />
        <CashFlowWidget v={v} L={L} open={openRecurring} />
        <SpendingWidget v={v} L={L} open={openRecurring} />
        <LatestWidget v={v} L={L} ledger={ledger} edit={edit} all={openTransactions} />
        <MoneyFlowWidget v={v} L={L} ledger={ledger} edit={edit} />
        <NetWorthWidget v={v} open={openWorth} />
      </div>
    </div>
  );
}
