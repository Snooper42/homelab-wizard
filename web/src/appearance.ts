// Settings › Appearance on the page: the theme and the contrast switch the
// stylesheet's own dark and more-contrast blocks on or off (so style.css
// keeps one copy of each), the accent replaces the platform's or the
// system's, and Islands sets the sidebar and the page apart as panels.

/** The media blocks as written, before a theme or contrast forced them. */
const written = new WeakMap<CSSMediaRule, string>();

function mediaRules(): CSSMediaRule[] {
  const out: CSSMediaRule[] = [];
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; } // a sheet the page may not read
    for (const r of rules) if (r instanceof CSSMediaRule) out.push(r);
  }
  return out;
}

/** Forces each block about the theme or the contrast, or puts it back. */
function force(theme: string, contrast: string) {
  for (const r of mediaRules()) {
    if (!written.has(r)) written.set(r, r.media.mediaText);
    const was = written.get(r)!;
    let now = was;
    if (/prefers-color-scheme:\s*dark/.test(was) && theme !== 'system') now = theme === 'dark' ? 'all' : 'not all';
    if (/prefers-contrast:\s*more/.test(was) && contrast === 'more') now = 'all';
    if (r.media.mediaText !== now) r.media.mediaText = now;
  }
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** a mixed with b, share parts of b. */
export const mix = (a: string, b: string, share: number) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * share));
/** WCAG relative luminance, 0 to 1. */
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** The text that reads on the colour: white, or near-black on a light one. */
export const textOn = (hex: string) => (luminance(hex) > 0.4 ? '#0b0f19' : '#ffffff');

/** Draws the page in look; sys is the accent the system gave, if any (Host). */
export function applyAppearance(look: tray.Appearance, sys?: app.Accent) {
  const root = document.documentElement;
  force(look.theme, look.contrast);
  root.classList.toggle('islands', look.layout === 'islands');
  root.classList.toggle('user-accent', !!look.accent);
  root.classList.toggle('sys-accent', !!sys && !look.accent);
  if (sys && !look.accent) {
    root.style.setProperty('--sys-accent-light', sys.light);
    root.style.setProperty('--sys-accent-dark', sys.dark);
  }
  // Text on the accent, where white would not read (the Mac's yellow).
  if (sys?.text && !look.accent) root.style.setProperty('--accent-text', sys.text);
  else root.style.removeProperty('--accent-text');
  if (look.accent) {
    // On dark, a lighter shade of it, as the systems' own accents are.
    const dark = mix(look.accent, '#ffffff', 0.3);
    root.style.setProperty('--user-accent-light', look.accent);
    root.style.setProperty('--user-accent-dark', dark);
    root.style.setProperty('--user-accent-text-light', textOn(look.accent));
    root.style.setProperty('--user-accent-text-dark', textOn(dark));
  }
}
