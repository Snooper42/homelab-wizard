// What stands before an account or payment: its brand's mark in the
// brand's colour (logos.ts), or its logo in its own colours on white, or its
// initials on its colour for a brand with neither, else an icon for its
// kind, else its first
// letter. And a person's initial, in their colour. A brand's mark is
// .fmark.logo, not .brand: that is the sidebar's name, margins and all.
import { brands } from './logos';

/** Feather-style icons for kinds of accounts and payments (24 by 24 strokes). */
const kindIcons: Record<string, string> = {
  checking: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6',
  savings: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  cards: 'M2 6h20v12H2zM2 10h20M6 15h4',
  investment: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  retirement: 'M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10',
  loan: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  loans: 'M22 9 12 4 2 9l10 5 10-5zM6 11v5c3 2 9 2 12 0v-5',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  car: 'M5 17H3v-5l2.5-5h13l2.5 5v5h-2M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M13 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M3 12h18',
  utilities: 'M13 2 4 14h7l-1 8 9-12h-7z',
  subscriptions: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  spending: 'M3 3h2l2.5 12h11L21 7H6.5M9 20h.01M18 20h.01',
  collectible: 'M6 3h12l4 6-10 12L2 9zM11 3 8 9l4 12 4-12-3-6M2 9h20',
  other: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  // What a payment is for, read from its name when no brand is.
  streaming: 'M2 7h20v13H2zM7 2l5 5 5-5',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  gaming: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M7 6h10a5 5 0 0 1 5 5v2a5 5 0 0 1-9 3h-2a5 5 0 0 1-9-3v-2a5 5 0 0 1 5-5z',
  news: 'M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h5',
  fitness: 'M6 6v12M3 9v6M18 6v12M21 9v6M6 12h12',
  cloud: 'M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z',
  software: 'M4 5h16v11H4zM2 20h20M10 9l-2 2 2 2M14 9l2 2-2 2',
  food: 'M7 2v20M4 2v5a3 3 0 0 0 6 0V2M17 22V2c-2.5 1-4 4-4 9h4',
  phone: 'M7 2h10v20H7zM11 18h2',
  internet: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  water: 'M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11z',
  heat: 'M12 22a6 6 0 0 0 6-6c0-5-6-8-6-14-2 4-6 7-6 14a6 6 0 0 0 6 6z',
  insurance: 'M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z',
  trash: 'M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15',
  health: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  school: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  minus: 'M5 12h14',
};

export interface MarkProps {
  /** The brand (logos.ts), when it has one. */
  brand?: string;
  /** The account's or payment's kind, for its icon. */
  kind?: string;
  /** Its name: the first letter when there is no brand or icon. */
  name: string;
  /** A subscription's type (streaming, cloud…), for its glyph when it has no brand. */
  type?: string;
  size?: 'sm' | 'lg';
}

/**
 * Words in a payment's name that say what it is for, so a bill with no
 * brand shows a water drop or a shield, not its kind's icon like every
 * other. The first list with a word in the name wins: "Groceries and gas"
 * is groceries, not the gas bill.
 */
const hints: [string, string[]][] = [
  ['spending', ['groceries', 'grocery', 'supermarket']],
  ['insurance', ['insurance', 'insure', 'warranty']],
  ['internet', ['internet', 'wifi', 'wi fi', 'broadband', 'fiber', 'fibre', 'isp']],
  ['phone', ['phone', 'phones', 'mobile', 'cell', 'cellphone', 'wireless']],
  ['water', ['water', 'sewer', 'sewage']],
  ['heat', ['gas', 'propane', 'heating', 'heating oil']],
  ['utilities', ['electric', 'electricity', 'power', 'energy', 'solar']],
  ['trash', ['trash', 'garbage', 'recycling', 'waste']],
  ['home', ['rent', 'hoa', 'mortgage', 'condo', 'property tax', 'lawn', 'pest']],
  ['streaming', ['streaming', 'tv', 'television', 'cable', 'movies', 'movie', 'films', 'cinema', 'theater', 'theatre', 'video']],
  ['music', ['music', 'radio', 'audiobooks', 'audiobook', 'podcasts', 'podcast']],
  ['gaming', ['game', 'games', 'gaming']],
  ['news', ['news', 'newspaper', 'magazine', 'journal', 'times', 'gazette', 'tribune']],
  ['fitness', ['gym', 'fitness', 'yoga', 'pilates', 'workout', 'crossfit', 'climbing']],
  ['cloud', ['cloud', 'storage', 'backup', 'backups', 'hosting', 'server', 'vps', 'domain', 'domains', 'dns', 'vpn', 'seedbox']],
  ['software', ['software', 'app', 'apps', 'license', 'antivirus', 'password manager']],
  ['food', ['meals', 'meal kit', 'meal', 'restaurant', 'coffee', 'lunch', 'snacks']],
  ['health', ['health', 'dental', 'dentist', 'vision', 'medical', 'therapy', 'pharmacy', 'doctor', 'prescription', 'prescriptions']],
  ['school', ['tuition', 'school', 'daycare', 'childcare', 'preschool', 'college', 'lessons']],
];

