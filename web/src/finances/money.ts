// Money and dates as the Finances screen writes them, and what it looks
// up in the plan by ID.
import { dayText } from '../format';

// The plan's currency (an ISO 4217 code), set as the screen draws.
let format = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
let code = 'USD';
/** Writes amounts in a currency from now on (USD when empty or unknown). */
export function setCurrency(c?: string) {
  const want = (c || 'USD').toUpperCase();
  if (want === code) return;
  try {
    format = new Intl.NumberFormat('en-US', { style: 'currency', currency: want });
    code = want;
  } catch { /* an unknown code: keep the last */ }
}
/** The currency's sign alone: "$", "€", "£", "CA$". */
export const currencySign = (): string => format.formatToParts(0).find((p) => p.type === 'currency')?.value || '$';

/** "$1,234.56"; "−$12.00" below nothing; "€1,234.56" in euros. */
export const money = (n: number): string => (n < -0.005 ? '−' : '') + format.format(Math.abs(n));

/** Whole units: "$1,235", "−$12". */
export const whole = (n: number): string => (n <= -0.5 ? '−' : '') + currencySign() + Math.round(Math.abs(n)).toLocaleString('en-US');

/** An axis label: "$750k", "$2.5k", "$1.2M", "−$250k", "$0". */
export function tick(n: number): string {
  const a = Math.abs(n), sign = n <= -0.5 ? '−' : '';
  const trim = (x: number) => String(+x.toFixed(2));
  return sign + currencySign() + (a >= 1e6 ? `${trim(a / 1e6)}M` : a >= 1e3 ? `${trim(a / 1e3)}k` : String(Math.round(a)));
}

/** Short, for a list of totals or an axis: "$812", "$9.01k", "$428.5k", "$1.24M". */
export function compact(n: number): string {
  const a = Math.abs(n), sign = n <= -0.5 ? '−' : '';
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}k` : a >= 1e3 ? `${(a / 1e3).toFixed(2)}k` : String(Math.round(a));
  return sign + currencySign() + s;
}

/**
 * An amount as typed: "$1,234.56", "1.234,56", "1 234,56", "-40". The
 * decimal mark is the last . or , with one or two digits after it; any
 * other . , space, or currency sign groups thousands. NaN for nothing.
 */
export function parseAmount(typed: string): number {
  let t = String(typed ?? '').replace(/[\s\u00a0\u202f']/g, '').replace(/[^0-9.,\-−]/g, '').replace('−', '-');
  const mark = t.search(/[.,]\d{1,2}$/);
  if (mark >= 0) t = t.slice(0, mark).replace(/[.,]/g, '') + '.' + t.slice(mark + 1);
  else t = t.replace(/[.,]/g, '');
  return t === '' || t === '-' ? NaN : parseFloat(t);
}

/** Rounded to the cent. */
export const cents = (n: number): number => Math.round(n * 100) / 100;

/** "+$12.00" or "−$12.00". */
export const signed = (n: number): string => (n < -0.005 ? '−' : '+') + money(Math.abs(n));

/** The dollars and the cents apart, to set the cents smaller: ["$1,234", ".56"] (no cents in yen). */
export function split(n: number): [string, string] {
  const s = money(n), i = s.lastIndexOf('.');
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i)];
}

/** A YYYY-MM-DD day at midnight here. */
export const parseDay = (s: string): Date => new Date(s + 'T00:00:00');

/** "Fri 6 Nov" or "Fri, Nov 6", as the system orders them. */
export const dayLong = (s: string): string => dayText(parseDay(s), { weekday: 'short', day: 'numeric', month: 'short' });

/** "6 Nov" or "Nov 6". */
export const dayShort = (s: string): string => dayText(parseDay(s), { day: 'numeric', month: 'short' });

/** A month's name: "December". */
export const monthName = (s: string): string => dayText(parseDay(s), { month: 'long' });

/** Days from a to b, both YYYY-MM-DD. */
export const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 864e5);

/** A day as YYYY-MM-DD, here (not in UTC, as toISOString would). */
export const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today as YYYY-MM-DD, here. */
export const todayISO = (): string => isoDay(new Date());

/** "3 payments", "1 payment". */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "1st", "22nd". */
export const ordinal = (n: number): string => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

/** How often, in words: "Monthly on the 1st", "Every other Friday", "With each of Alex's paychecks". */
export function scheduleText(s: finance.Schedule, L?: Lookup): string {
  if (s?.every === 'paycheck') {
    const who = L?.person[s.person]?.name;
    return who ? `With each of ${who}'s paychecks` : 'With each paycheck';
  }
  if (!s?.start) return '';
  const d = parseDay(s.start);
  const weekday = dayText(d, { weekday: 'long' });
  switch (s.every) {
    case 'once': return 'Once, ' + dayShort(s.start);
    case 'week': return 'Every ' + weekday;
    case '2 weeks': return 'Every other ' + weekday;
    case 'twice a month': return `The ${ordinal(d.getDate())} and ${ordinal(s.day2 || 15)}`;
    case 'month': return 'Monthly on the ' + ordinal(d.getDate());
    case '3 months': return 'Every 3 months on the ' + ordinal(d.getDate());
    case 'year': return 'Yearly on ' + dayShort(s.start);
  }
  return s.every;
}

/** How many times a month it comes, on average: with each paycheck, as often as that person is paid. */
export function perMonth(s: finance.Schedule, people?: finance.Earner[]): number {
  if (s?.every === 'paycheck') return perMonth((people || []).find((e) => e.id === s.person)?.schedule);
  return ({ week: 52 / 12, '2 weeks': 26 / 12, 'twice a month': 2, month: 1, '3 months': 1 / 3, year: 1 / 12 })[s?.every] || 0;
}

/** The plan's people, accounts, and payments by ID. */
export interface Lookup {
  person: Record<string, finance.Earner>;
  /** Each person's place, for their colour (person-0, person-1, …). */
  order: Record<string, number>;
  account: Record<string, finance.Account>;
  payment: Record<string, finance.Payment>;
}

export function lookup(p: finance.Plan): Lookup {
  const by = <T extends { id: string }>(list: T[]) => Object.fromEntries((list || []).map((x) => [x.id, x])) as Record<string, T>;
  return { person: by(p.people), order: Object.fromEntries((p.people || []).map((e, i) => [e.id, i % 4])), account: by(p.accounts), payment: by(p.payments) };
}

/** Whether money into an account of this kind is kept, not spent: savings, an investment, retirement (finance.Saving). */
export const saving = (kind?: string): boolean => kind === 'savings' || kind === 'investment' || kind === 'retirement';

/** Whether an account kind is a debt (what it holds is owed). */
export const owed = (kind: string): boolean => kind === 'card' || kind === 'loan';
