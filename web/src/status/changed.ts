// What changed since you looked: each app as you last saw it on Status
// (its state, when it started, its last update), kept on this device when
// you leave Status (an app's page counts as Status). On the next visit, a
// row whose app changed meanwhile has a dot saying how: restarted,
// updated, stopped, started. Leaving Status again clears them, since you
// have seen them. The first visit on a device has nothing to compare.

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