/** Accounts whose kind says it all: a name never changes their icon. */
const plainKinds = new Set(['checking', 'card', 'investment', 'retirement', 'loan', 'collectible']);

/** The icon a payment's name points to ("Water and sewer" is a drop), or none. */
export function hintOf(kind: string | undefined, name: string | undefined): string | undefined {
  if (!name || (kind && plainKinds.has(kind))) return undefined;
  const w = words(name);
  return hints.find(([, list]) => list.some((h) => w.includes(' ' + h + ' ')))?.[0];
}

export function Mark({ brand, kind, name, type, size }: MarkProps) {
  const b = brand ? brands[brand] : undefined;
  const cls = 'fmark' + (size ? ' ' + size : '');
  if (b?.art) return <span class={cls + ' logo art'} aria-hidden="true"><img src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(b.art)} alt="" /></span>;
  if (b?.letters) return <span class={cls + ' logo mono' + (b.letters.length > 2 ? ' three' : b.letters.length > 1 ? ' two' : '')} style={{ background: b.bg, color: b.ink }} aria-hidden="true">{b.letters}</span>;
  if (b) {
    return (
      <span class={cls + ' logo'} style={{ background: b.bg, color: b.ink }} aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d={b.path!} fill="currentColor" /></svg>
      </span>
    );
  }
  const glyph = (type && type !== 'other' && kindIcons[type] ? type : '') || hintOf(kind, name) || kind;
  const icon = glyph && kindIcons[glyph];
  if (icon) return <span class={cls + ' icon'} data-icon={glyph} aria-hidden="true"><svg viewBox="0 0 24 24"><path d={icon} /></svg></span>;
  return <span class={cls + ' letter'} aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</span>;
}

/** A name in words to match: lower case, + as "plus", & as "and", the rest of the punctuation gone. */
const words = (s: string): string => ' ' + s.toLowerCase().replace(/\+/g, ' plus ').replace(/&/g, ' and ').replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';

/** Names people type for a brand that its own name doesn't cover. */
const aliases: Record<string, string> = {
  'amex': 'americanexpress', 'bofa': 'bankofamerica', 'att': 'atandt', 'hbo': 'max', 'hbo max': 'max', 'prime video': 'amazonprimevideo',
  'prime': 'amazonprime', 'nyt': 'thenewyorktimes', 'ny times': 'thenewyorktimes', 'new york times': 'thenewyorktimes', 'openai': 'chatgpt',
  'anthropic': 'claude', 'game pass': 'xboxgamepass', 'xbox': 'xboxgamepass', 'psn': 'playstation', 'ps plus': 'playstation',
  'comcast': 'xfinity', 'youtube tv': 'youtube', 'youtube premium': 'youtube', 'amc theatres': 'amc', 'a list': 'amc',
  'plex pass': 'plex', 'mullvad': 'mullvad', 'aws': 'aws', 'digital ocean': 'digitalocean', 'nitro': 'discord', 'docker hub': 'docker',
};

/** Each brand's names in words, longest first, so "Amazon Prime Video" wins over "Amazon". */
let named: [string, string][] | undefined;
const brandWords = (): [string, string][] => named ??= [
  ...Object.keys(brands).map((k): [string, string] => [words(brands[k].name), k]),
  ...Object.entries(aliases).map(([a, k]): [string, string] => [words(a), k]),
].filter(([, k]) => brands[k]).sort((a, b) => b[0].length - a[0].length);

/**
 * The brand an account or payment shows: the one picked, else one whose
 * name is in its name, as whole words ("Claude Pro" is Claude; "Maxwell"
 * is not Max). None for a name with no brand in it.
 */
export function brandOf(institution: string | undefined, name: string | undefined): string | undefined {
  if (institution) return institution;
  const w = words(name || '');
  return brandWords().find(([n]) => w.includes(n))?.[1];
}

