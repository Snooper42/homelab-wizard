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
