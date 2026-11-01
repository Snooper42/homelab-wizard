// The FIRE estimate (financial independence): what invested money would
// let a year's spending be drawn from it, a share a year, for good; how
// far there what is invested is; and the month it gets there at what is
// put by a month and growth a year after rising prices, with two points
// either way. An estimate from two assumptions, never advice.

/** As far as it is read: a hundred years. */
const maxMonths = 1200;

/** The months until what is had, with so much put by a month and growing so much a year, reaches a target; null past a hundred years. */
export function monthsTo(have: number, monthly: number, target: number, growth: number): number | null {
  const r = Math.pow(1 + growth / 100, 1 / 12) - 1;
  let b = have;
  for (let n = 0; n <= maxMonths; n++) {
    if (b >= target) return n;
    b = b * (1 + r) + monthly;
  }
  return null;
}

export interface Fire {
  /** What is enough: a year's spending over the share drawn a year. */
  target: number;
  have: number;
  /** Months to it at the growth taken, and at two points more and less; null past a hundred years. */
  months: number | null;
  sooner: number | null;
  later: number | null;
}

/** The estimate from a year's spending, what is invested, what is put by a month, and the two assumptions (percent). */
export function fire(yearSpending: number, have: number, monthly: number, withdraw: number, growth: number): Fire {
  const target = withdraw > 0 ? yearSpending / (withdraw / 100) : Infinity;
  return { target, have, months: monthsTo(have, monthly, target, growth), sooner: monthsTo(have, monthly, target, growth + 2), later: monthsTo(have, monthly, target, growth - 2) };
}
