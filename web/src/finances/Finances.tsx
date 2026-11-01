// The Finances screen: its heading, the seven views (Dashboard, Calendar,
// Transactions, Reports, Recurring, Pay, Net worth), and the one shown. screens/finances.ts reads the plan,
// keeps it, and opens the sheet; this only draws. On a phone allowed only
// to look (v.readOnly) it draws no Edit or Add.
import { render } from 'preact';
import { Segmented } from '../parts/Segmented';
import { Empty } from '../parts/Empty';
import type { What } from './Edit';
import { Calendar } from './Calendar';
import { setOwnLogos } from './Mark';
import { type Running } from './homelab';
import { Reports } from './Reports';
import { Transactions } from './Transactions';
import { openOn, Pay, Recurring, type SaveSettings } from './Lists';
import { cardOf, daysBetween, dayShort, type Lookup, lookup, setCurrency } from './money';
import { Overview, type OverviewProps } from './Overview';
import { NetWorth } from './Worth';

export interface FinancesProps {
  /** The plan read forward; null until it is read. */
  v: finance.View | null;
  /** What actually happened (the ledger); null until it is read. */
  ledger: finance.Ledger | null;
  /** Why it could not be read, and reading it again. */
  error?: string;
  retry: () => void;
  tab: string;
  setTab: (tab: string) => void;
  sel: number;
  pick: (i: number) => void;
  setWaiting: OverviewProps['setWaiting'];
  saveSettings: SaveSettings;
  /** Keeps the plan as it is given (Add to the plan); false when it failed. */
  keep: (plan: finance.Plan) => Promise<boolean>;
  /** Opens a form: one that exists by its id, or a new account of a kind. */
  edit: (what: What, id?: string, kind?: string) => void;
  /** The calendar feed's link (Pay › Paydays and money); on the computer only. */
  calendar?: () => Promise<string>;
  /** The apps running here, each with the paid services it stands in for (Recurring says which payments they do the job of). */
  running?: Running[];
  /** Wallos's subscriptions, read on a click (Recurring); on the computer, while Wallos runs. */
  fromWallos?: () => Promise<app.AppSubscription[]>;
  /** Reads a receipt by its name: a phone allowed only to look shows it under its transaction. */
  readReceipt: (name: string) => Promise<string>;
  /** Saves an export (Reports' CSV) and says where it went; "" when cancelled. */
  exportFile: (name: string, text: string) => Promise<string>;
  /** Shown on a phone (the companion), not on the computer. */
  phone?: boolean;
}

const tabs: [string, string][] = [['overview', 'Dashboard'], ['calendar', 'Calendar'], ['transactions', 'Transactions'], ['reports', 'Reports'], ['recurring', 'Recurring'], ['pay', 'Pay'], ['worth', 'Net worth']];
const adds: Record<string, [What, string]> = { overview: ['payment', 'Add a payment'], calendar: ['payment', 'Add a payment'], transactions: ['transaction', 'Add a transaction'], reports: ['transaction', 'Add a transaction'], recurring: ['payment', 'Add a payment'], pay: ['person', 'Add a paycheck'], worth: ['account', 'Add an account'] };

