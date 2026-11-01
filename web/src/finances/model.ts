// What Finances' widgets show, worked out from the plan read forward
// (finance.View): a month of pay and what it pays, spending by kind, the
// accounts by group, net worth by month, and checking day by day. Plain
// functions of the view, no drawing: a widget takes what one returns and
// hands it to the kit (finances/ui), which knows nothing of the plan.
import { allPayments, isoDay, type Lookup, owed, parseDay, perMonth, saving } from './money';

/** A month of pay, and what it pays: spent, kept (savings, an investment, retirement), and left. */
export interface Month {
  in: number;
  spent: number;
  saved: number;
  left: number;
  /** A 401(k) and the like, kept before the take-home pay. */
  viaPay: number;
  /** What is spent, by the payment's kind (home, cards, …), largest first. */
  byKind: { kind: string; amount: number }[];
}

/**
 * A month on average. A bill charged to a card is spent through the card's
 * payment (which pays it with the card's other spending); payments between
 * other accounts, and money moved into checking, are neither.
 */
export function month(v: finance.View, L: Lookup): Month {
  const people = v.plan.people || [];
  // A card paid off with each paycheck is a payment here, its spending counted once: there, not as each bill on it.
  const payments = allPayments(v.plan);
  const income = people.reduce((t, e) => t + e.net * perMonth(e.schedule), 0);
  const kept = (id?: string) => saving(L.account[id || '']?.kind);
  const onCard = (x: finance.Payment) => L.account[x.from || '']?.kind === 'card';
  const fromPay = payments.filter((x) => (!x.from || x.from === v.checking || onCard(x)) && !(x.to && x.to === v.checking));
  const each = (x: finance.Payment) => x.amount * perMonth(x.schedule, people, v.checking);
  const spentList = fromPay.filter((x) => !kept(x.to));
  const spent = spentList.reduce((t, x) => t + each(x), 0);
  const saved = fromPay.filter((x) => kept(x.to)).reduce((t, x) => t + each(x), 0);
  const viaPay = people.reduce((t, e) => t + (e.deductions || []).filter((d) => kept(d.account)).reduce((u, d) => u + d.amount, 0) * perMonth(e.schedule), 0);
  const kinds: Record<string, number> = {};
  for (const x of spentList) kinds[x.kind || 'other'] = (kinds[x.kind || 'other'] || 0) + each(x);
  const byKind = Object.entries(kinds).map(([kind, amount]) => ({ kind, amount })).filter((k) => k.amount > 0.005).sort((a, b) => b.amount - a.amount);
  return { in: income, spent, saved, left: income - spent - saved, viaPay, byKind };
}

/** A payment kind as people say it. */
export const kindName = (kind: string): string => ({ home: 'Home', utilities: 'Utilities', car: 'Car', subscriptions: 'Subscriptions', loans: 'Loans', cards: 'Cards', spending: 'Spending', savings: 'Saving', other: 'Other' })[kind] || kind;

/** How much of the plan's currency one of an account's is (its rate); 1 for the plan's own. */
export function rateOf(plan: finance.Plan, a?: finance.Account): number {
  const c = a?.currency?.toUpperCase();
  return (c && plan.rates?.[c]) || 1;
}

/**
 * The transactions with each on an account kept in another currency in
 * the plan's (parts too), so they add up: as Finances reads ahead.
 */
export function inHome(plan: finance.Plan, txs: finance.Transaction[]): finance.Transaction[] {
  if (!plan.rates || !Object.keys(plan.rates).length) return txs;
  const rate = new Map((plan.accounts || []).map((a) => [a.id, rateOf(plan, a)]));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return txs.map((t) => {
    const r = rate.get(t.account) || 1;
    return r === 1 ? t : { ...t, amount: r2(t.amount * r), splits: t.splits?.map((sp) => ({ ...sp, amount: r2(sp.amount * r) })) };
  });
}

/** Each account today (as typed in, with what has happened since), in the plan's currency: what is there, or for a card or loan what is owed. */
export const todayOf = (v: finance.View, a: finance.Account): number => v.start?.[a.id] ?? (a.kind === 'card' ? a.balance + (a.pending || 0) : a.balance) * rateOf(v.plan, a);

/** Its worth today: what is there as a plus, what is owed as a minus. */
export const worthOf = (v: finance.View, a: finance.Account): number => (owed(a.kind) ? -todayOf(v, a) : todayOf(v, a));

/** The groups accounts are shown in, in order; each keeps its colour (--cat-N). */
export const groups: { key: string; name: string; kinds: string[]; color: number }[] = [
  { key: 'cash', name: 'Cash', kinds: ['checking', 'savings'], color: 1 },
  { key: 'cards', name: 'Credit cards', kinds: ['card'], color: 8 },
  // A brokerage, a Roth or traditional IRA, and a 401(k) are all Investments.
  { key: 'investments', name: 'Investments', kinds: ['investment', 'retirement'], color: 2 },
  { key: 'property', name: 'Home & Car', kinds: ['home', 'car'], color: 4 },
  { key: 'collectibles', name: 'Collectibles', kinds: ['collectible'], color: 5 },
  { key: 'other', name: 'Other', kinds: ['other'], color: 6 },
  { key: 'loans', name: 'Loans', kinds: ['loan'], color: 7 },
];

