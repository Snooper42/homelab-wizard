// What a transaction brought in from a bank's file is for, when that is
// plain: the category its payee had last (the household's own choice,
// first), the one of the planned payment it pays (Xfinity paying
// Internet), a known company's usual one (Costco is Groceries, Netflix
// Streaming and music), or its words (a payroll deposit is a Paycheck).
// Money between the household's own accounts (paying a card off,
// moving to savings) is a move to that account, not spending, when one
// account plainly fits. Anything else is left for the household to
// pick. Plain functions: nothing is looked up anywhere.
import { brandOf, hintOf, subTypeName, suggestType } from './Mark';

/** Brands (logos.ts) and the category each is mostly. */
const brandCategory: Record<string, string> = Object.fromEntries(Object.entries({
  Groceries: 'costco walmart kroger wholefoods traderjoes aldi publix safeway lidl tesco instacart',
  Gas: 'shell chevron exxon bp',
  'Eating out': 'starbucks mcdonalds chipotle tacobell burgerking kfc wendys subway dunkin chickfila pizzahut dominos panerabread doordash grubhub postmates',
  Shopping: 'amazon ebay etsy bestbuy ikea target kohls macys nordstrom gap oldnavy uniqlo hm zara wayfair sephora nike adidas',
  Repairs: 'thehomedepot lowes',
  Health: 'cvs walgreens',
  Phone: 'verizon tmobile atandt mintmobile visiblebyverizon googlefi usmobile boostmobile',
  Internet: 'xfinity spectrum cox optimum googlefiber starlink frontier centurylink',
  Electric: 'dukeenergy pge coned',
  'Car insurance': 'geico progressive statefarm allstate libertymutual',
  Travel: 'delta unitedairlines americanairlines southwestairlines jetblue marriott hilton airbnb expedia bookingdotcom hotelsdotcom uber lyft',
  Fitness: 'planetfitness peloton strava',
}).flatMap(([category, list]) => list.split(' ').map((b) => [b, category])));

/** The word hints (Mark.tsx's hintOf) and the category each means. */
const hintCategory: Record<string, string> = {
  internet: 'Internet', phone: 'Phone', water: 'Water', utilities: 'Electric', spending: 'Groceries', fitness: 'Fitness',
  food: 'Eating out', health: 'Health', school: 'Kids and school', streaming: 'Streaming and music', music: 'Streaming and music',
  cloud: 'Cloud and homelab', software: 'Software and apps', home: 'Mortgage or rent',
};

/** What a guess says: a category, or the household's own account the money moved to or came from. */
export interface Guess { category?: string; account?: string }

/**
 * A planned payment's category: its name's hint (an Internet bill is
 * Internet), a subscription's type, or its kind's group.
 */
function paymentCategory(p: finance.Payment): string[] {
  const out: string[] = [];
  const h = hintOf(p.kind, p.name);
  if (h && hintCategory[h]) out.push(hintCategory[h]);
  if (p.kind === 'subscriptions') { const t = p.type || suggestType(p.institution, p.name); if (t) out.push(subTypeName(t)); out.push('Subscriptions'); }
  if (p.kind === 'car' && /insurance/i.test(p.name)) out.push('Car insurance');
  out.push(({ home: 'Home', utilities: 'Utilities', car: 'Car', subscriptions: 'Subscriptions', other: 'Other' } as Record<string, string>)[p.kind || ''] || '');
  return out.filter(Boolean);
}

/** Words for matching: lower case, letters and digits, one space between. */
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The household's own account a transaction moved money to or from: a card
 * paid off ("Payment to Chase card ••1234": the card with those last four,
 * else the only card of that bank), or an account named by the payee
 * ("Apple Savings"). One account, never the one imported into; none
 * when two fit.
 */
export function ownAccount(payee: string, into: string, accounts: finance.Account[]): string | undefined {
  const others = accounts.filter((a) => a.id !== into && a.kind !== 'home' && a.kind !== 'car' && a.kind !== 'collectible' && a.kind !== 'other');
  const card = payee.match(/^Payment to (.+) card ••(\d{4})$/);
  if (card) {
    const cards = others.filter((a) => a.kind === 'card');
    const byFour = cards.filter((a) => (a.detail || '').includes(card[2]) || a.name.includes(card[2]));
    if (byFour.length === 1) return byFour[0].id;
    const bank = brandOf(undefined, card[1]);
    const byBank = cards.filter((a) => bank && brandOf(a.institution, a.name) === bank);
    return byBank.length === 1 ? byBank[0].id : undefined;
  }
  const p = flat(payee);
  if (!p || p.split(' ').length < 2) return undefined;
  const named = others.filter((a) => a.kind !== 'card' && a.kind !== 'loan' && flat(a.name) === p);
  return named.length === 1 ? named[0].id : undefined;
}

/**
 * What an imported row is for: the category its payee had last, else the
 * planned payment's it pays, else a known company's, else its words'; or
 * the household's own account it moved to or from. Only a category in
 * the household's list is given.
 */
export function guessFor(t: { payee?: string; amount: number }, into: string, plan: finance.Plan, categories: finance.Category[], last?: string, pays?: finance.Payment): Guess {
  const payee = t.payee || '';
  const moved = payee && ownAccount(payee, into, plan.accounts || []);
  if (moved) return { account: moved };
  const have = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const pick = (...names: (string | undefined)[]) => {
    for (const n of names) {
      const c = n && have.get(n.toLowerCase());
      // Money in takes an income category, money out a spending one.
      if (c && !!c.income === t.amount > 0) return c.name;
    }
    return undefined;
  };
  if (last && have.has(last.toLowerCase())) return { category: categories.find((c) => c.name.toLowerCase() === last.toLowerCase())!.name };
  const words = ' ' + flat(payee) + ' ';
  const fromWords = t.amount > 0
    ? (/ (payroll|salary|direct dep|dir dep|paycheck) /.test(words) ? 'Paycheck' : / interest /.test(words) ? 'Interest' : / (refund|return) /.test(words) ? 'Refunds' : undefined)
    : / (fee|fees|overdraft) /.test(words) ? 'Fees and interest' : undefined;
  const brand = payee ? brandOf(undefined, payee) : undefined;
  const sub = brand ? suggestType(brand, payee) : '';
  const hint = hintOf(undefined, payee);
  return { category: pick(...(pays ? paymentCategory(pays) : []), fromWords, brand && brandCategory[brand], sub ? subTypeName(sub) : undefined, hint && hintCategory[hint]) };
}
