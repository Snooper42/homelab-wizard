// Every pop-up whole, in sight and on top (the owner, Nov 25: "hunt for this across the application").
//
// A fixed pop-up (a hover card, a right-click menu) is placed in the window's
// pixels, as getBoundingClientRect measures them; but the text size scales
// html (zoom), and a transformed ancestor (a sheet) moves a fixed child's
// origin, so the left and top it is given land elsewhere. putAt measures
// both and lands it where it was meant to go. fitMenu keeps a menu that
// opens under its button inside the window and beside the sidebar: turned
// to the button's other edge, opened upward, or, with room neither way,
// scrolled within the larger side.

/** Places a position:fixed element's top-left corner at (left, top) in the window, whatever the zoom or its containing block. */
export function putAt(el: HTMLElement, left: number, top: number) {
  el.style.left = '0px';
  el.style.top = '0px';
  const o = el.getBoundingClientRect();
  el.style.left = '100px';
  el.style.top = '100px';
  const p = el.getBoundingClientRect();
  const kx = (p.left - o.left) / 100 || 1, ky = (p.top - o.top) / 100 || 1;
  el.style.left = `${(left - o.left) / kx}px`;
  el.style.top = `${(top - o.top) / ky}px`;
}

/** Puts a fixed pop-up at (x, y), moved left or up so it stays whole inside the window; `up` is where it goes when there's no room below (default: ending at y). */
export function putInside(el: HTMLElement, x: number, y: number, up?: number) {
  const pad = 8;
  const r = el.getBoundingClientRect();
  const left = Math.max(pad, Math.min(x, innerWidth - r.width - pad));
  let top = y;
  if (y + r.height > innerHeight - pad) top = Math.max(pad, (up ?? y) - r.height);
  putAt(el, left, top);
}

/** The zoom a CSS pixel inside el is drawn at (html's text size). */
function scale(el: HTMLElement) {
  const w = el.offsetWidth;
  return w ? el.getBoundingClientRect().width / w : 1;
}

/**
 * A menu positioned under its button (position:absolute in its wrap, the
 * button's right edge by default): turned to the left edge when it would run
 * past `main` (behind the sidebar) or the window, opened upward when there's
 * no room below, and given a scroll when there's room neither way.
 */
export function fitMenu(m: HTMLElement, button: HTMLElement | null) {
  const s = m.style;
  s.left = s.right = s.top = s.bottom = s.maxHeight = s.overflowY = '';
  const area = (m.closest('main') || document.body).getBoundingClientRect();
  const lo = Math.max(area.left, 0) + 4, hi = Math.min(area.right, innerWidth) - 4;
  let r = m.getBoundingClientRect();
  if (r.left < lo) { s.left = '0'; s.right = 'auto'; r = m.getBoundingClientRect(); }
  if (r.right > hi) { s.right = '0'; s.left = 'auto'; r = m.getBoundingClientRect(); }
  if (r.left < lo) { s.left = '0'; s.right = 'auto'; } // Wider than the room: its start in sight.
  const b = (button || m.parentElement!).getBoundingClientRect();
  const below = innerHeight - b.bottom - 12, above = b.top - 12;
  if (r.height <= below) return;
  const k = scale(m);
  if (r.height <= above || above > below) {
    s.top = 'auto';
    s.bottom = 'calc(100% + 6px)';
    if (r.height > above) { s.maxHeight = `${above / k}px`; s.overflowY = 'auto'; }
  } else {
    s.maxHeight = `${below / k}px`;
    s.overflowY = 'auto';
  }
}
