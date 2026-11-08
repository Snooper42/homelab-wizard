// Finances: the household's money plan as last read (who gets paid, the
// accounts, the payments that repeat, read forward from today), its
// ledger (what actually happened), the view
// and paycheck picked, and keeping what is typed in. The same screen shows
// on the phones allowed it (homelab serve), so the plan can change on
// another device between reading and saving: such a save is refused, and
// the latest is read with the form kept open over it.
import { mountFinanceSheet, type What } from '../finances/Edit';
import { mountFinances } from '../finances/Finances';
import { isoDay, setHidden, todayISO } from '../finances/money';
import { mountBalances } from '../finances/widgets/Worth';
import type { SinceState } from '../finances/widgets/Ledger';
import type { InvestState } from '../finances/widgets/Investments';
import { store } from '../store';
import { type Running } from '../finances/homelab';
import { catalog } from './choose';
import { statusData } from './status';
import { $, errorText, go, showError } from '../core';
import { navigate } from '../app';

export const financesData = store(() => go().Finances());
financesData.watch(draw);
// What actually happened, beside the plan: read with it, kept as it is.
export const ledgerData = store(() => go().FinancesLedger());
ledgerData.watch(draw);
// Which apps run (Status), for the payments the homelab does the job of: drawn again as it comes.
statusData.watch(() => { if (financesData.value) draw(); });

/** The apps running here, each with the paid services it stands in for (the catalog's, from docs/Savings.md). */
function runningApps(): Running[] {
  const up = new Set((statusData.value?.apps || []).filter((a) => a.state === 'running').map((a) => a.id));
  return (catalog?.apps || []).filter((a) => up.has(a.id) && a.replaces?.length).map((a) => ({ name: a.name, replaces: a.replaces! }));
}
/** Whether an app runs here (Status): Recurring's From Wallos, and Update balances' apps, show only then. */
const runs = (id: string) => (statusData.value?.apps || []).some((a) => a.id === id && a.state === 'running');
const wallosRunning = () => runs('wallos');
/** The apps Update balances reads from on a click: on the computer, those running. */
function fromApps() {
  if (phone) return undefined;
  const all = [
    { id: 'firefly-iii', name: 'Firefly III', read: () => go().FinancesFromFirefly() },
    { id: 'ghostfolio', name: 'Ghostfolio', read: () => go().FinancesFromGhostfolio() },
  ];
  return all.filter((a) => runs(a.id)).map(({ name, read }) => ({ name, read }));
}
// Net worth › Investments, read from Ghostfolio: on Read now (the computer,
// or a phone allowed to change Finances), and after the first, once a day
// as Finances opens on the computer while Status sees Ghostfolio running
// (unless turned off), when the last read is from before today or 12 hours old.
let invest: InvestState = {};
let autoTried = '';
async function readInvestments() {
  invest = { busy: true };
  draw();
  try {
    const r = await go().FinancesReadInvestments();
    const held = (r.view.plan.accounts || []).filter((a) => a.holdings?.length);
    const count = held.reduce((t, a) => t + a.holdings!.length, 0);
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    // Signed in is said even with nothing in Ghostfolio yet, so the token is known to work.
    const said = !r.accounts ? `Signed in to Ghostfolio at ${time}: it has no accounts yet. Add yours there, named as they are here, then Read now.`
      : !r.holdings ? `Signed in to Ghostfolio at ${time}: its ${n(r.accounts, 'account holds', 'accounts hold')} nothing yet. Add a buy for each holding there, then Read now.`
      : `Read from Ghostfolio at ${time}: ${n(count, 'holding', 'holdings')} in ${n(held.length, 'account', 'accounts')}.`;
    invest = { said, unmatched: r.unmatched };
    financesData.set(r.view);
  } catch (e) {
    invest = { problem: `Could not read Ghostfolio: ${errorText(e)}` };
  }
  draw();
}
/** A buy or a sale typed on the card: into Ghostfolio, then read back. Throws why not, for the form to say. */
async function addInvestment(x: app.InvestmentAdd) {
  const r = await go().FinancesAddInvestment(x);
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  invest = { said: `Added to Ghostfolio: ${x.sold ? 'sold' : 'bought'} ${x.shares} ${x.symbol}${x.newName ? `, in ${x.newName}` : ''}. Read again at ${time}.`, unmatched: r.unmatched };
  financesData.set(r.view);
}
function readEachMorning(v: finance.View) {
  const at = new Date(v.plan.holdingsRead || '');
  if (phone || v.readOnly || v.plan.readByHand || isNaN(at.getTime()) || autoTried === v.today || invest.busy) return;
  if (!$('finances').classList.contains('active') || !runs('ghostfolio')) return;
  if (isoDay(at) >= v.today && Date.now() - at.getTime() < 12 * 3600000) return;
  autoTried = v.today;
  readInvestments();
}
export function loadFinances() { statusData.fresh(5 * 60000); return Promise.all([financesData.load(), ledgerData.load()]).then(() => {}); }

