
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
