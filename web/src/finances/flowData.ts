// Money flow, as numbers: where a month's money came from, through all of
// it together, to taxes, spending and saving, and on to each kind of
// spending and each account it was saved in. A real month reads the
// ledger; a typical month reads the plan. Each piece keeps what is behind
// it (transactions, or planned payments and pay) so the chart can open it.
// Plain functions of the view and ledger; the chart (ui/charts Sankey)
// knows nothing of them.
import type { Hue } from './ui/Legend';
import { inHome, kindName } from './model';
import { allPayments, type Lookup, perMonth, saving } from './money';

/** What is behind a piece of the flow: a transaction, a planned payment, or a paycheck. */
export interface FlowItem { label: string; amount: number; date?: string; tx?: string; payment?: string; person?: string; note?: string }

/** One box of the flow: its column (0 where it comes from, 1 all of it, 2 taxes, spending, saved, 3 each kind of spending and where it was saved). */
export interface FlowNode { id: string; label: string; value: number; col: 0 | 1 | 2 | 3; hue: Hue; items: FlowItem[] }

export interface FlowLink { from: string; to: string; value: number }

export interface Flow {
  nodes: FlowNode[];
  links: FlowLink[];
  income: number;
  taxes: number;
  expenses: number;
  /** What is left of the income: put in savings, or kept as cash; less than nothing when the month took more. */
  saved: number;
}

/** Saved, and each account it went into: blue, apart from taxes' purple. */
export const savedHue: Hue = 1;

/** Each kind of spending keeps one colour, on the donut, the flow, and in its legend. */
export const kindHue: Record<string, number> = { home: 8, cards: 7, spending: 2, car: 1, utilities: 3, subscriptions: 5, loans: 4, other: 6 };

/** A category's colour: each top category of the household's in turn, the same everywhere it is drawn. */
export function categoryHue(categories: finance.Category[], name: string): number {
  const tops = categories.filter((c) => !c.parent && !c.income);
  const at = tops.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
  return at < 0 ? 6 : (at % 8) + 1;
}

/** A transaction's parts: its splits, or itself whole. */
const parts = (t: finance.Transaction) => (t.splits?.length ? t.splits.map((s) => ({ category: s.category, amount: s.amount })) : [{ category: t.category || '', amount: t.amount }]);

/** Taxes: a category, or its group, named for them. */
const taxing = (name: string) => /\btax(es)?\b/i.test(name);

/** Keeps the largest top of a column's nodes, the rest as one Other. */
function topOf(nodes: FlowNode[], top: number, id: string, hue: Hue): FlowNode[] {
  const sorted = [...nodes].sort((a, b) => b.value - a.value);
  if (top <= 0 || sorted.length <= top) return sorted;
  const kept = sorted.slice(0, top - 1), rest = sorted.slice(top - 1);
  return [...kept, { id, label: `Other (${rest.length})`, value: rest.reduce((t, n) => t + n.value, 0), col: rest[0].col, hue, items: rest.flatMap((n) => n.items) }];
}

