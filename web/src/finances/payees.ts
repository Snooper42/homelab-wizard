// A payee as a bank writes it ("NETFLIX.COM", "AMZN MKTP US*2K4",
// "SQ *BLUE BOTTLE", "TST* JOE'S CAFE 0042", "PAYPAL *SPOTIFY", "POS DEBIT
// SHELL OIL 57444 SAN JOSE CA") made into the name a person would write:
// the card processor's prefix and the merchant's own reference taken off,
// card and store numbers, dates, phone numbers, ".COM", and a trailing
// state dropped, a known chain's wording made its name ("WM SUPERCENTER"
// is Walmart), and capitals made ordinary. Logos then match the clean
// name. A plain function: words in, words out.

/** Processors that write their own name first, the merchant after a star. */
const processors = new Set(['sq', 'tst', 'sp', 'pp', 'py', 'paypal', 'in', 'ggl', 'google', 'gglpay', 'clover', 'toast', 'zettle', 'izettle', 'pmt', 'chk', 'lsp', 'cke']);

/** Words a bank puts before the merchant. */
const leading = /^(?:(?:pos|debit|credit|purchase|checkcard|check card|card|visa|mc|ach|recurring|electronic|point of sale|preauthorized|preauth|bill pay|web|online)\b[\s#:*-]*)+/i;

/** The states and territories, as a bank ends a line with one. */
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
  ['lowes', "Lowe's"], ['lowe s', "Lowe's"], ['the home depot', 'The Home Depot'], ['home depot', 'The Home Depot'], ['trader joe s', "Trader Joe's"], ['whole foods', 'Whole Foods'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

/** Words for matching: lower case, letters and digits, one space between. */
const flat = (s: string) => s.toLowerCase().replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** "BLUE BOTTLE" is "Blue Bottle"; a line in mixed case is left as typed. */
function ordinary(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/'S\b/g, "'s");
}

/** The payee a person would write for a bank's wording; the wording itself when nothing in it says who. */
export function cleanPayee(raw: string | undefined): string {
  let s = (raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  s = s.replace(leading, '').trim();
  // A processor first: the merchant follows its star ("SQ *BLUE BOTTLE"); a star after the merchant is its own reference ("…US*2K4").
  const star = s.match(/^([A-Za-z. ]{1,12}?)\s*\*\s*(.+)$/);
  if (star && processors.has(flat(star[1]).replace(/ /g, ''))) s = star[2];
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
  s = parts.join(' ').replace(/[\s,.;:-]+$/, '').trim();
  if (!s) return (raw || '').trim();
  const f = flat(s);
  const chain = chains.find(([w]) => f === w || f.startsWith(w + ' '));
  return chain ? chain[1] : ordinary(s);
}
