// Stop for a while: the times it offers, and how a row says an app was
// stopped on purpose. The backend keeps the stop (internal/stopped) and
// starts the app again when its time comes.
import { clockText, dayText } from '../format';

export interface StopChoice {
  /** For an hour, Until 9:00 PM tonight, Until 8:00 AM tomorrow. */
  label: string;
  /** When it starts again, as homelab stop --until takes it. */
  until: string;
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const at = (now: Date, days: number, hour: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour);

/** The times Stop for a while offers: an hour from now, 9 PM tonight while
 * that is over an hour away, and 8 AM (this morning when it is still early). */
export function stopChoices(now = new Date()): StopChoice[] {
  const hour = new Date(now.getTime() + 36e5);
  hour.setSeconds(0, 0);
  const out: StopChoice[] = [{ label: 'For an hour', until: iso(hour) }];
  const tonight = at(now, 0, 21);
  if (tonight.getTime() - now.getTime() > 36e5) out.push({ label: `Until ${clockText(tonight)} tonight`, until: iso(tonight) });
  const early = now.getHours() < 6;
  const morning = at(now, early ? 0 : 1, 8);
  out.push({ label: `Until ${clockText(morning)}${early ? '' : ' tomorrow'}`, until: iso(morning) });
  return out;
}

/** Stopped by the watchdog, after Docker restarted it over and over: unlike
 * one stopped by you, it needs a look (its log says why). */
export const keptRestarting = (s?: stopped.Stop) => s?.why === 'restarting';

/** What a row says of an app stopped on purpose: "Stopped by you", or
 * "Stopped until 9:00 PM", "until tomorrow, 8:00 AM", "until Fri, 8:00 AM";
 * one the watchdog stopped, "Stopped: it restarted 5 times in an hour". */
export function stoppedWords(s: stopped.Stop, now = new Date()): string {
  if (keptRestarting(s)) return `Stopped: it restarted ${s.restarts || 'many'} times in an hour`;
  if (!s.until) return 'Stopped by you';
  const t = new Date(s.until);
  const days = Math.round((at(t, 0, 0).getTime() - at(now, 0, 0).getTime()) / 864e5);
  const day = days <= 0 ? '' : days === 1 ? 'tomorrow, ' : dayText(t, { weekday: 'short' }) + ', ';
  return `Stopped until ${day}${clockText(t)}`;
}

/** When an app that wasn't stopped from here stopped, and why when Docker
 * knows: "Stopped at 3:12 AM: it ran out of memory", "Stopped yesterday,
 * 9:40 PM", "Stopped Tue, 9:40 PM", "Stopped Oct 28"; just "Stopped"
 * when Docker didn't say when. */
export function stoppedByItself(a: { stoppedAt?: string; stoppedWhy?: string }, now = new Date()): string {
  let when = '';
  if (a.stoppedAt) {
    const t = new Date(a.stoppedAt);
    const days = Math.round((at(now, 0, 0).getTime() - at(t, 0, 0).getTime()) / 864e5);
    when = days <= 0 ? ` at ${clockText(t)}` : days === 1 ? ` yesterday, ${clockText(t)}` : days < 7 ? ` ${dayText(t, { weekday: 'short' })}, ${clockText(t)}` : ` ${dayText(t, { month: 'short', day: 'numeric' })}`;
  }
  return `Stopped${when}${a.stoppedWhy ? ': ' + a.stoppedWhy : ''}`;
}

/** What to do about an app that isn't running, for its page: why it
 * stopped, when its state doesn't say so already, and what helps with the
 * buttons a computer (or a phone that may make changes) has. Nothing for
 * one that runs. */
export function stoppedNext(a: { state: string; stoppedWhy?: string; waitingFor?: string }, held?: stopped.Stop, paused = false, now = new Date()): [why: string, todo: string] {
  if (a.state !== 'stopped') return ['', ''];
  if (held && keptRestarting(held)) return ['The watchdog stopped it after Docker restarted it again and again; its log below says why.', 'Once that is put right, Start tries again.'];
  if (held?.until) return [`You stopped it until ${stoppedWords(held, now).replace(/^Stopped until /, '')}: it starts again by itself then.`, 'Or Start it now.'];
  if (held) return ['You stopped it, so nothing starts it by itself.', 'Start starts it again.'];
  if (paused) return ['Paused while this computer is on battery: it starts again by itself once it is plugged in.', ''];
  if (a.waitingFor) return [`Its folders are on the ${a.waitingFor.replace(/^\/Volumes\//, '')} drive: plug it in and it starts by itself.`, ''];
  const port = a.stoppedWhy?.match(/port (\d+)$/)?.[1];
  if (port) return [`Another program has port ${port}.`, 'Quit it, then Start.'];
  switch (a.stoppedWhy) {
    case 'it ran out of memory': return ["If it runs out again, stop an app you aren't using, or give Docker more memory.", 'Start tries again.'];
    case "Docker couldn't start it": return ['Its log below may say why.', 'Start tries again.'];
    case 'it quit with an error': return ['If it stops again, its log below says why.', 'Start tries again.'];
  }
  return ['It was stopped outside the homelab (by Docker, or a shutdown).', 'Start starts it again.'];
}