/** The flow from its pieces: sources into all of it, it out to taxes, spending and saved, those on to their own. */
function build(sources: FlowNode[], taxes: FlowNode | null, spend: FlowNode[], kept: FlowNode[], top: number): Flow {
  const sum = (ns: FlowNode[]) => ns.reduce((t, n) => t + n.value, 0);
  const income = sum(sources), tax = taxes?.value || 0, expenses = sum(spend);
  const saved = income - tax - expenses;
  const into = kept.filter((n) => n.value > 0.005);
  const moved = sum(into);
  // What went into savings accounts went, saved or not: more out than in, the rest came out of what the accounts held.
  const short = tax + expenses + moved - income;
  const nodes: FlowNode[] = [], links: FlowLink[] = [];
  const srcs = topOf(sources.filter((n) => n.value > 0.005), top, 'src:other', 4);
  if (short > 0.005) srcs.push({ id: 'src:accounts', label: 'From your accounts', value: short, col: 0, hue: 'muted', items: [] });
  const total = sum(srcs);
  nodes.push(...srcs, { id: 'total', label: 'Total income', value: total, col: 1, hue: 'in', items: sources.flatMap((n) => n.items) });
  for (const s of srcs) links.push({ from: s.id, to: 'total', value: s.value });
  if (taxes && tax > 0.005) { nodes.push(taxes); links.push({ from: 'total', to: taxes.id, value: tax }); }
  const kinds = topOf(spend.filter((n) => n.value > 0.005), top, 'cat:other', 6);
  if (expenses > 0.005) {
    nodes.push({ id: 'expenses', label: 'Expenses', value: expenses, col: 2, hue: 'out', items: kinds.flatMap((n) => n.items) });
    links.push({ from: 'total', to: 'expenses', value: expenses });
    for (const k of kinds) { nodes.push(k); links.push({ from: 'expenses', to: k.id, value: k.value }); }
  }
  // Saved: each account it went into, and the rest, which stayed where it came in.
  const stays = saved - moved;
  const outs = [...into, ...(stays > 0.005 ? [{ id: 'kept:cash', label: 'Kept as cash', value: stays, col: 3 as const, hue: 'muted' as Hue, items: [] }] : [])];
  const savings = sum(outs);
  if (savings > 0.005) {
    nodes.push({ id: 'saved', label: 'Savings', value: savings, col: 2, hue: savedHue, items: outs.flatMap((n) => n.items) });
    links.push({ from: 'total', to: 'saved', value: savings });
    for (const o of outs) { nodes.push(o); links.push({ from: 'saved', to: o.id, value: o.value }); }
  }
  return { nodes, links, income, taxes: tax, expenses, saved };
}

/** The months the ledger has transactions in, newest first (YYYY-MM). */
export const ledgerMonths = (ledger: finance.Ledger | null): string[] => [...new Set((ledger?.transactions || []).map((t) => t.date.slice(0, 7)))].sort().reverse();

/**
 * A real month, from the ledger: money in by its category (or payee),
 * taxes, spending by top category (a refund taking off its own), and what
 * is left, into each savings account it was moved to and the rest kept as
 * cash. A transfer between the household's own accounts is neither in nor
 * out; one into savings is where the saved went.
 */
export function monthFlow(v: finance.View, L: Lookup, ledger: finance.Ledger, month: string, top: number): Flow {
  const cats = v.categories || [];
  const byName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
  const groupOf = (name: string) => { const c = byName.get(name.toLowerCase()); return c?.parent || c?.name || name || 'No category'; };
  const incomeCat = (name: string) => { const c = byName.get(name.toLowerCase()); return !!c?.income || (!!c?.parent && !!byName.get(c.parent.toLowerCase())?.income); };
  const txs = inHome(v.plan, ledger.transactions).filter((t) => t.date.startsWith(month));
  const src = new Map<string, FlowNode>(), spend = new Map<string, FlowNode>(), into = new Map<string, FlowNode>();
  let tax: FlowNode | null = null;
  const item = (t: finance.Transaction, amount: number): FlowItem => ({ label: t.payee || (t.to ? `To ${L.account[t.to]?.name || 'another account'}` : 'No payee'), amount, date: t.date, tx: t.id, note: L.account[t.account]?.name });
  const add = (m: Map<string, FlowNode>, id: string, label: string, col: FlowNode['col'], hue: Hue, value: number, it: FlowItem) => {
    const n = m.get(id) || { id, label, value: 0, col, hue, items: [] };
    n.value += value; n.items.push(it); m.set(id, n);
  };
  for (const t of txs) {
    if (t.to) {
      // Moved into savings: saved there; moved back out of it, less so.
      const toSaving = saving(L.account[t.to]?.kind), fromSaving = saving(L.account[t.account]?.kind);
      if (toSaving !== fromSaving) {
        const acct = toSaving ? t.to : t.account;
        add(into, 'kept:' + acct, L.account[acct]?.name || acct, 3, savedHue, toSaving ? -t.amount : t.amount, item(t, -t.amount));
      }
      continue;
    }
    for (const p of parts(t)) {
      if (p.amount > 0 && (!p.category || incomeCat(p.category))) {
        // Money in: by its own category under Income, else who paid it.
        const name = p.category && byName.get(p.category.toLowerCase())?.parent ? p.category : t.payee || p.category || 'Money in';
        add(src, 'src:' + name.toLowerCase(), name, 0, 4, p.amount, item(t, p.amount));
        continue;
      }
      const g = groupOf(p.category);
      if (taxing(g) || taxing(p.category)) {
        tax ??= { id: 'taxes', label: 'Taxes', value: 0, col: 2, hue: 7, items: [] };
        tax.value -= p.amount; tax.items.push(item(t, p.amount));
        continue;
      }
      add(spend, 'cat:' + g.toLowerCase(), g, 3, categoryHue(cats, g), -p.amount, item(t, p.amount));
    }
  }
  if (tax && (tax as FlowNode).value < 0) tax = null;
  return build([...src.values()], tax, [...spend.values()], [...into.values()], top);
}