/** Each group with accounts in it: its accounts and their worth together. */
export function grouped(v: finance.View): { key: string; name: string; color: number; accounts: finance.Account[]; total: number }[] {
  const accounts = v.plan.accounts || [];
  return groups.map((g) => {
    const list = accounts.filter((a) => g.kinds.includes(a.kind));
    return { key: g.key, name: g.name, color: g.color, accounts: list, total: list.reduce((t, a) => t + worthOf(v, a), 0) };
  }).filter((g) => g.accounts.length);
}

/** Net worth today: what is there less what is owed. */
export const netWorth = (v: finance.View): number => (v.plan.accounts || []).reduce((t, a) => t + worthOf(v, a), 0);

/** An account's balance on a day, in the plan's currency: its last kept on or before it; before its first, that one; with none kept, today's. */
function balanceOn(v: finance.View, a: finance.Account, day: string): number {
  const h = a.history || [];
  let at: number | undefined;
  for (const p of h) if (p.date <= day) at = p.amount;
  // Kept in the account's own currency: in the plan's at its rate.
  const kept = at ?? h[0]?.amount;
  return kept !== undefined ? kept * rateOf(v.plan, a) : todayOf(v, a);
}

/** An account's worth on a day (a plus, or a minus for what is owed), as balanceOn reads it. */
export const worthOn = (v: finance.View, a: finance.Account, day: string): number => (owed(a.kind) ? -balanceOn(v, a, day) : balanceOn(v, a, day));

/** The first day any balance was kept, or today. */
export const firstKept = (v: finance.View): string => (v.plan.accounts || []).flatMap((a) => (a.history || []).map((p) => p.date)).sort()[0] || v.today;

/** Net worth at a month's end, split into what is owned (by group) and what is owed. */
export interface WorthMonth {
  /** The month's last day (YYYY-MM-DD), or today for this month. */
  date: string;
  /** Read forward from the paychecks and bills, not typed in. */
  ahead: boolean;
  /** What is owned, by group key (cash, investments, property, other). */
  owned: Record<string, number>;
  owes: number;
  /** Of what is owed, the loans against a home or car (the account's loan): its equity is its worth less them. */
  secured: number;
  net: number;
}

/**
 * Net worth month by month: from the first balance kept to today, then the
 * months ahead as the paychecks and bills leave the accounts (the last
 * paycheck stretch ending in each month).
 */
export function worthByMonth(v: finance.View, back = 3, ahead = 3): WorthMonth[] {
  const accounts = v.plan.accounts || [];
  const groupOf = (kind: string) => groups.find((g) => g.kinds.includes(kind))?.key || 'other';
  const against = new Set(accounts.filter((a) => groupOf(a.kind) === 'property' && a.loan).map((a) => a.loan));
  const split = (value: (a: finance.Account) => number) => {
    const owned: Record<string, number> = {};
    let owes = 0, secured = 0;
    for (const a of accounts) {
      const n = value(a);
      if (owed(a.kind)) { owes += n; if (against.has(a.id)) secured += n; }
      else owned[groupOf(a.kind)] = (owned[groupOf(a.kind)] || 0) + n;
    }
    const net = Object.values(owned).reduce((t, n) => t + n, 0) - owes;
    return { owned, owes, secured, net };
  };
  const out: WorthMonth[] = [];
  const today = parseDay(v.today);
  for (let i = back; i >= 1; i--) {
    const end = isoDay(new Date(today.getFullYear(), today.getMonth() - i + 1, 0));
    out.push({ date: end, ahead: false, ...split((a) => balanceOn(v, a, end)) });
  }
  out.push({ date: v.today, ahead: false, ...split((a) => todayOf(v, a)) });
  for (let i = 1; i <= ahead; i++) {
    const end = isoDay(new Date(today.getFullYear(), today.getMonth() + i + 1, 0));
    // Only as far as the paychecks read ahead reach: past them a month would repeat the last one's balances.
    if (!v.periods.some((q) => q.last >= end)) break;
    const p = [...v.periods].reverse().find((q) => q.last <= end && q.accounts);
    if (!p) break;
    out.push({ date: end, ahead: true, ...split((a) => p.accounts[a.id] ?? todayOf(v, a)) });
  }
  return out;
}

/** Checking at the end of each day for the next n days, with what happened on each. */
export const checkingDays = (v: finance.View, n = 31): finance.Day[] => (v.days || []).slice(0, n);

/** Left after a paycheck's bills (what it brings in less what it pays), for each paycheck ahead. */
export const surplus = (p: finance.Period): number => p.in - p.out;

/** How fast a car loses value, by how it holds it: its first year's share, then each year's (internal/finance's carClasses). */
const carClasses: Record<string, [number, number]> = { '': [0.2, 0.12], holds: [0.12, 0.08], fast: [0.25, 0.16] };

/** A car's share of its price, years after it was bought: never below a tenth (internal/finance's carFactor). */
export function carFactor(holds: string | undefined, years: number): number {
  const [first, later] = carClasses[holds || ''] || carClasses[''];
  const f = years <= 0 ? 1 : years < 1 ? 1 - first * years : (1 - first) * Math.pow(1 - later, years - 1);
  return Math.max(f, 0.1);
}

/** What a car is worth on a day from its price alone; undefined with no purchase. */
export function carFromPrice(a: Pick<finance.Account, 'bought' | 'boughtOn' | 'holds'>, day: string): number | undefined {
  if (!a.bought || !a.boughtOn || !/^\d{4}-\d{2}-\d{2}$/.test(a.boughtOn)) return undefined;
  const years = (parseDay(day).getTime() - parseDay(a.boughtOn).getTime()) / 864e5 / 365.25;
  return Math.round(a.bought * carFactor(a.holds, years) * 100) / 100;
}
