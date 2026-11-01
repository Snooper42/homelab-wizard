// Finances: the household's money plan as last read (who gets paid, the
// accounts, the payments that repeat, read forward from today), its
// ledger (what actually happened), the view
// and paycheck picked, and keeping what is typed in. The same screen shows
// on the phones allowed it (homelab serve), so the plan can change on
// another device between reading and saving: such a save is refused, and
// the latest is read with the form kept open over it.
import { mountFinanceSheet, type What } from '../finances/Edit';
import { mountFinances } from '../finances/Finances';
import { todayISO } from '../finances/money';
import { mountBalances } from '../finances/widgets/Worth';
import { store } from '../store';
import { type Running } from '../finances/homelab';
import { catalog } from './choose';
import { statusData } from './status';
import { $, errorText, go, showError } from '../core';

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
export function loadFinances() { statusData.fresh(5 * 60000); return Promise.all([financesData.load(), ledgerData.load()]).then(() => {}); }

// The view shown and the paycheck picked, kept between visits; until one
// is picked, the next paycheck (the first stretch when it lands today and
// is still to come).
let tab = 'overview';
let sel: number | null = null;
let opened = 0;
// The form open in the sheet, drawn again over each plan read while it is.
let editing: { what: What; id?: string; kind?: string; n: number } | null = null;
const phone = document.documentElement.classList.contains('companion');

function draw() {
  if (financesData.error) showError(financesData.error);
  const v = financesData.value || null;
  mountFinances($('finRoot'), {
    v, ledger: ledgerData.value || null, tab, sel: sel ?? (v && !v.periods[0]?.now ? 0 : 1),
    error: financesData.error ? errorText(financesData.error) : undefined,
    retry: () => { financesData.load(); },
    setTab: (t) => { tab = t; draw(); },
    pick: (i) => { sel = i; draw(); },
    edit: open,
    setWaiting,
    saveSettings: (s) => save({ ...financesData.value!.plan, currency: s.currency, holidays: s.holidays, rates: s.rates, quiet: s.quiet?.length ? s.quiet : undefined }),
    keep: save,
    exportFile,
    readReceipt: receipts.read,
    running: runningApps(),
    phone,
  });
  // A form left open keeps what is typed in; its Save then builds on this plan.
  if (editing && v && !v.readOnly) mountFinanceSheet($('finSheetBox'), { ...editing, plan: v.plan, checking: v.checking, start: v.start, categories: v.categories, ledger: ledgerData.value, save, saveLedger, receipts, close });
  // The sidebar's balances, under Finances while it shows: a group opens Net worth.
  mountBalances($('finNav'), v, () => { tab = 'worth'; draw(); });
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
  const file = new File([text], name, { type: 'text/csv' });
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

/** Marks a paycheck or payment taken as done as not happened yet (it comes today), or back. */
function setWaiting(key: string, waiting: boolean) {
  const v = financesData.value!;
  // What waits now, by its key (NotYet, the day's paychecks before, is one of them).
  const keys = new Set((v.since || []).filter((s) => s.waiting).map((s) => s.key));
  if (waiting) keys.add(key); else keys.delete(key);
  return save({ ...v.plan, waiting: [...keys], notYet: undefined });
}

function open(what: What, id?: string, kind?: string) {
  const v = financesData.value;
  if (!v || v.readOnly) return;
  editing = { what, id, kind, n: ++opened };
  mountFinanceSheet($('finSheetBox'), { ...editing, plan: v.plan, checking: v.checking, start: v.start, categories: v.categories, ledger: ledgerData.value, save, saveLedger, receipts, close });
  $('finSheet').hidden = false;
}

function close() { editing = null; $('finSheet').hidden = true; }

// The sheet is drawn, closed, once at start.
mountFinanceSheet($('finSheetBox'), null);
draw();
