// Paying debts off faster, worked out on the device: what an extra amount
// a month does to one loan, and two ways to pay several down with the same
// money: the highest rate first (avalanche), or the smallest balance first
// (snowball). Each month every debt accrues its interest and gets its own
// payment; what is left of the money (the extra, and the payments of
// debts already paid off) goes to the one first in line. Plain functions,
// the same reading as internal/finance's amortize.

/** A debt read to zero: what it owes, its yearly rate (percent), and its payment a month. */
export interface Debt { id: string; balance: number; rate: number; monthly: number }

/** As far as a payoff is read: fifty years. */
const maxMonths = 600;

/** One debt to zero: the months it takes and the interest on the way; ok false when the payment never gets there. */
export function amortize(balance: number, rate: number, monthly: number): { months: number; interest: number; ok: boolean } {
  const r = rate / 100 / 12;
  let b = balance, months = 0, interest = 0;
  while (b > 0.005) {
    if (months >= maxMonths || monthly <= b * r + 0.005) return { months, interest, ok: false };
    const i = b * r;
    interest += i;
    b = Math.max(0, b + i - monthly);
    months++;
  }
  return { months, interest: Math.round(interest * 100) / 100, ok: true };
}

export interface Strategy {
  /** Months until every debt is paid off. */
  months: number;
  interest: number;
  /** Each debt and the month (from now) it is paid off, in that order. */
  order: { id: string; month: number }[];
  ok: boolean;
}

/**
 * Several debts paid down with their own payments and an extra amount a
 * month, the money left each month going to the debt first in line:
 * avalanche, the highest rate (then the smaller balance); snowball, the
 * smallest balance (then the higher rate).
 */
export function payDown(debts: Debt[], extra: number, way: 'avalanche' | 'snowball'): Strategy {
  const live = debts.filter((d) => d.balance > 0.005).map((d) => ({ ...d, b: d.balance }));
  const budget = live.reduce((t, d) => t + d.monthly, 0) + Math.max(0, extra);
  const order: Strategy['order'] = [];
  let interest = 0, month = 0;
  while (live.some((d) => d.b > 0.005)) {
    const owing = live.filter((d) => d.b > 0.005);
    const due = owing.reduce((t, d) => t + (d.b * d.rate) / 1200, 0);
    if (month >= maxMonths || budget <= due + 0.005) return { months: month, interest, order, ok: false };
    month++;
    for (const d of owing) { const i = (d.b * d.rate) / 1200; interest += i; d.b += i; }
    // Each its own payment first, then what is left down the line.
    let left = budget;
    for (const d of owing) { const pay = Math.min(d.b, d.monthly); d.b -= pay; left -= pay; }
    const line = owing.filter((d) => d.b > 0.005).sort(way === 'avalanche' ? (x, y) => y.rate - x.rate || x.b - y.b : (x, y) => x.b - y.b || y.rate - x.rate);
    for (const d of line) { if (left <= 0) break; const pay = Math.min(d.b, left); d.b -= pay; left -= pay; }
    for (const d of owing) if (d.b <= 0.005) { d.b = 0; order.push({ id: d.id, month }); }
  }
  return { months: month, interest: Math.round(interest * 100) / 100, order, ok: true };
}

// A loan read from its papers, the same reading as internal/finance's
// loanpapers.go: the account form shows what it will owe as the papers
// are typed in. The engine's reading is the one Finances keeps.

/** A loan's k-th payment day after its first (0 is the first): the same day of the month, or the month's last. */
export function dueOn(first: string, k: number): string {
  const y = +first.slice(0, 4), m = +first.slice(5, 7) - 1 + k, d = +first.slice(8, 10);
  const last = new Date(y, m + 1, 0).getDate(), at = new Date(y, m, Math.min(d, last));
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

const c = (x: number) => Math.round(x * 100) / 100;

/** Each payment from the first to the last, odd more interest on the first; null when the payment never keeps up. */
export function installments(first: string, original: number, rate: number, monthly: number, odd = 0): finance.Installment[] | null {
  const r = rate / 1200;
  let b = c(original);
  const out: finance.Installment[] = [];
  for (let k = 0; b > 0.005; k++) {
    if (k >= maxMonths) return null;
    const interest = c(c(b * r) + (k === 0 ? odd : 0));
    let payment = Math.min(monthly, c(b + interest));
    if (payment <= interest) return null;
    b = c(b + interest - payment);
    if (b > 0 && b < 0.05) { payment = c(payment + b); b = 0; }
    out.push({ date: dueOn(first, k), payment, principal: c(payment - interest), interest, after: b });
  }
  return out;
}

const interestOf = (rows: finance.Installment[]) => c(rows.reduce((t, x) => t + x.interest, 0));

/** The first payment's interest for the days before it, from the finance charge the papers state. */
export function oddDays(first: string, original: number, rate: number, monthly: number, charge: number): number {
  const of = (odd: number) => { const rows = installments(first, original, rate, monthly, odd); return rows ? interestOf(rows) : Infinity; };
  if (rate <= 0 || charge <= of(0) + 0.005) return 0;
  let lo = 0, hi = Math.max(0, Math.min(charge, monthly - (original * rate) / 1200 - 0.01));
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (of(mid) < charge) lo = mid; else hi = mid; }
  const a = Math.floor(lo * 100) / 100, b = Math.ceil(hi * 100) / 100;
  return Math.abs(of(a) - charge) <= Math.abs(of(b) - charge) ? a : b;
}

/** A loan from its papers on a day: each payment, how many fell due before it, and what it owes; null when it cannot be read. */
export function papers(a: { original?: number; rate?: number; firstDue?: string; term?: number; charge?: number }, monthly: number, today: string): { rows: finance.Installment[]; made: number; owed: number } | null {
  if (!(a.original! > 0) || !/^\d{4}-\d\d-\d\d$/.test(a.firstDue || '') || !(monthly > 0)) return null;
  const odd = a.term && a.charge ? oddDays(a.firstDue!, a.original!, a.rate || 0, monthly, a.charge) : 0;
  const rows = installments(a.firstDue!, a.original!, a.rate || 0, monthly, odd);
  if (!rows) return null;
  let made = 0;
  while (made < rows.length && rows[made].date < today) made++;
  return { rows, made, owed: made ? rows[made - 1].after : c(a.original!) };
}