function FinancesScreen({ v, ledger, error, retry, tab, setTab, sel, pick, setWaiting, saveSettings, keep, edit: open, exportFile, readReceipt, running, calendar, fromWallos, phone }: FinancesProps) {
  // A card's payoff with each paycheck is no payment of its own: it opens the card's form.
  const edit = (what: What, id?: string, kind?: string) => (cardOf(id) ? open('account', cardOf(id)) : open(what, id, kind));
  const L = v ? lookup(v.plan) : null;
  setCurrency(v?.plan.currency);
  setOwnLogos(v?.plan.logos);
  const [what, label] = adds[tab] || adds.overview;
  const ro = !!v?.readOnly;
  // Every number reads from the balances typed in (the oldest of checking's
  // and the cards'), with what has happened since: a week old, they say so.
  const age = v?.typed ? daysBetween(v.typed, v.today) : -1;
  const lead = (age < 0 ? (phone ? 'Typed in by you, kept on your homelab' : 'Typed in by you, kept on this machine')
    : age === 0 ? 'Balances from today' : `Balances from ${dayShort(v.typed)}, with what's happened since` + (age >= 7 ? `: ${age} days ago${ro ? '' : ', update them with Edit'}` : ''))
    + (ro ? ' · view only' : '');
  return (
    <>
      <div class="row header">
        <div><h1>Finances</h1><p class={'lead' + (age >= 7 ? ' warn' : '')}>{lead}</p></div>
        {!ro && <div class="toolbar">{!!v?.plan.accounts?.length && <button class="btn" onClick={() => edit('balances')}>Update balances</button>}<button class="btn fx-primary" onClick={() => edit(what)} disabled={!v}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{label}</button></div>}
      </div>
      <Segmented label="View" value={tab} pick={setTab} options={tabs} />
      <div class="finbody">
        {!v && error ? <Empty>The finances file could not be read: {error} <button class="small" onClick={retry}>Try again</button></Empty>
          : !v ? <Empty>Reading…</Empty>
          : ro ? <View v={v} L={L} ledger={ledger} exportFile={exportFile} readReceipt={readReceipt} running={running} tab={tab} sel={sel} pick={pick} openWorth={() => setTab('worth')} openSubscriptions={() => { openOn('subscriptions'); setTab('recurring'); }} openTransactions={() => setTab('transactions')} />
          : tab === 'calendar' ? <Calendar v={v} L={L} edit={(w, id) => edit(w, id)} />
          : tab === 'transactions' ? <Transactions v={v} L={L} ledger={ledger} edit={(w, id) => edit(w, id)} />
          : tab === 'reports' ? <Reports v={v} ledger={ledger} exportFile={exportFile} />
          : tab === 'recurring' ? <Recurring v={v} L={L} edit={edit} keep={keep} running={running} fromWallos={fromWallos} />
          : tab === 'pay' ? <Pay v={v} L={L} edit={edit} saveSettings={saveSettings} keep={keep} calendar={calendar} />
          : tab === 'worth' ? <NetWorth v={v} L={L} edit={edit} sel={sel} pick={pick} update={() => edit('balances')} keep={keep} />
          : <Overview v={v} L={L} sel={sel} pick={pick} setWaiting={setWaiting} add={(w, k) => edit(w, undefined, k)} edit={(w, id) => edit(w, id)} openWorth={() => setTab('worth')} openSubscriptions={() => { openOn('subscriptions'); setTab('recurring'); }} openTransactions={() => setTab('transactions')} />}
      </div>
    </>
  );
}

/** A view as a phone allowed only to look draws it: the same, without a way to change anything (an export changes nothing). */
function View({ v, L, ledger, tab, sel, pick, openWorth, openSubscriptions, openTransactions, exportFile, readReceipt, running }: { v: finance.View; L: Lookup; ledger: finance.Ledger | null; exportFile: FinancesProps['exportFile']; readReceipt: FinancesProps['readReceipt']; running?: Running[]; tab: string; sel: number; pick: (i: number) => void; openWorth: () => void; openSubscriptions: () => void; openTransactions: () => void }) {
  return tab === 'calendar' ? <Calendar v={v} L={L} />
    : tab === 'transactions' ? <Transactions v={v} L={L} ledger={ledger} readReceipt={readReceipt} />
    : tab === 'reports' ? <Reports v={v} ledger={ledger} exportFile={exportFile} />
    : tab === 'recurring' ? <Recurring v={v} L={L} running={running} />
    : tab === 'pay' ? <Pay v={v} L={L} />
    : tab === 'worth' ? <NetWorth v={v} L={L} sel={sel} pick={pick} />
    : <Overview v={v} L={L} sel={sel} pick={pick} openWorth={openWorth} openSubscriptions={openSubscriptions} openTransactions={openTransactions} />;
}

export function mountFinances(el: Element, props: FinancesProps) { render(<FinancesScreen {...props} />, el); }
