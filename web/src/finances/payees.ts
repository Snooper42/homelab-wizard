// A payee as a bank writes it ("NETFLIX.COM", "AMZN MKTP US*2K4",
// "SQ *BLUE BOTTLE", "TST* JOE'S CAFE 0042", "PAYPAL *SPOTIFY", "POS DEBIT
// SHELL OIL 57444 SAN JOSE CA", "ACME CRUISES AD_PAYMENT PPD ID: 1234",
// "Zelle payment from JANE DOE 1234567890") made into the name a person would write:
// the card processor's prefix and the merchant's own reference taken off,
// card and store numbers, dates, phone numbers, ".COM", and a trailing
// state dropped, a known chain's wording made its name ("WM SUPERCENTER"
// is Walmart), and capitals made ordinary. A direct debit or deposit
// (ACH) loses its codes: the PPD or WEB ID, its entry wording
// (AD_PAYMENT), and a long reference. Zelle says who, and a card paid
// from checking says which; a bill or a card payment is its company
// (FPL, American Express), and a car's lender its make (Mazda). Logos
// then match the clean name. Plain functions: words in, words out.

/** Processors that write their own name first, the merchant after a star. */
const processors = new Set(['sq', 'tst', 'sp', 'pp', 'py', 'paypal', 'in', 'ggl', 'google', 'gglpay', 'clover', 'toast', 'zettle', 'izettle', 'pmt', 'chk', 'lsp', 'cke', 'wwp', 'wl']);

