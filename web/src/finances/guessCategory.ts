import { brandOf, hintOf, paysAlike, subTypeName, suggestType } from './Mark';
import { brands } from './logos';

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
  Electric: 'dukeenergy pge coned fpl',
  'Car insurance': 'geico progressive statefarm allstate libertymutual',
  Travel: 'delta unitedairlines americanairlines southwestairlines jetblue marriott hilton airbnb expedia bookingdotcom hotelsdotcom uber lyft',
  Fitness: 'planetfitness peloton strava',
  Gaming: 'steam playstation xboxgamepass nintendoswitch epicgames ea ubisoft roblox gamestop',
}).flatMap(([category, list]) => list.split(' ').map((b) => [b, category])));

/** The word hints (Mark.tsx's hintOf) and the category each means. */
const hintCategory: Record<string, string> = {
  internet: 'Internet', phone: 'Phone', water: 'Water', utilities: 'Electric', spending: 'Groceries', fitness: 'Fitness',
  food: 'Eating out', health: 'Health', school: 'Kids and school', streaming: 'Streaming and music', music: 'Streaming and music',
  cloud: 'Cloud and homelab', software: 'Software and apps', home: 'Mortgage or rent', gaming: 'Gaming',
};

/** A category a household may call by another name: Gaming is its Games or Video games just as well. */
const alsoCalled: Record<string, string[]> = { gaming: ['Gaming', 'Games', 'Video games', 'Video gaming'] };

const bankWords: [RegExp, string[]][] = [
  [/grocer|supermarket/, ['Groceries']],
  [/restaurant|food & drink|food and drink|dining|bar & caf|fast food|coffee/, ['Eating out']],
  [/\bfuel|gas station|^gas\b|gas\/automotive/, ['Gas']],
  [/airline|lodging|hotel|travel|vehicle rental|car rental|rail|cruise/, ['Travel']],
  [/pharmac|drug store|health|medical|dental|doctor|hospital/, ['Health']],
  [/fitness|gym|sporting club/, ['Fitness']],
  [/cable|internet/, ['Internet']],
  [/wireless|telephone|telecom|phone/, ['Phone']],
  [/hardware|home improvement|building supplies|home & garden|home and garden/, ['Repairs']],
  [/education|school|tuition|child care/, ['Kids and school']],
  [/gift|donation|charit/, ['Gifts and giving', 'Gifts']],
  [/fees? & adjust|fees and adjust|interest charge|^fees?\b/, ['Fees and interest']],
  [/insurance/, ['Insurance']],
  [/utilit/, ['Utilities', 'Electric']],
  [/entertainment/, ['Entertainment']],
  [/retail|department store|clothing|merchandise|shopping|electronics|sporting goods|book store|internet purchase|wholesale/, ['Shopping']],
  [/automotive|auto service|auto parts|parking|tolls?\b/, ['Car']],
];

/** The household's names a bank's word for a row may be, likeliest first (bankWords). */
export function bankKinds(word: string | undefined): string[] {
  const w = (word || '').toLowerCase().trim();
  if (!w) return [];
  // What in its group first, then the group: "Merchandise & Supplies-Groceries" is Groceries before Shopping. Other and
  // Miscellaneous say nothing, so they're left for the household to pick.
  const parts = w.split(/\s*-\s*/).filter((p) => p && !/^(?:other|misc|miscellaneous|general)$/.test(p)).reverse();
  return parts.flatMap((part) => [part, ...bankWords.filter(([re]) => re.test(part)).flatMap(([, names]) => names)]);
}

/** What a guess says: a category, or the household's own account the money moved to or came from. */
export interface Guess { category?: string; account?: string }

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

export function ownAccount(payee: string, into: string, accounts: finance.Account[], raw?: string): string | undefined {
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
  if (raw && /\b(?:pmt|pymt|payment|autopay|epay|e payment)\b/i.test(raw.replace(/[-_]/g, ' '))) {
    const brand = brandOf(undefined, payee);
    const cards = others.filter((a) => a.kind === 'card' && brand && brandOf(a.institution, a.name) === brand);
    if (cards.length === 1) return cards[0].id;
  }
  const p = flat(payee);
  if (!p || p.split(' ').length < 2) return undefined;
  const named = others.filter((a) => a.kind !== 'card' && a.kind !== 'loan' && flat(a.name) === p);
  return named.length === 1 ? named[0].id : undefined;
}

export function guessFor(t: { payee?: string; amount: number; raw?: string; kind?: string }, into: string, plan: finance.Plan, categories: finance.Category[], last?: string, pays?: finance.Payment): Guess {
  const payee = t.payee || '';
  const moved = payee && ownAccount(payee, into, plan.accounts || [], t.amount < 0 ? t.raw : undefined);
  if (moved) return { account: moved };
  const have = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const pick = (...names: (string | undefined)[]) => {
    for (const n of names.flatMap((x) => (x && alsoCalled[x.toLowerCase()]) || [x])) {
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
  // A game store bought from, with no Gaming category kept, is Shopping.
  const otherwise = brand && brandCategory[brand] === 'Gaming' ? 'Shopping' : undefined;
  // The file's own word for it (its Category column) when nothing about the payee says.
  return { category: pick(...(pays ? paymentCategory(pays) : []), fromWords, brand && brandCategory[brand], sub ? subTypeName(sub) : undefined, hint && hintCategory[hint], otherwise, ...bankKinds(t.kind)) };
}

/** The kinds of planned payment a payee may pay by what it is: bills, never a spending or saving envelope. */
const billKinds = new Set(['utilities', 'home', 'car', 'subscriptions', 'loans']);

export function samePurpose(payee: string, x: finance.Payment): boolean {
  if (!billKinds.has(x.kind || '')) return false;
  const brand = brandOf(undefined, payee);
  if (!brand) return false;
  if (brands[brand]?.kind === 'car') return (x.kind === 'car' && !/insurance/i.test(x.name)) || (x.kind === 'loans' && /\b(?:car|auto|vehicle|truck)\b/i.test(x.name));
  const cat = brandCategory[brand];
  return !!cat && paymentCategory(x).some((c) => c.toLowerCase() === cat.toLowerCase());
}

/** Whether a payee pays a planned payment: by its name or brand (Mark's paysAlike), or by what it is (samePurpose). */
export const paysBill = (payee: string, x: finance.Payment): boolean => paysAlike(payee, x) || samePurpose(payee, x);