// The view shown and the paycheck picked, kept between visits; until one
// is picked, the next paycheck (the first stretch when it lands today and
// is still to come).
let tab = 'overview';
// The group of accounts Net worth opens on (a sidebar balance), "" for all of them.
let group = '';
let sel: number | null = null;
let opened = 0;
// The form open in the sheet, drawn again over each plan read while it is.
let editing: { what: What; id?: string; kind?: string; n: number } | null = null;
const phone = document.documentElement.classList.contains('companion');

function draw() {
  // The plan is read for the sidebar on every screen: a failure is said on Finances only.
  if (financesData.error && $('finances').classList.contains('active')) showError(financesData.error);
  const v = financesData.value || null;
  // Hide amounts, as the plan keeps it: every device that shows it follows.
  setHidden(!!v?.plan.hideAmounts);
  mountFinances($('finRoot'), {
    v, ledger: ledgerData.value || null, tab, sel: sel ?? (v && !v.periods[0]?.now ? 0 : 1),
    error: financesData.error ? errorText(financesData.error) : undefined,
    retry: () => { financesData.load(); },
    setTab: (t) => { tab = t; group = ''; draw(); },
    group,
    setGroup: (g) => { group = g; draw(); },
    pick: (i) => { sel = i; draw(); },
    edit: open,
    setSince,
    saveSettings: (s) => save({ ...financesData.value!.plan, currency: s.currency, holidays: s.holidays, rates: s.rates, quiet: s.quiet?.length ? s.quiet : undefined, calendarKey: s.calendarKey, calendarAmounts: s.calendarKey ? s.calendarAmounts || undefined : undefined }),
    keep: save,
    exportFile,
    // A month's page: opened in the browser to print (it prints itself); on a phone, shared or downloaded.
    printMonth: async (name, html) => (phone ? exportFile(name, html) : `Opened ${await go().PrintFinances(name, html)} to print`),
    toggleHidden: v && !v.readOnly ? toggleHideAmounts : undefined,
    readReceipt: receipts.read,
    saveLedger,
    running: runningApps(),
    calendar: phone ? undefined : () => go().FinancesCalendar(),
    // Wallos's subscriptions, on the computer while Wallos runs.
    fromWallos: phone || !wallosRunning() ? undefined : () => go().FinancesFromWallos(),
    phone,
    // Read now and Add a holding wherever Finances may be changed (the computer, a phone allowed to change it): never hidden
    // behind Status, which may not see the Ghostfolio that answers; when it does not answer, the card says so.
    investments: !v || v.readOnly ? undefined : { read: readInvestments, state: invest, add: addInvestment, find: (q: string) => go().FinancesFindSymbol(q) },
  });
  if (v) readEachMorning(v);
  // A form left open keeps what is typed in; its Save then builds on this plan.
  if (editing && v && !v.readOnly) mountFinanceSheet($('finSheetBox'), { ...editing, plan: v.plan, checking: v.checking, start: v.start, dues: v.dues, categories: v.categories, ledger: ledgerData.value, save, saveLedger, receipts, fromApps: fromApps(), close });
  // The sidebar's balances, on every screen: a group opens Finances › Net worth.
  mountBalances($('finNav'), v, (g) => { tab = 'worth'; group = g; navigate('finances'); draw(); $('finRoot').querySelector('.fx-groupcard')?.scrollIntoView({ block: 'start' }); }, v && !v.readOnly ? toggleHideAmounts : undefined);
  // The sidebar counts the paychecks that leave checking under the cushion.
  const low = v ? v.periods.filter((p) => p.left < (v.plan.cushion || 0)).length : 0;
  $('financesCount').textContent = low ? String(low) : '';
}

