// Finances › Dashboard: the widgets laid on the board, nothing drawn here.
// Checking over the next month and the paycheck picked side by side; a
// month's cash flow (its bars pick the paycheck), where the spending goes,
// and net worth; what the balances are taken to hold, when anything is;
// and every account after each paycheck. A new household starts with the
// three things to type in.
import { Card } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Mark } from './Mark';
import { split, type Lookup } from './money';
import { CheckingWidget } from './widgets/Checking';
import { CashFlowWidget, SpendingWidget } from './widgets/Flow';
import { PaycheckWidget } from './widgets/Paycheck';
import { NetWorthWidget } from './widgets/Worth';
import { PostPayWidget, SinceWidget, type SaveBalances } from './widgets/Ledger';

/** What the dashboard draws; saveBalances, add, edit, and setWaiting are left out on a phone allowed only to look, so it offers no way to change anything. */
export interface OverviewProps {
  v: finance.View;
  L: Lookup;
  /** The period picked: 0 is now, 1 the next paycheck. */
  sel: number;
  pick: (i: number) => void;
  /** Keeps the balances typed in (by account ID) and the cushion; false when it failed. */
  saveBalances?: SaveBalances;
  add?: (what: 'account' | 'person' | 'payment') => void;
  /** Opens a payment's form. */
  edit?: (what: 'payment', id: string) => void;
  /** Says whether a paycheck or payment taken as done has not happened yet (true: it waits, and comes today). */
  setWaiting?: (key: string, waiting: boolean) => Promise<boolean>;
  /** Shows Net worth. */
  openWorth: () => void;
}

/** Dollars big and the cents smaller (the lists' figures; the kit's is ui/Amount). */
export function Money({ n, tone }: { n: number; tone?: string }) {
  const [d, c] = split(n);
  return <span class={'money' + (tone ? ' ' + tone : '')}>{d}<small>{c}</small></span>;
}

export function Overview({ v, L, sel, pick, saveBalances, add, edit, setWaiting, openWorth }: OverviewProps) {
  const picked = Math.min(sel, v.periods.length - 1);
  if (!v.plan.accounts?.length && !v.plan.people?.length && !add) return <Card kind="finstart"><Empty>Nothing typed in yet: Finances are filled in on the computer, or on a phone allowed to change them.</Empty></Card>;
  if (!v.plan.accounts?.length && !v.plan.people?.length) {
    return (
      <Card kind="finstart">
        <h2>Start with three things</h2>
        <Rows>
          <Row lead={<Mark kind="checking" name="Checking" />} title="Your checking account" sub="Where paychecks land and bills come out" end={<button class="small" onClick={() => add('account')}>Add an account</button>} />
          <Row lead={<Mark kind="savings" name="Pay" />} title="Who gets paid, and when" sub="Every other Friday, the 26th, twice a month" end={<button class="small" onClick={() => add('person')}>Add a paycheck</button>} />
          <Row lead={<Mark kind="home" name="Bills" />} title="What comes out each month" sub="The mortgage, the car, subscriptions, a card's balance" end={<button class="small" onClick={() => add('payment')}>Add a payment</button>} />
        </Rows>
      </Card>
    );
  }
  return (
    <div class="fin">
      {!v.checking && (
        <Card kind="finnote" role="status">
          <Mark kind="checking" name="Checking" />
          <span class="grow"><strong>No checking account yet.</strong> Paychecks land in it and payments come out of it, so until there is one every balance below reads $0.00.</span>
          {add && <button class="small" onClick={() => add('account')}>Add your checking account</button>}
        </Card>
      )}
      <div class="fx-board">
        {!!v.since?.length && <SinceWidget v={v} L={L} set={setWaiting} />}
        <CheckingWidget v={v} L={L} sel={picked} />
        <PaycheckWidget v={v} L={L} sel={picked} edit={edit} />
        <CashFlowWidget v={v} L={L} sel={picked} pick={pick} />
        <SpendingWidget v={v} L={L} />
        <NetWorthWidget v={v} open={openWorth} />
        <PostPayWidget v={v} L={L} sel={picked} pick={pick} saveBalances={saveBalances} add={add} />
      </div>
    </div>
  );
}