/**
 * A typical month, from the plan: each person's pay (before taxes, when
 * their gross pay is typed in) and money in from someone; taxes, what is
 * taken from pay that is not saved, each kind of payment, and what is
 * saved, into each account and the rest kept as cash.
 */
export function typicalFlow(v: finance.View, L: Lookup, top: number): Flow {
  const people = v.plan.people || [];
  const kept = (id?: string) => saving(L.account[id || '']?.kind);
  const src: FlowNode[] = [], spend = new Map<string, FlowNode>(), into = new Map<string, FlowNode>();
  let taxes = 0;
  const taxItems: FlowItem[] = [];
  const add = (m: Map<string, FlowNode>, id: string, label: string, hue: Hue, value: number, it: FlowItem) => {
    const n = m.get(id) || { id, label, value: 0, col: 3, hue, items: [] };
    n.value += value; n.items.push(it); m.set(id, n);
  };
  for (const e of people) {
    const each = perMonth(e.schedule);
    const ded = e.deductions || [];
    const fromPay = ded.reduce((t, d) => t + d.amount, 0);
    const gross = e.gross && e.gross >= e.net + fromPay ? e.gross : e.net + fromPay;
    src.push({ id: 'src:' + e.id, label: `${e.name}'s pay`, value: gross * each, col: 0, hue: 4, items: [{ label: `${e.name}'s pay${gross > e.net ? ', before taxes' : ''}`, amount: gross * each, person: e.id }] });
    const tax = (gross - e.net - fromPay) * each;
    if (tax > 0.005) { taxes += tax; taxItems.push({ label: `${e.name}'s taxes`, amount: -tax, person: e.id }); }
    for (const d of ded) {
      if (kept(d.account)) add(into, 'kept:' + d.account, L.account[d.account!]?.name || d.account!, savedHue, d.amount * each, { label: `${d.name}, from ${e.name}'s pay`, amount: d.amount * each, person: e.id });
      else add(spend, 'cat:frompay', 'Taken from pay', 6, d.amount * each, { label: `${d.name}, from ${e.name}'s pay`, amount: -d.amount * each, person: e.id });
    }
  }
  const payments = allPayments(v.plan);
  const each = (x: finance.Payment) => x.amount * perMonth(x.schedule, people, v.checking);
  for (const x of payments) {
    if (x.payer) { src.push({ id: 'src:pay:' + x.id, label: `${x.name}, from ${x.payer}`, value: each(x), col: 0, hue: 4, items: [{ label: `${x.name}, from ${x.payer}`, amount: each(x), payment: x.id }] }); continue; }
    const onCard = L.account[x.from || '']?.kind === 'card';
    if (!(!x.from || x.from === v.checking || onCard) || (x.to && x.to === v.checking)) continue;
    if (kept(x.to)) add(into, 'kept:' + x.to, L.account[x.to!]?.name || x.to!, savedHue, each(x), { label: x.name, amount: each(x), payment: x.id });
    else add(spend, 'kind:' + (x.kind || 'other'), kindName(x.kind || 'other'), kindHue[x.kind || 'other'] ?? 6, each(x), { label: x.name, amount: -each(x), payment: x.id });
  }
  return build(src, taxes > 0.005 ? { id: 'taxes', label: 'Taxes', value: taxes, col: 2, hue: 7, items: taxItems } : null, [...spend.values()], [...into.values()], top);
}