/** Words a bank puts before the merchant. */
const leading = /^(?:(?:pos|debit|credit|purchase|checkcard|check card|card|visa|mc|ach|recurring|electronic|point of sale|preauthorized|preauth|bill pay|web|online|aplpay)\b[\s#:*-]*)+/i;

/** A direct debit's or deposit's code and number ("PPD ID: 1592714849", "WEB ID: 2222"). */
const achId = /\b(?:PPD|CCD|WEB|TEL|CTX|IAT|ARC|BOC|POP|RCK|CIE)\s*ID\s*:?\s*\S*/gi;

/** The states and territories, as a bank ends a line with one. */
/** A company's ending, which says nothing of the shop: SUNSHINE DENTAL, INC. is Sunshine Dental. */
const suffixes = new Set('llc inc corp corporation ltd pllc llp'.split(' '));
const states = new Set('al ak az ar ca co ct de dc fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy pr'.split(' '));

/**
 * A chain's statement wording and its name, the longest first: a clean
 * line that is, or starts with, the wording takes the name.
 */
const chains: [string, string][] = ([
  ['amzn mktp', 'Amazon'], ['amzn mktplace', 'Amazon'], ['amazon mktplace', 'Amazon'], ['amazon mktpl', 'Amazon'], ['amazon mktp', 'Amazon'], ['amzn', 'Amazon'], ['amazon com', 'Amazon'],
  ['amazon prime', 'Amazon Prime'], ['prime video', 'Prime Video'], ['wm supercenter', 'Walmart'], ['wal mart', 'Walmart'], ['walmart supercenter', 'Walmart'], ['walmart', 'Walmart'],
  ['tgt', 'Target'], ['target t', 'Target'], ['target', 'Target'], ['costco whse', 'Costco'], ['costco gas', 'Costco'], ['costco', 'Costco'], ['shell oil', 'Shell'], ['shell service', 'Shell'],
  ['exxonmobil', 'Exxon'], ['exxon mobil', 'Exxon'], ['chevron', 'Chevron'], ['mcdonald s', "McDonald's"], ['mcdonalds', "McDonald's"], ['starbucks', 'Starbucks'],
  ['uber eats', 'Uber Eats'], ['uber trip', 'Uber'], ['uber', 'Uber'], ['lyft ride', 'Lyft'], ['lyft', 'Lyft'], ['dd doordash', 'DoorDash'], ['doordash', 'DoorDash'],
  ['cvs pharmacy', 'CVS'], ['cvs', 'CVS'], ['walgreens', 'Walgreens'], ['apple com bill', 'Apple'], ['itunes com', 'Apple'], ['kroger fuel', 'Kroger'], ['kroger', 'Kroger'],
  ['youtubepremium', 'YouTube Premium'], ['youtube premium', 'YouTube Premium'], ['youtube', 'YouTube'], ['apple', 'Apple'], ['netflix', 'Netflix'], ['spotify usa', 'Spotify'], ['spotify', 'Spotify'], ['hulu', 'Hulu'], ['disney plus', 'Disney+'], ['instacart', 'Instacart'], ['chipotle', 'Chipotle'],
  ['comcast xfinity', 'Xfinity'], ['comcast cable', 'Xfinity'], ['xfinity', 'Xfinity'], ['apple gs savings', 'Apple Savings'], ['apple savings', 'Apple Savings'], ['verizon wireless', 'Verizon'],
  // Bills and card payments, by the name a person says (FPL DIRECT DEBIT ELEC PYMT is FPL; APPLECARD GSBANK PAYMENT, Apple Card).
  ['fpl', 'FPL'], ['florida power light', 'FPL'], ['duke energy', 'Duke Energy'], ['american express', 'American Express'], ['amex epayment', 'American Express'],
  ['applecard gsbank', 'Apple Card'], ['applecard', 'Apple Card'], ['apple card', 'Apple Card'], ['apple cash', 'Apple Cash'], ['fid bkg svc', 'Fidelity'], ['fidelity investments', 'Fidelity'],
  ['royal caribbean', 'Royal Caribbean'],
  // American Express's own spelling and cuts: AMAZON MARKEPLACE NA; ANTHROPIC CLAUDE SUS, then SAN FRANCISCO run into it.
  ['amazon markeplace', 'Amazon'], ['amazon marketplace', 'Amazon'], ['anthropic claude', 'Claude'],
  // Game stores, by their brand (WL *STEAM PURCHASE is Steam; MICROSOFT*XBOX, Xbox).
  ['steam purchase', 'Steam'], ['steamgames', 'Steam'], ['steam games', 'Steam'], ['steampowered', 'Steam'], ['steam store', 'Steam'],
  ['playstation network', 'PlayStation'], ['sony playstation', 'PlayStation'], ['playstation', 'PlayStation'], ['playstation plus', 'PlayStation Plus'],
  ['xbox', 'Xbox'], ['xbox game pass', 'Xbox Game Pass'], ['nintendo', 'Nintendo'], ['nintendo switch', 'Nintendo Switch'], ['epic games', 'Epic Games'], ['gamestop', 'GameStop'], ['roblox', 'Roblox'],
  // A car's lender by its make: MAZDA FINANCIAL is Mazda, as its payment is planned.
  ['mazda financial', 'Mazda'], ['toyota financial', 'Toyota'], ['toyota motor credit', 'Toyota'], ['lexus financial', 'Lexus'], ['honda financial', 'Honda'], ['american honda finance', 'Honda'],
  ['ford credit', 'Ford'], ['ford motor credit', 'Ford'], ['nissan motor acceptance', 'Nissan'], ['nissan infiniti', 'Nissan'], ['hyundai motor finance', 'Hyundai'], ['hyundai capital', 'Hyundai'],
  ['kia motors finance', 'Kia'], ['kia finance', 'Kia'], ['bmw financial', 'BMW'], ['subaru motors finance', 'Subaru'], ['vw credit', 'Volkswagen'], ['volkswagen credit', 'Volkswagen'],
  ['lowes', "Lowe's"], ['lowe s', "Lowe's"], ['the home depot', 'The Home Depot'], ['home depot', 'The Home Depot'], ['trader joe s', "Trader Joe's"], ['whole foods', 'Whole Foods'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

/** The chain whose wording a clean line is, or starts with. */
const chainOf = (f: string) => chains.find(([w]) => f === w || f.startsWith(w + ' '));

/** Words for matching: lower case, letters and digits, one space between. */
const flat = (s: string) => s.toLowerCase().replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** "BLUE BOTTLE" is "Blue Bottle"; a line in mixed case is left as typed. */
function ordinary(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/'S\b/g, "'s");
}

/** A state as a bank ends a line with it: two capitals. */
const isState = (w: string) => w.length === 2 && w === w.toUpperCase() && states.has(w.toLowerCase());

/** A town in a column of its own, or what stands in for one: the merchant's website or phone number. */
const townColumn = /^(?:[A-Za-z][A-Za-z .'/-]*|\d{3}[-. ]\d{3}[-. ]\d{4})$/;

/** A shop's full column with its town run into the end of its store number ("PET SUPERMARKET #100SUNRISE"): the shop's part. */
const unglued = (s: string) => s.match(/^(.*[A-Za-z].*\d)[A-Z][A-Z .'-]{1,12}$/)?.[1] ?? s;

/** A website in a line. */
const site = /\.(?:com|net|org|co|io|tv|us)\b/i;

/**
 * The shop alone, its town and state taken off. American Express pads a
 * line into columns ("BLUE BOTTLE COFFEE  OAKLAND   CA"): the shop, then
 * its town (or website, or phone number), then its state. When the shop's
 * column is full, the town follows its store number with no space ("PET
 * SUPERMARKET #100SUNRISE FL"), and a shop online gives its website as its
 * town ("AMAZON.COM AMZN.COM/BILL WA"). A line that is none of these, or
 * that would keep nothing but a bank's words, comes back as it was.
 */
function shopOf(line: string): string {
  const s = line.trim();
  const keeps = (x: string) => /[A-Za-z]/.test(x.replace(leading, '')) ? x : s;
  const cols = s.split(/\s{2,}/);
  if (cols.length > 1) {
    const last = cols[cols.length - 1], two = last.match(/^(.+)\s(\S+)$/);
    if (isState(last)) {
      // With no town column of its own, the town may have run into the shop's full column ("#100SUNRISE").
      const town = cols.length > 2 && townColumn.test(cols[cols.length - 2]);
      const shop = cols.slice(0, town ? -2 : -1).join(' ');
      return keeps(town ? shop : unglued(shop));
    }
    if (two && isState(two[2]) && townColumn.test(two[1])) return keeps(cols.slice(0, -1).join(' '));
    return s;
  }
  const glued = s.match(/^(.*[A-Za-z].*\d)([A-Z][A-Z .'-]{1,12}) ([A-Z]{2})$/);
  if (glued && isState(glued[3])) return keeps(glued[1]);
  const web = s.match(/^(.+) (\S+) (\S+)$/);
  if (web && isState(web[3]) && site.test(web[2])) return keeps(web[1]);
  return s;
}

/**
 * A bank's wording with the town its file names for it (a City/State
 * column: "SAN JOSE CA", or on two lines) taken off its end; the wording as
 * it was when it doesn't end with that town.
 */
export function withoutTown(raw: string, town: string | undefined): string {
  const words = (town || '').split(/\s+/).filter(Boolean);
  if (words.length > 1 && isState(words[words.length - 1])) words.pop();
  const s = (raw || '').replace(/\s+/g, ' ').trim();
  if (!words.length) return raw;
  const parts = s.split(' ');
  if (parts.length > 1 && isState(parts[parts.length - 1])) parts.pop();
  const n = words.length, tail = parts.slice(-n).join(' ').toLowerCase();
  if (parts.length <= n || tail !== words.join(' ').toLowerCase()) return raw;
  const left = parts.slice(0, -n).join(' ');
  return /[A-Za-z]/.test(left.replace(leading, '')) ? left : raw;
}

/** The payee a person would write for a bank's wording; the wording itself when nothing in it says who. */
export function cleanPayee(raw: string | undefined): string {
  let s = shopOf(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // Zelle: who it went to or came from, its reference dropped.
  const zelle = s.match(/^zelle\s+(?:payment\s+|transfer\s+)?(from|to)\s+(.+?)(?:\s+[A-Za-z]*\d[A-Za-z0-9]{5,})?$/i);
  if (zelle) return `Zelle ${zelle[1].toLowerCase()} ${ordinary(zelle[2].trim())}`;
  // A card paid from checking: which card, by its last four.
  const card = s.match(/^payment to (.+?) card ending in (\d{4})\b/i);
  if (card) return `Payment to ${ordinary(card[1].trim())} card ••${card[2]}`;
  // A direct debit or deposit: its code and number, its entry wording (AD_PAYMENT), and a long reference (NZTZP5VXA0Y1UPE) go, then a trailing WEB or PPD.
  if (s.search(achId) >= 0) {
    s = s.replace(achId, ' ')
      .replace(/(?:^|\s)\S*_\S*(?=\s|$)/g, ' ')
      .replace(/(?:^|\s)(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{8,}(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .replace(/(?:\s+(?:PPD|CCD|WEB|TEL))+$/i, '');
  }
  s = s.replace(leading, '').trim();
  // A processor first: the merchant follows its star ("SQ *BLUE BOTTLE"), as a known name does after its maker's
  // ("MICROSOFT*XBOX" is Xbox); a star after the merchant is its own reference ("…US*2K4").
  const star = s.match(/^([A-Za-z. ]{1,12}?)\s*\*\s*(.+)$/);
  if (star && (processors.has(flat(star[1]).replace(/ /g, '')) || chainOf(flat(star[2])))) s = star[2];
  else s = s.replace(/\s*\*\s*\S*$/, '').replace(/\*/g, ' ');
  s = s
    .replace(/\bwww\./gi, '')
    .replace(/\.(?:com|net|org|co|io|tv|us)\b(?:\/\S*)?/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ') // a date
    .replace(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/g, ' ') // a phone number
    .replace(/\b(?:x{2,}|\*{2,})\d+\b/gi, ' ') // a card's last digits
    .replace(/\bstore\s*#?\s*\d+\b/gi, ' ')
    .replace(/#\s*\d+/g, ' ')
    .replace(/(?:^|\s)[A-Za-z]{0,2}\d{3,}[A-Za-z0-9]*(?=\s|$)/g, ' ') // a store or terminal number
    .replace(/\s+/g, ' ').trim();
  // A trailing state, after something to keep (in capitals, as a bank writes it).
  const parts = s.split(' ');
  if (parts.length > 1 && states.has(parts.at(-1)!.toLowerCase()) && parts.at(-1) === parts.at(-1)!.toUpperCase()) parts.pop();
  // Then a company's ending (LLC, Inc.), after something to keep.
  while (parts.length > 1 && suffixes.has(parts.at(-1)!.toLowerCase().replace(/[.,]/g, ''))) parts.pop();
  s = parts.join(' ').replace(/[\s,.;:-]+$/, '').trim();
  if (!s) return (raw || '').replace(/\s+/g, ' ').trim();
  const chain = chainOf(flat(s));
  return chain ? chain[1] : ordinary(s);
}

/** Whether a note is a bank's own wording (kept from an import), not words a person wrote: a long number, an ACH code, or a line in capitals the payee was made from. */
export function bankWording(note: string): boolean {
  const s = note.trim();
  const letters = s.replace(/[^A-Za-z]/g, '');
  const shouting = letters.length >= 8 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7;
  return (/\d{5,}/.test(s) || /\b(?:PPD|CCD|WEB|TEL)\s*ID\b|\bXFER\b/i.test(s) || shouting) && cleanPayee(s).toLowerCase() !== s.toLowerCase();
}

/**
 * A note as the list shows it: the bank's wording left out (it stays in
 * the transaction, for search and the form), a memo before it kept. The
 * wording the payee was made from ("Payment to Chase card ending in 9495
 * 11/06" for Payment to Chase card ••9495) is the bank's too.
 */
export function shownNote(note: string | undefined, payee?: string): string {
  const s = (note || '').trim();
  const fromIt = (x: string) => !!payee && cleanPayee(x).toLowerCase() === payee.toLowerCase() && cleanPayee(x).toLowerCase() !== x.toLowerCase();
  const bank = (x: string) => bankWording(x) || fromIt(x);
  const m = s.match(/^(.*\S)\s+\((.+)\)$/);
  if (m && bank(m[2])) return bank(m[1]) ? '' : m[1];
  return bank(s) ? '' : s;
}
