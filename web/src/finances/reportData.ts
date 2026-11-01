// What Reports reads from the ledger: plain functions of the transactions
// and the categories, no drawing. Spending is money out less refunds, a
// split by its parts; money in is what came in outside the household's
// own accounts; a transfer between them is neither.
import { isoDay, monthName, parseDay } from './money';

export interface Range { key: string; label: string; from: string; to: string }

/** The ranges Reports offers, from today. */
export function ranges(today: string, first: string): Range[] {
  const d = parseDay(today);
  const month = (n: number) => isoDay(new Date(d.getFullYear(), d.getMonth() + n, 1));
  const end = (n: number) => isoDay(new Date(d.getFullYear(), d.getMonth() + n + 1, 0));
  return [
    { key: 'month', label: 'This month', from: month(0), to: end(0) },
    { key: 'last', label: 'Last month', from: month(-1), to: end(-1) },
    { key: 'three', label: '3 months', from: month(-2), to: end(0) },
    { key: 'year', label: 'This year', from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` },
    { key: 'all', label: 'All', from: first < month(0) ? first : month(0), to: end(0) },
  ];
}

const inRange = (t: finance.Transaction, r: Range) => t.date >= r.from && t.date <= r.to;

/** Each part a transaction spends in a category: money out a plus, a refund a minus; money in to an income category, nothing. */
function parts(t: finance.Transaction, income: Set<string>): { category: string; amount: number }[] {
  if (t.to) return [];
  const list = t.splits?.length ? t.splits.map((s) => ({ category: s.category, amount: s.amount })) : [{ category: t.category || 'No category', amount: t.amount }];
  return list.filter((p) => !(p.amount > 0 && income.has(p.category.toLowerCase()))).map((p) => ({ category: p.category, amount: -p.amount }));
}

/** The income categories (and their groups' own), by name in lower case. */
function incomeOf(cats: finance.Category[]): Set<string> {
  const top = new Set(cats.filter((c) => c.income && !c.parent).map((c) => c.name.toLowerCase()));
  return new Set(cats.filter((c) => c.income || top.has((c.parent || '').toLowerCase())).map((c) => c.name.toLowerCase()));
}

export interface Group { name: string; amount: number; children: { name: string; amount: number }[] }

/** Spending in a range by group, each with its own categories under it, largest first; nothing spent, left out. */
export function byCategory(txs: finance.Transaction[], cats: finance.Category[], r: Range): Group[] {
  const income = incomeOf(cats);
  const parent = new Map(cats.map((c) => [c.name.toLowerCase(), c.parent || '']));
  const name = new Map(cats.map((c) => [c.name.toLowerCase(), c.name]));
  const groups = new Map<string, Group>();
  for (const t of txs) {
    if (!inRange(t, r)) continue;
    for (const p of parts(t, income)) {
      const key = p.category.toLowerCase();
      const g = parent.get(key) || name.get(key) || p.category;
      const top = groups.get(g) || { name: g, amount: 0, children: [] };
      top.amount += p.amount;
      if (parent.get(key)) {
        const child = top.children.find((c) => c.name.toLowerCase() === key) || (top.children.push({ name: name.get(key) || p.category, amount: 0 }), top.children.at(-1)!);
        child.amount += p.amount;
      }
      groups.set(g, top);
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...groups.values()].map((g) => ({ ...g, amount: round(g.amount), children: g.children.map((c) => ({ ...c, amount: round(c.amount) })).filter((c) => Math.abs(c.amount) >= 0.005).sort((a, b) => b.amount - a.amount) }))
    .filter((g) => g.amount >= 0.005).sort((a, b) => b.amount - a.amount);
}

export interface Month { month: string; label: string; in: number; out: number }

/** Money in and out each month of a range, outside transfers. */
export function byMonth(txs: finance.Transaction[], r: Range): Month[] {
  const out: Month[] = [];
  for (let d = parseDay(r.from.slice(0, 7) + '-01'); isoDay(d) <= r.to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const m = isoDay(d).slice(0, 7);
    const list = txs.filter((t) => !t.to && t.date.startsWith(m));
    out.push({ month: m, label: monthName(m + '-01').slice(0, 3), in: list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0), out: -list.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0) });
  }
  return out;
}

export interface Payee { payee: string; amount: number; count: number }

/** Where the money went, by payee, in a range: largest first, the first n. */
export function topPayees(txs: finance.Transaction[], r: Range, n = 5): Payee[] {
  const by = new Map<string, Payee>();
  for (const t of txs) {
    if (t.to || t.amount >= 0 || !inRange(t, r) || !t.payee) continue;
    const key = t.payee.toLowerCase();
    const p = by.get(key) || { payee: t.payee, amount: 0, count: 0 };
    p.amount -= t.amount;
    p.count++;
    by.set(key, p);
  }
  return [...by.values()].sort((a, b) => b.amount - a.amount).slice(0, n);
}

/** Money in and out in a range, outside transfers. */
export function totals(txs: finance.Transaction[], r: Range): { in: number; out: number } {
  const list = txs.filter((t) => !t.to && inRange(t, r));
  return { in: list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0), out: -list.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0) };
}
