// Finances: the household's money plan as last read (who gets paid, the
// accounts, the payments that repeat, read forward from today), the view
// and paycheck picked, and keeping what is typed in.
import { mountFinanceSheet, type What } from '../finances/Edit';
import { mountFinances } from '../finances/Finances';
import { todayISO } from '../finances/money';
import { store } from '../store';
import { $, errorText, go, showError } from '../core';

export const financesData = store(() => go().Finances());
financesData.watch(draw);
export function loadFinances() { return financesData.load(); }

// The view shown and the paycheck picked, kept between visits; until one
// is picked, the next paycheck (the first stretch when it lands today and
// is still to come).
let tab = 'overview';
let sel: number | null = null;
let opened = 0;

function draw() {
  if (financesData.error) showError(financesData.error);
  const v = financesData.value || null;
  mountFinances($('finRoot'), {
    v, tab, sel: sel ?? (v && !v.periods[0]?.now ? 0 : 1),
    error: financesData.error ? errorText(financesData.error) : undefined,
    retry: () => { financesData.load(); },
    setTab: (t) => { tab = t; draw(); },
    pick: (i) => { sel = i; draw(); },
    saveBalances, edit: open,
    setWaiting,
    saveSettings: (s) => save({ ...financesData.value!.plan, currency: s.currency, holidays: s.holidays }),
  });
  // The sidebar counts the paychecks that leave checking under the cushion.
  const low = v ? v.periods.filter((p) => p.left < (v.plan.cushion || 0)).length : 0;
  $('financesCount').textContent = low ? String(low) : '';
}

/** Keeps the plan and draws what it reads forward; false when it failed. */
async function save(plan: finance.Plan): Promise<boolean> {
  try {
    financesData.set(await go().SaveFinances(plan));
    return true;
  } catch (e) {
    showError(e);
    return false;
  }
}

/** Keeps the balances typed in: each is today's, changed or not (Save says they are right). */
async function saveBalances(balances: Record<string, { balance: number; pending: number }>, cushion: number) {
  const plan = structuredClone(financesData.value!.plan);
  const today = todayISO();
  for (const a of plan.accounts || []) {
    const b = balances[a.id];
    if (!b) continue;
    a.balance = b.balance;
    if (a.kind === 'card') a.pending = b.pending;
    a.updated = today;
  }
  plan.cushion = cushion;
  plan.updated = today;
  return save(plan);
}

/** Marks a paycheck or payment taken as done as not happened yet (it comes today), or back. */
function setWaiting(key: string, waiting: boolean) {
  const v = financesData.value!;
  // What waits now, by its key (NotYet, the day's paychecks before, is one of them).
  const keys = new Set((v.since || []).filter((s) => s.waiting).map((s) => s.key));
  if (waiting) keys.add(key); else keys.delete(key);
  return save({ ...v.plan, waiting: [...keys], notYet: undefined });
}

function open(what: What, id?: string) {
  const v = financesData.value;
  if (!v) return;
  mountFinanceSheet($('finSheetBox'), { what, id, n: ++opened, plan: v.plan, checking: v.checking, save, close });
  $('finSheet').hidden = false;
}

function close() { $('finSheet').hidden = true; }

// The sheet is drawn, closed, once at start.
mountFinanceSheet($('finSheetBox'), null);
draw();
