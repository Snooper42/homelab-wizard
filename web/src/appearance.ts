// Settings › Appearance on the page: the theme and the contrast switch the
// stylesheet's own dark and more-contrast blocks on or off (so style.css
// keeps one copy of each), the accent replaces the platform's or the
// system's, Islands sets the sidebar and the page apart as panels, and
// Motion and Transparency set html.motion-less, motion-none, and no-blur,
// which every animation, transition, and blur in style.css follows.

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
/** WCAG contrast between two colours, 1 to 21. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** The accent as link text: itself when it reads at 4.5:1 on the darkest
 *  light page (or the lightest dark one) tinted with the accent as
 *  --accent-soft is, else darkened (lightened) until it does, so a picked
 *  yellow still gives readable links. */
export function linkOn(hex: string, dark: boolean) {
  const page = dark ? mix('#36363a', hex, 0.15) : mix('#e6e6ea', hex, 0.1);
  let c = hex;
  for (let i = 1; contrast(c, page) < 4.5 && i <= 20; i++) c = mix(hex, dark ? '#ffffff' : '#000000', i * 0.05);
  return c;
}
/** A filled button in the accent: dark text on a light accent (the Mac's
 *  yellow), else white text on the accent darkened until it reads. */
export function primaryOn(hex: string, text?: string): [string, string] {
  if (luminance(hex) > 0.4) return [hex, text || '#0b0f19'];
  let c = hex;
  for (let i = 1; contrast(c, '#ffffff') < 4.5 && i <= 20; i++) c = mix(hex, '#000000', i * 0.05);
  return [c, '#ffffff'];
}
const setPrimary = (root: HTMLElement, name: string, hex: string, text?: string) => {
  const [bg, fg] = primaryOn(hex, text);
  root.style.setProperty(`--${name}`, bg);
  root.style.setProperty(`--${name}-text`, fg);
};

// The system's own "reduce motion" and "reduce transparency", followed live
// while Motion or Transparency is Like the system.
const query = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q) : null);
const reduceMotion = query('(prefers-reduced-motion: reduce)');
const reduceTransparency = query('(prefers-reduced-transparency: reduce)');
let lastLook: tray.Appearance | null = null;
const follow = () => { if (lastLook) applyMotion(lastLook); };
reduceMotion?.addEventListener?.('change', follow);
reduceTransparency?.addEventListener?.('change', follow);

/** Sets motion-less (no movement), motion-none (nothing moves), and no-blur on the page. */
export function applyMotion(look: tray.Appearance) {
  lastLook = look;
  const root = document.documentElement;
  const motion = look.motion === 'none' ? 'none' : look.motion === 'less' || reduceMotion?.matches ? 'less' : 'full';
  root.classList.toggle('motion-less', motion !== 'full');
  root.classList.toggle('motion-none', motion === 'none');
  root.classList.toggle('no-blur', look.transparency === 'off' || !!reduceTransparency?.matches);
}

/** Draws the page in look; sys is the accent the system gave, if any (Host). */
export function applyAppearance(look: tray.Appearance, sys?: app.Accent) {
  const root = document.documentElement;
  force(look.theme, look.contrast);
  applyMotion(look);
  root.classList.toggle('islands', look.layout === 'islands');
  root.classList.toggle('user-accent', !!look.accent);
  root.classList.toggle('sys-accent', !!sys && !look.accent);
  if (sys && !look.accent) {
    root.style.setProperty('--sys-accent-light', sys.light);
    root.style.setProperty('--sys-accent-dark', sys.dark);
    root.style.setProperty('--sys-link-light', linkOn(sys.light, false));
    root.style.setProperty('--sys-link-dark', linkOn(sys.dark, true));
    setPrimary(root, 'sys-primary-light', sys.light, sys.text);
    setPrimary(root, 'sys-primary-dark', sys.dark, sys.text);
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
    root.style.setProperty('--user-link-light', linkOn(look.accent, false));
    root.style.setProperty('--user-link-dark', linkOn(dark, true));
    setPrimary(root, 'user-primary-light', look.accent);
    setPrimary(root, 'user-primary-dark', dark);
  }
}
