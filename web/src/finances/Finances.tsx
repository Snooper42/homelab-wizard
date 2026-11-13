// The Finances screen: its heading, the seven views (Dashboard, Calendar,
// Transactions, Reports, Recurring, Pay, Net worth), and the one shown. screens/finances.ts reads the plan,
// keeps it, and opens the sheet; this only draws. On a phone allowed only
// to look (v.readOnly) it draws no Edit or Add.
import { render } from 'preact';
import { HideAmounts } from './ui/HideAmounts';
import { useState } from 'preact/hooks';
import { MenuButton } from '../parts/MenuButton';
import { aheadCsv, aheadName, monthName, monthPage, planJson, planName } from './exportData';
import { Segmented } from '../parts/Segmented';
import { Empty } from '../parts/Empty';
import type { What } from './Edit';
import { Calendar, showDay } from './Calendar';
import { setOwnLogos } from './Mark';
import { AccountPage } from './Account';
import { setCategories } from './hues';
import { type Running } from './homelab';
import { Reports } from './Reports';
import { showTransactions, Transactions } from './Transactions';
import { openOn, Pay, Recurring, type SaveSettings } from './Lists';
import { cardOf, daysBetween, dayShort, isoDay, type Lookup, lookup, setCurrency } from './money';
import { Overview, type OverviewProps } from './Overview';
import { NetWorth, type NetWorthProps } from './Worth';

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
  setSince: OverviewProps['setSince'];
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
  /** Keeps the ledger (a link to a planned payment, from Transactions); false when it failed. */
  saveLedger?: (l: finance.Ledger) => Promise<boolean>;
  /** Saves an export (Reports' CSV, the plan, what's ahead) and says where it went; "" when cancelled. */
  exportFile: (name: string, text: string) => Promise<string>;
  /** Opens a month's page to print (the browser prints it); on a phone, shared or downloaded. Says where it went. */
  printMonth: (name: string, html: string) => Promise<string>;
  /** Shown on a phone (the companion), not on the computer. */
  phone?: boolean;
  /** The group of accounts Net worth shows on its own (a sidebar balance), "" for all; and picking another. */
  group?: string;
  setGroup?: (group: string) => void;
  /** Hides every amount, or shows them again (the eye); none on a phone allowed only to look. */
  toggleHidden?: () => void;
  /** Net worth › Investments: Read now and what it said; on the computer only. */
  investments?: NetWorthProps['invest'];
}

const tabs: [string, string][] = [['overview', 'Dashboard'], ['calendar', 'Calendar'], ['transactions', 'Transactions'], ['reports', 'Reports'], ['recurring', 'Recurring'], ['pay', 'Paychecks'], ['worth', 'Net worth']];

/**
 * The tabs in four: what happened (Spending: Transactions, Reports) and what
 * is coming (Plan: Calendar, Recurring, Paychecks) each a tab with its pages
 * in a second row under it, the first page opening with it. Each page keeps
 * its own name inside (`tab`), so every way into one still opens it.
 */
const groups: [string, string, string[]][] = [['overview', 'Dashboard', ['overview']], ['spending', 'Spending', ['transactions', 'reports']],
  ['plan', 'Plan', ['calendar', 'recurring', 'pay']], ['worth', 'Net worth', ['worth']]];
// An account's own page ("account:<id>") is under Net worth.
const groupOf = (tab: string) => groups.find(([, , pages]) => pages.includes(tab.startsWith('account:') ? 'worth' : tab)) || groups[0];
/** The page each tab was left on, so it opens there again (Plan on Paychecks); its first until one is. */
const leftOn: Record<string, string> = {};
const pageOf = (group: string) => leftOn[group] || groups.find(([k]) => k === group)![2][0];
const adds: Record<string, [What, string]> = { overview: ['payment', 'Add a payment'], calendar: ['payment', 'Add a payment'], transactions: ['transaction', 'Add a transaction'], reports: ['transaction', 'Add a transaction'], recurring: ['payment', 'Add a payment'], pay: ['person', 'Add a paycheck'], worth: ['account', 'Add an account'] };

/**
 * Export (F18): the plan as JSON, what's ahead as CSV, and this month or the
 * next on paper. Each says where it went beside the menu; nothing changes,
 * so a phone allowed only to look has it too.
 */
