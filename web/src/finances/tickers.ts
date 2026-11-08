// A holding's logo on Investments: its ticker symbol to a brand already in
// logos.ts (a Vanguard fund to Vanguard, AAPL to Apple). Kept here, never
// looked up: a symbol not listed stands as its own monogram.
import { brands } from './logos';

const funds: Record<string, string[]> = {
  vanguard: ['VTI', 'VOO', 'VXUS', 'BND', 'BNDX', 'VT', 'VUG', 'VTV', 'VIG', 'VYM', 'VNQ', 'VGT', 'VB', 'VO', 'VEA', 'VWO', 'VTEB', 'VGIT', 'VGSH', 'VTSAX', 'VFIAX', 'VTIAX', 'VBTLX', 'VTWAX', 'VFFVX', 'VTTSX', 'VTHRX', 'VTTVX', 'VTIVX', 'VFIFX'],
  fidelity: ['FXAIX', 'FZROX', 'FZILX', 'FSKAX', 'FTIHX', 'FXNAX', 'FBALX', 'FDVV', 'FSPSX', 'FNILX', 'FCNTX', 'FBGRX', 'FDGRX', 'FSMDX', 'FSSNX'],
  schwab: ['SCHW', 'SCHB', 'SCHD', 'SCHX', 'SCHF', 'SCHG', 'SCHA', 'SCHE', 'SCHZ', 'SCHP', 'SWTSX', 'SWPPX', 'SWISX', 'SWAGX'],
  troweprice: ['TROW', 'PRGFX', 'TRBCX', 'PRWCX'],
};

const companies: Record<string, string> = {
  AAPL: 'apple', AMZN: 'amazon', GOOGL: 'google', GOOG: 'google', TSLA: 'tesla', NFLX: 'netflix', SPOT: 'spotify',
  COST: 'costco', WMT: 'walmart', TGT: 'target', SBUX: 'starbucks', NKE: 'nike', MCD: 'mcdonalds', CMG: 'chipotle',
  HOOD: 'robinhood', COIN: 'coinbase', PYPL: 'paypal', MA: 'mastercard', V: 'visa', AXP: 'americanexpress',
  JPM: 'chase', BAC: 'bankofamerica', WFC: 'wellsfargo', GS: 'goldmansachs', C: 'citi', MS: 'morganstanley',
  COF: 'capitalone', SOFI: 'sofi', ALLY: 'ally', PNC: 'pnc', USB: 'usbank', TFC: 'truist', SYF: 'synchrony',
  HD: 'thehomedepot', LOW: 'lowes', BBY: 'bestbuy', KR: 'kroger', CVS: 'cvs', WBA: 'walgreens', GME: 'gamestop',
  XOM: 'exxon', CVX: 'chevron', BP: 'bp', SHEL: 'shell', SHOP: 'shopify', ABNB: 'airbnb', UBER: 'uber', LYFT: 'lyft',
  DASH: 'doordash', EBAY: 'ebay', ETSY: 'etsy', ADBE: 'adobe', ZM: 'zoom', NET: 'cloudflare', DOCN: 'digitalocean',
  F: 'ford', TM: 'toyota', HMC: 'honda', MAR: 'marriott', HLT: 'hilton', DAL: 'delta', UAL: 'unitedairlines',
  AAL: 'americanairlines', LUV: 'southwestairlines', JBLU: 'jetblue', EA: 'ea', RBLX: 'roblox', SIRI: 'siriusxm',
  AMP: 'ameriprise', MET: 'metlife', PRU: 'prudential', ALL: 'allstate', CI: 'cigna', HUM: 'humana', UNH: 'unitedhealthcare',
  DIS: 'disneyplus', DPZ: 'dominos', DG: 'dollargeneral', DLTR: 'dollartree',
  W: 'wayfair', CHWY: 'chewy', GRMN: 'garmin', DUK: 'dukeenergy', PCG: 'pge', ED: 'coned', T: 'atandt', VZ: 'verizon',
  TMUS: 'tmobile', LMND: 'lemonade', AFRM: 'affirm', SQ: 'square',
};

const bySymbol: Record<string, string> = Object.fromEntries([
  ...Object.entries(funds).flatMap(([brand, list]) => list.map((s) => [s, brand])),
  ...Object.entries(companies).filter(([, b]) => b),
]);

/** The brand a ticker symbol is drawn with, when logos.ts has it. */
export function tickerBrand(symbol: string): string | undefined {
  const b = bySymbol[symbol.toUpperCase().replace(/\..*$/, '')];
  return b && brands[b] ? b : undefined;
}
