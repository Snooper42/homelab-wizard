// Formatting shared by the screens.

/** A yearly sum in whole dollars: "$3,292". */
export const dollars = (v: number): string => '$' + Math.round(v).toLocaleString('en-US');

/** A time Go left unset ("0001-01-01…"), or none. */
export const never = (t?: string): boolean => !t || t.startsWith('0001-');

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
