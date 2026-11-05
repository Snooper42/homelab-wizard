// What happened overnight: Status's first line in the morning (5 AM to
// noon), about the night since 8 PM: "Overnight: 4 apps updated, 1 rolled
// back, a backup of 2.1 GB, nothing needed you." Built from what Status
// already has: each app's update, the alerts (a rollback says so), the
// night's database copies, and the watchdog's outages. Hide until tomorrow
// keeps it away for the day, on this device.
import { render } from 'preact';
import { bytes } from '../format';

export interface Night {
  /** Now, in ms. */
  now: number;
  apps: api.AppStatus[];
  /** Recent alerts (ntfy's), newest first or not. */
  events: notify.Event[];
  /** Each app's times down this week (the watchdog's). */
  outages: Record<string, health.Outage[]>;
  /** The database copies, each with its newest (Backups); null while not read. */
  copies: backup.Copy[] | null;
  /** The watchdog's last run was read: only then can it say nothing needed you. */
  watched: boolean;
}

/** The night it is about: 8 PM yesterday until now; null outside the morning (5 AM to noon). */
export function nightOf(now: number): [number, number] | null {
  const d = new Date(now);
  if (d.getHours() < 5 || d.getHours() >= 12) return null;
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 20).getTime();
  return [from, now];
}

/** The line, or null when it is not the morning (or there is nothing to say yet). */
export function overnightWords(n: Night): string | null {
  const night = nightOf(n.now);
  if (!night) return null;
  const [from, to] = night;
  const within = (t?: string) => { const ms = t ? new Date(t).getTime() : NaN; return ms >= from && ms <= to; };
  const parts: string[] = [];
  const updated = n.apps.filter((a) => within(a.updatedAt));
  if (updated.length) parts.push(updated.length === 1 ? `${updated[0].name} updated` : `${updated.length} apps updated`);
  const back = n.events.filter((e) => within(e.time) && (e.tags?.includes('rewind') || /rolled back/i.test(e.title || '')));
  if (back.length) parts.push(`${back.length} rolled back`);
  if (n.copies) {
    const made = n.copies.filter((c) => within(c.newest));
    const size = made.reduce((t, c) => t + (c.size || 0), 0);
    if (made.length) parts.push(size > 0 ? `a backup of ${bytes(size)}` : 'the backup ran');
  }
  // What needed you: an app down overnight (the watchdog's outages), or an alert that asked for a look.
  const down = Object.entries(n.outages).filter(([, list]) => list.some((o) => (o.to ? new Date(o.to).getTime() : to) >= from && new Date(o.from).getTime() <= to));
  const loud = n.events.filter((e) => within(e.time) && (e.priority || 3) >= 4 && !back.includes(e));
  if (down.length) {
    const name = n.apps.find((a) => a.id === down[0][0])?.name || down[0][0];
    parts.push(down.length === 1 ? `${name} was down for a while` : `${down.length} apps were down for a while`);
  } else if (loud.length) {
    parts.push(loud.length === 1 ? '1 alert to look at' : `${loud.length} alerts to look at`);
  } else if (n.watched) {
    parts.push('nothing needed you');
  }
  return parts.length ? 'Overnight: ' + parts.join(', ') + '.' : null;
}

const key = 'homelab.overnightHidden';
const today = (now: number) => new Date(now).toDateString();
let hiddenOn = ''; // the day hidden, when this device cannot keep it
const hiddenToday = (now: number) => { if (hiddenOn === today(now)) return true; try { return localStorage.getItem(key) === today(now); } catch { return false; } };

function Overnight({ words, hide }: { words: string; hide: () => void }) {
  return (
    <p class="overnight" role="status">
      <span>{words}</span>
      <button type="button" class="linkbtn" onClick={hide}>Hide until tomorrow</button>
    </p>
  );
}

/** Draws the line into el, or nothing outside the morning, before the night can be told, or once hidden today. */
export function mountOvernight(el: HTMLElement, n: Night) {
  const words = hiddenToday(n.now) ? null : overnightWords(n);
  el.hidden = !words;
  const hide = () => { hiddenOn = today(Date.now()); try { localStorage.setItem(key, hiddenOn); } catch { /* for this run only */ } mountOvernight(el, n); };
  render(words ? <Overnight words={words} hide={hide} /> : null, el);
}
