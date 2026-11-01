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
