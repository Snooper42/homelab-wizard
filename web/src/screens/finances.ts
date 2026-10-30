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

// The view shown and the paycheck picked (the next one), kept between visits.
let tab = 'overview';
let sel = 1;
let opened = 0;

function draw() {
  if (financesData.error) showError(financesData.error);
  const v = financesData.value || null;
  mountFinances($('finRoot'), {
    v, tab, sel,
    error: financesData.error ? errorText(financesData.error) : undefined,
    retry: () => { financesData.load(); },
    setTab: (t) => { tab = t; draw(); },
    pick: (i) => { sel = i; draw(); },
    saveBalances, edit: open,
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

async function saveBalances(balances: Record<string, { balance: number; pending: number }>, cushion: number) {
  const plan = structuredClone(financesData.value!.plan);
  const today = todayISO();
  for (const a of plan.accounts || []) {
    const b = balances[a.id];
    if (!b || (b.balance === a.balance && b.pending === (a.pending || 0))) continue;
    a.balance = b.balance;
    if (a.kind === 'card') a.pending = b.pending;
    a.updated = today;
  }
  plan.cushion = cushion;
  plan.updated = today;
  return save(plan);
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
