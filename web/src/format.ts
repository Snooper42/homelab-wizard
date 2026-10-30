// Formatting shared by the screens.

/** A yearly sum in whole dollars: "$3,292". */
export const dollars = (v: number): string => '$' + Math.round(v).toLocaleString('en-US');

/** Dates and times in the app's own language, English, in the order and with
 * the clock the system uses: "18 Oct, 15:25" in most places, "Oct 18, 3:25 PM"
 * where months come first. The system's own words ("Dienstag", "10月18日")
 * would sit oddly in English sentences. */
const monthFirst = /^12/.test(new Date(2000, 11, 31).toLocaleDateString());
const hourCycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
export const dateLocale = monthFirst ? 'en-US' : 'en-GB';
const hour12 = hourCycle === 'h11' || hourCycle === 'h12';
/** A date in those words: dayText(d, { day: 'numeric', month: 'short' }) is "18 Oct". */
export const dayText = (d: Date, o: Intl.DateTimeFormatOptions): string => d.toLocaleDateString(dateLocale, o);
/** A time of day on the system's clock: "15:25" or "3:25 PM". */
export const clockText = (d: Date): string => d.toLocaleTimeString(dateLocale, { hour: 'numeric', minute: '2-digit', hour12 });
/** A date and time: "18 Oct 2026, 15:25". */
export const dateTimeText = (d: Date): string => d.toLocaleString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12 });

/** A time Go left unset ("0001-01-01…"), or none. */
export const never = (t?: string): boolean => !t || t.startsWith('0001-');

/** "1.2 MB", in powers of 1024 as file sizes are; "—" for none. */
export function bytes(n: number): string {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** How long ago t was: "just now", "3 hours ago", "yesterday". */
export function ago(t?: string): string {
  if (never(t)) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(t!).getTime()) / 60000));
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** "in 6 hours", "tomorrow", "in 3 days" for a time ahead. */
export function untilText(t: string): string {
  const mins = Math.round((new Date(t).getTime() - Date.now()) / 60000);
  if (mins <= 1) return 'now';
  if (mins < 60) return `in ${mins} minutes`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? 'in an hour' : `in ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}