function ExportMenu({ v, exportFile, printMonth }: { v: finance.View; exportFile: FinancesProps['exportFile']; printMonth: FinancesProps['printMonth'] }) {
  const [said, setSaid] = useState('');
  const run = (go: () => Promise<string>) => async () => {
    setSaid('Saving…');
    try { setSaid(await go()); } catch (e) { setSaid(`Not saved: ${(e as Error)?.message || e}`); }
  };
  // The month here, not in UTC: toISOString would give the month before east of UTC+12 (New Zealand in summer).
  const month = (k: number) => { const d = new Date(v.today + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() + k); return isoDay(d).slice(0, 7); };
  const label = (m: string) => new Date(m + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long' });
  const print = (k: number) => run(() => printMonth(monthName(month(k)), monthPage(v, month(k), 'Finances')));
  return (
    <span class="fx-export">
      {said && <span class="muted fx-exportsaid" role="status">{said}</span>}
      <MenuButton label="Export" menuLabel="Export" title="Your plan and what's ahead, to keep, open in a spreadsheet, or print"
        items={[
          { label: 'The plan, as JSON', onClick: run(() => exportFile(planName(v.today), planJson(v.plan))) },
          { label: 'The year ahead, as a spreadsheet (CSV)', onClick: run(() => exportFile(aheadName(v.today), aheadCsv(v))) },
          { label: `${label(month(0))}, to print`, onClick: print(0) },
          { label: `${label(month(1))}, to print`, onClick: print(1) },
        ]} />
    </span>
  );
}

function FinancesScreen({ v, ledger, error, retry, tab, setTab, sel, pick, setSince, saveSettings, keep, edit: open, exportFile, printMonth, readReceipt, saveLedger, running, calendar, fromWallos, phone, toggleHidden, group, setGroup, investments }: FinancesProps) {
  // A card's payoff with each paycheck is no payment of its own: it opens the card's form.
  const edit = (what: What, id?: string, kind?: string) => (cardOf(id) ? open('account', cardOf(id)) : open(what, id, kind));
  const L = v ? lookup(v.plan) : null;
  setCurrency(v?.plan.currency);
  setOwnLogos(v?.plan.logos);
  setCategories(v?.categories);
  // An account's own page is under Net worth: its button adds an account too.
  const [what, label] = adds[tab.startsWith('account:') ? 'worth' : tab] || adds.overview;
  // Where Transactions was opened from, filtered (a report's row, a Dashboard card), for its Back; a tab picked forgets it.
  const [from, setFrom] = useState('');
  const toTx = (f: Parameters<typeof showTransactions>[0]) => { showTransactions(f); setFrom(tab); setTab('transactions'); };
  const pickTab = (t: string) => { setFrom(''); setTab(t); };
  if (groupOf(tab)[2].includes(tab)) leftOn[groupOf(tab)[0]] = tab;
  const back = from && from !== 'transactions' ? { label: tabs.find(([k]) => k === from)?.[1] || from, go: () => pickTab(from) } : undefined;
  const ro = !!v?.readOnly;
  // Every number reads from the balances typed in (the oldest of checking's
  // and the cards'), with what has happened since: a week old, they say so.
  const age = v?.typed ? daysBetween(v.typed, v.today) : -1;
  const lead = (age < 0 ? (phone ? 'Typed in by you, kept on your homelab' : 'Typed in by you, kept on this machine')
    : age === 0 ? 'Balances from today' : `Balances from ${dayShort(v.typed)}, with what's happened since` + (age >= 7 ? `: ${age} days ago${ro ? '' : ', bring them up to date with Update balances'}` : ''))
    + (ro ? ' · view only' : '');
  return (
    <>
      <div class="row header">
        <div><h1>Finances</h1><p class={'lead' + (age >= 7 ? ' warn' : '')}>{lead}</p></div>
        {/* Export on its own, before the toolbar's capsule: it wraps by itself on a narrow screen, and the capsule keeps to what fits.
            The two share a box at the header's top, level by their middles. */}
        <div class="fx-headtools">
          {v && <ExportMenu v={v} exportFile={exportFile} printMonth={printMonth} />}
          {ro && v?.plan.hideAmounts && <div class="toolbar"><span class="pill">Amounts hidden</span></div>}
          {!ro && <div class="toolbar">{toggleHidden && v && <HideAmounts hidden={!!v.plan.hideAmounts} toggle={toggleHidden} />}{!!v?.plan.accounts?.length && <button class="btn" onClick={() => edit('balances')}>Update balances</button>}<button class="btn fx-primary" onClick={() => edit(what)} disabled={!v}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{label}</button></div>}
        </div>
      </div>
      <Segmented label="View" value={groupOf(tab)[0]} pick={(g) => pickTab(pageOf(g))} options={groups.map(([k, label]) => [k, label] as [string, string])} />
      {groupOf(tab)[2].length > 1 && <div class="fx-subtabs"><Segmented label={groupOf(tab)[1]} value={tab} pick={pickTab} options={tabs.filter(([k]) => groupOf(tab)[2].includes(k))} /></div>}
      <div class="finbody">
        {!v && error ? <Empty>The finances file could not be read: {error} <button class="small" onClick={retry}>Try again</button></Empty>
          : !v ? <Empty>Reading…</Empty>
          : ro ? <View v={v} L={L} phone={phone} ledger={ledger} setTab={setTab} toTx={toTx} back={back} exportFile={exportFile} readReceipt={readReceipt} running={running} tab={tab} sel={sel} pick={pick} openWorth={() => setTab('worth')} openSubscriptions={() => { openOn('subscriptions'); setTab('recurring'); }} openRecurring={(f?: string) => { if (f) openOn(f); setTab('recurring'); }} openTransactions={() => toTx({})} showIn={toTx} openCalendar={(day?: string) => { if (day) showDay(day); setTab('calendar'); }} openPay={() => setTab('pay')} openAccount={(id: string) => setTab(`account:${id}`)} group={group} setGroup={setGroup} />
          : tab === 'calendar' ? <Calendar v={v} L={L} ledger={ledger} edit={(w, id) => edit(w, id)} />
          : tab === 'transactions' ? <Transactions v={v} L={L} ledger={ledger} edit={(w, id) => edit(w, id)} saveLedger={saveLedger} logos={!phone} back={back} />
          : tab === 'reports' ? <Reports v={v} ledger={ledger} exportFile={exportFile} open={toTx} />
          : tab === 'recurring' ? <Recurring v={v} L={L} edit={edit} keep={keep} running={running} fromWallos={fromWallos} />
          : tab === 'pay' ? <Pay v={v} L={L} edit={edit} saveSettings={saveSettings} keep={keep} calendar={calendar} />
          : tab.startsWith('account:') ? <AccountPage v={v} L={L} ledger={ledger} id={tab.slice(8)} done={() => setTab('worth')} edit={() => edit('account', tab.slice(8))} update={() => edit('balances')} toTx={toTx} editTx={(w, id) => edit(w, id)} saveLedger={saveLedger} />
          : tab === 'worth' ? <NetWorth v={v} L={L} edit={edit} open={(id) => setTab('account:' + id)} sel={Math.max(0, sel)} pick={pick} update={() => edit('balances')} keep={keep} group={group} setGroup={setGroup} invest={investments} />
          : <Overview v={v} L={L} ledger={ledger} sel={sel} pick={pick} setSince={ro ? undefined : setSince} keep={ro ? undefined : keep} add={(w, k) => edit(w, undefined, k)} edit={(w, id) => edit(w, id)} openWorth={() => setTab('worth')} openSubscriptions={() => { openOn('subscriptions'); setTab('recurring'); }} openRecurring={(f?: string) => { if (f) openOn(f); setTab('recurring'); }} openTransactions={() => toTx({})} showIn={toTx} openCalendar={(day?: string) => { if (day) showDay(day); setTab('calendar'); }} openPay={() => setTab('pay')} openAccount={(id: string) => setTab(`account:${id}`)} phone={phone} />}
      </div>
    </>
  );
}

/** A view as a phone allowed only to look draws it: the same, without a way to change anything (an export changes nothing). */
function View({ v, L, phone, ledger, setTab, toTx, back, tab, sel, pick, openWorth, openSubscriptions, openRecurring, openTransactions, showIn, openCalendar, openPay, openAccount, exportFile, readReceipt, running, group, setGroup }: { v: finance.View; L: Lookup; phone?: boolean; ledger: finance.Ledger | null; setTab: (tab: string) => void; toTx: (f: Parameters<typeof showTransactions>[0]) => void; back?: { label: string; go: () => void }; exportFile: FinancesProps['exportFile']; readReceipt: FinancesProps['readReceipt']; running?: Running[]; tab: string; sel: number; pick: (i: number) => void; openWorth: () => void; openSubscriptions: () => void; openRecurring: (filter?: string) => void; openTransactions: () => void; showIn: (f: Parameters<typeof showTransactions>[0]) => void; openCalendar: (day?: string) => void; openPay: () => void; openAccount: (id: string) => void; group?: string; setGroup?: (group: string) => void }) {
  return tab === 'calendar' ? <Calendar v={v} L={L} ledger={ledger} />
    : tab === 'transactions' ? <Transactions v={v} L={L} ledger={ledger} readReceipt={readReceipt} back={back} />
    : tab === 'reports' ? <Reports v={v} ledger={ledger} exportFile={exportFile} open={toTx} />
    : tab === 'recurring' ? <Recurring v={v} L={L} running={running} />
    : tab === 'pay' ? <Pay v={v} L={L} />
    : tab.startsWith('account:') ? <AccountPage v={v} L={L} ledger={ledger} id={tab.slice(8)} done={() => setTab('worth')} toTx={toTx} />
    : tab === 'worth' ? <NetWorth v={v} L={L} open={(id) => setTab('account:' + id)} sel={Math.max(0, sel)} pick={pick} group={group} setGroup={setGroup} />
    : <Overview v={v} L={L} ledger={ledger} sel={sel} pick={pick} openWorth={openWorth} openSubscriptions={openSubscriptions} openRecurring={openRecurring} openTransactions={openTransactions} showIn={showIn} openCalendar={openCalendar} openPay={openPay} openAccount={openAccount} phone={phone} />;
}

export function mountFinances(el: Element, props: FinancesProps) { render(<FinancesScreen {...props} />, el); }