/** A person's initial in their colour (person-0 … person-3 in style.css); two overlap. */
export function Who({ name, n, size }: { name: string; n: number; size?: 'sm' | 'lg' }) {
  return <span class={`fwho p${n}` + (size ? ' ' + size : '')} aria-hidden="true">{(name || '?').charAt(0).toUpperCase()}</span>;
}

/**
 * The brands for a kind of account's picker, by name: those that fit it
 * (banks for checking, brokers for retirement, makes for a car), then every
 * other bank, broker, and card, for checking at a broker or a card from a
 * bank. A car's and a home's are only their own.
 */
export function brandsFor(kind: string): string[] {
  const want = { checking: ['bank'], savings: ['bank'], card: ['card', 'bank'], investment: ['investment'], retirement: ['investment'], loan: ['bank'], car: ['car'], home: ['home'] }[kind];
  const byName = (list: string[]) => list.sort((a, b) => brands[a].name.localeCompare(brands[b].name));
  const fits = byName(Object.keys(brands).filter((k) => (want ? want.includes(brands[k].kind) : !brands[k].kind || brands[k].kind === 'card')));
  if (!want || kind === 'car' || kind === 'home') return fits;
  const makes = kind === 'loan' ? byName(Object.keys(brands).filter((k) => brands[k].kind === 'car')) : [];
  return [...fits, ...makes, ...byName(Object.keys(brands).filter((k) => ['bank', 'investment', 'card'].includes(brands[k].kind) && !fits.includes(k)))];
}

/** Every brand, for a payment's picker: bills first, then the rest. */
export const allBrands = (): string[] => Object.keys(brands).sort((a, b) => (brands[a].kind ? 1 : 0) - (brands[b].kind ? 1 : 0) || brands[a].name.localeCompare(brands[b].name));

export const brandName = (k: string): string => brands[k]?.name || k;

/** What a subscription can be for, in the order the form lists them. */
export const subTypes: [string, string][] = [['streaming', 'Streaming and music'], ['software', 'Software and apps'], ['cloud', 'Cloud and homelab'], ['gaming', 'Gaming'], ['news', 'News and reading'], ['fitness', 'Fitness'], ['food', 'Food and delivery'], ['phone', 'Phone'], ['other', 'Other']];
export const subTypeName = (t: string): string => subTypes.find(([k]) => k === t)?.[1] || t.charAt(0).toUpperCase() + t.slice(1);

/** The type each brand's subscription mostly is. */
const brandTypes: Record<string, string> = Object.fromEntries(Object.entries({
  streaming: 'netflix spotify youtube max paramountplus disneyplus hulu peacock amazonprimevideo appletv applemusic crunchyroll fubotv tidal pandora deezer amazonmusic audible plex twitch amc',
  software: 'microsoft365 1password bitwarden chatgpt claude duolingo ynab github docker proton',
  cloud: 'icloud googleone dropbox backblaze tailscale cloudflare hetzner digitalocean aws namecheap porkbun mullvad nordvpn synology ring',
  gaming: 'xboxgamepass playstation nintendoswitch discord',
  news: 'thenewyorktimes patreon',
  fitness: 'peloton strava',
  food: 'doordash uber',
  phone: 'verizon tmobile atandt visiblebyverizon mintmobile googlefi usmobile boostmobile',
}).flatMap(([type, list]) => list.split(' ').map((b) => [b, type])));

/** The type a subscription is suggested as: from its brand, else a word in its name; none when neither says. */
export function suggestType(institution: string | undefined, name: string | undefined): string {
  const b = brandOf(institution, name);
  if (b && brandTypes[b]) return brandTypes[b];
  const h = hintOf('subscriptions', name);
  return h === 'music' ? 'streaming' : h && subTypes.some(([k]) => k === h) ? h : '';
}

/** A subscription's type: the one picked, else the one suggested, else other. */
export const typeOf = (x: finance.Payment): string => x.type || suggestType(x.institution, x.name) || 'other';

/** A payment's mark: its brand (picked, or in its name), else its type's or name's glyph, else its kind's icon. */
export function PayMark({ x, size }: { x?: finance.Payment; size?: 'sm' | 'lg' }) {
  return <Mark brand={brandOf(x?.institution, x?.name)} kind={x?.kind} name={x?.name || '?'} type={x?.kind === 'subscriptions' ? x?.type : undefined} size={size} />;
}
