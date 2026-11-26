
const key = 'homelab.statusSeen';

/** Each app's state as Status last showed it, by app ID. */
export type Seen = Record<string, { state: string; since?: string; updatedAt?: string }>;

/** What you last saw, or null when nothing was kept (the first visit, a private window). */
export function loadSeen(): Seen | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as Seen) : null;
  } catch {
    return null;
  }
}

/** Keeps the apps as they are now as what you saw. */
export function saveSeen(apps: api.AppStatus[]) {
  const seen: Seen = Object.fromEntries(apps.map((a) => [a.id, { state: a.state, since: a.since, updatedAt: a.updatedAt }]));
  try { localStorage.setItem(key, JSON.stringify(seen)); } catch { /* not kept */ }
}

/** How an app changed since it was seen, in a few words, or "" when it did not (or was not there to see). */
export function changedSince(a: api.AppStatus, seen: Seen | null): string {
  const was = seen?.[a.id];
  if (!was) return '';
  const up = (s: string) => s === 'running';
  if (up(was.state) && !up(a.state)) return 'Stopped since you looked';
  if (!up(was.state) && up(a.state)) return 'Started since you looked';
  if (!up(a.state) || !a.since || !was.since || a.since === was.since) return '';
  return a.updatedAt && a.updatedAt !== was.updatedAt ? 'Updated since you looked' : 'Restarted since you looked';
}
