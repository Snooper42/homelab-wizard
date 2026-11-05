// Remember where you were: each screen keeps how far down it was scrolled
// and which of its sections were open (its own <details> with an ID, not
// the log boxes), between visits and after quitting, on this device.
// Leaving a screen keeps its place; coming back puts it back, once the
// screen has drawn enough to scroll that far, unless you scroll first.
// An app's page is left out: each app's is its own.
import { $1 } from './core';

const key = 'homelab.place';
/** The screens that keep a place. */
const kept = new Set(['choose', 'status', 'backups', 'setup', 'settings', 'finances', 'tidy']);

interface Place { top: number; open: string[]; shut: string[] }
let places: Record<string, Place> = {};
try { places = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { places = {}; }

const sections = (screen: string) => [...document.querySelectorAll<HTMLDetailsElement>(`#${screen} details[id]:not(.jobdetails)`)];
const main = () => $1('main') as HTMLElement;

// A place being put back, not reached yet (the screen still drawing): leaving keeps it, not where the screen got to.
let aiming = { screen: '', top: 0 };

/** Keeps where screen is: its scroll and its open sections. */
export function leavePlace(screen: string | undefined) {
  if (!screen || !kept.has(screen)) return;
  const all = sections(screen);
  places[screen] = { top: aiming.screen === screen ? aiming.top : Math.round(main().scrollTop), open: all.filter((d) => d.open).map((d) => d.id), shut: all.filter((d) => !d.open).map((d) => d.id) };
  try { localStorage.setItem(key, JSON.stringify(places)); } catch { /* not kept */ }
}

let stop = () => {};
let anchorTimer = 0;

/** Puts screen back where it was, or at its top the first time. */
export function arrivePlace(screen: string) {
  stop();
  // The place was kept with the screen drawn whole: while it fills in again, the browser's scroll anchoring
  // would shift it by what is drawn above, against nodes still being replaced. Off for a moment, it stays put.
  clearTimeout(anchorTimer);
  main().style.overflowAnchor = 'none';
  anchorTimer = window.setTimeout(() => { main().style.overflowAnchor = ''; }, 2000);
  const m = main(), p = kept.has(screen) ? places[screen] : undefined;
  if (p) {
    for (const d of sections(screen)) {
      if (p.open.includes(d.id)) d.open = true;
      else if (p.shut.includes(d.id)) d.open = false;
    }
  }
  const want = p?.top || 0;
  m.scrollTop = want;
  if (!want || m.scrollTop >= want - 1) return;
  // Not drawn that far yet (its data is still coming): try again for a moment, unless you scroll first, or
  // the screen scrolls itself somewhere (a sidebar balance to its group's card).
  aiming = { screen, top: want };
  let tries = 0, set = m.scrollTop;
  const yours = () => stop();
  const moved = () => { if (Math.abs(m.scrollTop - set) > 1) stop(); };
  const timer = setInterval(() => {
    m.scrollTop = want;
    set = m.scrollTop;
    if (set >= want - 1 || ++tries >= 20) stop();
  }, 100);
  const input = ['wheel', 'touchstart', 'keydown', 'mousedown'];
  for (const e of input) m.addEventListener(e, yours, { passive: true });
  m.addEventListener('scroll', moved, { passive: true });
  stop = () => {
    aiming = { screen: '', top: 0 };
    clearInterval(timer);
    for (const e of input) m.removeEventListener(e, yours);
    m.removeEventListener('scroll', moved);
    stop = () => {};
  };
}
