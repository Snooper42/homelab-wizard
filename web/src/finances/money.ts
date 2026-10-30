// Money and dates as the Finances screen writes them, and what it looks
// up in the plan by ID.
import { dayText } from '../format';

/** "$1,234.56"; "−$12.00" below nothing. */
export const money = (n: number): string => (n < -0.005 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "+$12.00" or "−$12.00". */
export const signed = (n: number): string => (n < -0.005 ? '−' : '+') + money(Math.abs(n));

/** The dollars and the cents apart, to set the cents smaller: ["$1,234", ".56"]. */
export function split(n: number): [string, string] {
  const s = money(n), i = s.lastIndexOf('.');
  return [s.slice(0, i), s.slice(i)];
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

/** Today as YYYY-MM-DD, here. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "3 payments", "1 payment". */
export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "1st", "22nd". */
export const ordinal = (n: number): string => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

/** How often, in words: "Monthly on the 1st", "Every other Friday". */
export function scheduleText(s: finance.Schedule): string {
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

/** How many times a month it comes, on average. */
export const perMonth = (s: finance.Schedule): number => ({ week: 52 / 12, '2 weeks': 26 / 12, 'twice a month': 2, month: 1, '3 months': 1 / 3, year: 1 / 12 })[s?.every] || 0;

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

/** Whether an account kind is a debt (what it holds is owed). */
export const owed = (kind: string): boolean => kind === 'card' || kind === 'loan';