/**
 * Saves an export and says where it went, "" when cancelled: on the
 * computer where the dialog says; on a phone, shared (Files, Mail) or
 * else downloaded.
 */
async function exportFile(name: string, text: string): Promise<string> {
  if (!phone) { const file = await go().ExportFinances(name, text); return file ? `Saved to ${file}` : ''; }
  const type = name.endsWith('.json') ? 'application/json' : name.endsWith('.html') ? 'text/html' : 'text/csv';
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); } catch (e) { if ((e as Error)?.name === 'AbortError') return ''; throw e; }
    return `Shared ${name}`;
  }
  // The page's hidden link for a file to save (the phone's report uses it too).
  const a = $('reportDownload') as HTMLAnchorElement;
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return `Downloaded ${name}`;
}

/**
 * Keeps the plan and draws what it reads forward; false when it failed.
 * After a failure the plan is read again: when another device saved in
 * between, what is shown (and an open form) then builds on its change.
 */
async function save(plan: finance.Plan): Promise<boolean> {
  try {
    financesData.set(await go().SaveFinances(plan));
    return true;
  } catch (e) {
    showError(e);
    financesData.load();
    return false;
  }
}

/** Keeps the ledger; as with the plan, after a failure it is read again, the form kept open over it. */
/** Receipts, kept on the homelab as soon as one is picked; a transaction names its own. */
const receipts = { save: (dataURL: string) => go().SaveFinancesReceipt(dataURL), read: (name: string) => go().FinancesReceipt(name) };

async function saveLedger(l: finance.Ledger): Promise<boolean> {
  try {
    ledgerData.set(await go().SaveFinancesLedger(l));
    // What happened moves the balances and pays planned payments: the plan is read forward again.
    financesData.load();
    return true;
  } catch (e) {
    showError(e);
    ledgerData.load();
    return false;
  }
}

/**
 * Says what became of a paycheck or payment taken as done: counted (it
 * happened, or a bill on the day balances were typed comes out), waiting
 * (not yet: it comes today), or a bill on that day the balance has already.
 */
function setSince(key: string, state: SinceState) {
  const v = financesData.value!;
  // What waits now, by its key (NotYet, the day's paychecks before, is one of them), and what the balances have.
  const waiting = new Set((v.since || []).filter((s) => s.waiting).map((s) => s.key));
  const held = new Set((v.since || []).filter((s) => s.inBalance).map((s) => s.key));
  waiting.delete(key);
  held.delete(key);
  if (state === 'waiting') waiting.add(key);
  if (state === 'inBalance') held.add(key);
  return save({ ...v.plan, waiting: [...waiting], inBalance: held.size ? [...held] : undefined, notYet: undefined });
}

// The menu's item and the window's own shortcut can both see one ⌘⇧H: a
// second toggle this soon after the first is the same press.
let toggled = 0;
/**
 * Hides every amount, or shows them again (⌘⇧H, Ctrl+Shift+H, View ›
 * Hide Amounts, or the eye): at once here, then kept in the plan for the
 * other devices. A phone allowed only to look follows the plan.
 */
export function toggleHideAmounts() {
  const v = financesData.value;
  if (!v || v.readOnly || Date.now() - toggled < 400) return;
  toggled = Date.now();
  const plan = { ...v.plan, hideAmounts: !v.plan.hideAmounts || undefined };
  financesData.set({ ...v, plan });
  save(plan);
}

/** Opens a Finances form (Add a transaction, Update balances), as the screen's own buttons do; nothing on a phone that may only look. */
export function openFinanceForm(what: What, id?: string, kind?: string) { open(what, id, kind); }

function open(what: What, id?: string, kind?: string) {
  const v = financesData.value;
  if (!v || v.readOnly) return;
  editing = { what, id, kind, n: ++opened };
  mountFinanceSheet($('finSheetBox'), { ...editing, plan: v.plan, checking: v.checking, start: v.start, dues: v.dues, categories: v.categories, ledger: ledgerData.value, save, saveLedger, receipts, fromApps: fromApps(), close });
  $('finSheet').hidden = false;
}

function close() { editing = null; $('finSheet').hidden = true; }

// The sheet is drawn, closed, once at start.
mountFinanceSheet($('finSheetBox'), null);
draw();
