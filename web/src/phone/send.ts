// Send to my phone (unison-handoff.md item 7; the owner, Nov 12: pick a
// phone each time, never a wall screen). On the computer: the paired phones
// a page can go to, read once and again as a menu opens, and the send. On
// the phone's page: a send from the computer shows at the bottom with Open,
// which goes to that page.
import { go, onPhone } from '../core';
import { showNote } from '../status/UndoNote';

let targets: app.SendTarget[] = [];
let reading: Promise<void> | null = null;

/** Reads the phones again (the list a menu shows is the last one read). */
export function readTargets(): Promise<void> {
  if (onPhone()) return Promise.resolve();
  reading ??= Promise.resolve().then(() => go().SendTargets()).then((t) => { targets = t || []; }, () => {}).finally(() => { reading = null; });
  return reading;
}

/** The phones link can go to: a member's only Status and their own apps, Finances only to a phone that sees them. */
export function targetsFor(link: string): app.SendTarget[] {
  void readTargets();
  const page = link.replace(/^homelab:\/\//, '');
  return targets.filter((t) => {
    if (t.member) return page === 'status' || (page.startsWith('app/') && (!t.apps?.length || t.apps.includes(page.slice(4))));
    return page === 'finances' || page.startsWith('finances/') ? !!t.finances : true;
  });
}

/** Sends link to t; resolves to what to say ("Sent to Sam's iPhone"). */
export async function sendTo(t: app.SendTarget, link: string, title: string): Promise<string> {
  await go().SendToPhone(t.id, link, title);
  return `Sent to ${t.name}`;
}

/** The pages a link can open on the phone's page, by what follows homelab://. */
export function placeOf(link: string): { screen: string; app?: string; tab?: string } | null {
  const page = link.replace(/^homelab:\/\//, '');
  if (page === 'status' || page === 'backups' || page === 'finances') return { screen: page };
  if (page.startsWith('finances/')) return { screen: 'finances', tab: page.slice(9) };
  if (/^app\/[a-z0-9][a-z0-9_-]*$/.test(page)) return { screen: 'app', app: page.slice(4) };
  return null;
}

/** On the phone's page: a page the computer sent, at the bottom, with Open. */
export function showSent(o: { link: string; title?: string }, open: (p: NonNullable<ReturnType<typeof placeOf>>) => void) {
  const p = placeOf(o.link);
  if (!p) return;
  showNote(`From the computer: ${o.title || 'a page'}`, 'Open', () => open(p));
}
