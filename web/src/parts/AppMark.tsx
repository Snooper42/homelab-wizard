// An app's mark: the logo the app ships for it, else its own icon, else its first letter (an app's page; Status's
// categories, small), in that order as the iPhone app's AppIconView.

import { useState } from 'preact/hooks';
import { appLogos } from '../status/appLogos';

/** The app whose logo an id shows: its own, else, for a helper (immich-database, paperless-db, moneymatter-db), its app's. */
export function logoId(id?: string): string {
  if (!id) return '';
  if (appLogos.has(id)) return id;
  for (let base = id; base.includes('-');) {
    base = base.slice(0, base.lastIndexOf('-'));
    for (const c of [base, base + '-server', base + '-frontend']) if (appLogos.has(c)) return c;
  }
  return '';
}

/** The logo shipped for an app (web/dist/applogos, the iPhone app's set), or '' when there's none. */
export const shippedLogo = (id?: string) => { const l = logoId(id); return l ? `applogos/${l}.png` : ''; };

/** The app's own icon in a tile, or its first letter when it has none
 * (or the picture cannot be drawn). A favicon of 24 pixels or less is
 * drawn larger with sharp pixels rather than blurred; a home screen icon
 * (a picture of 120 pixels or more) fills the tile, as on a phone. */
export function AppMark({ name, icon: own, small, id, quiet }: { name: string; icon: string; small?: boolean; id?: string;
  /** Its letter drawn by the stylesheet, out of the text (an app's row on Status, whose words the row's text is). */
  quiet?: boolean }) {
  // The shipped logo first (the owner, Nov 24: logos, not letters, on Status), then the icon the computer kept from the app.
  const shipped = shippedLogo(id), icon = shipped || own;
  const [broken, setBroken] = useState('');
  // How the picture is drawn, for the icon it was measured on.
  const [drawn, setDrawn] = useState({ of: '', size: '' });
  if (!icon || broken === icon) {
    return quiet ? <span class={'appmark quiet' + (small ? ' mini' : '')} aria-hidden="true" data-letter={name.slice(0, 1)} />
      : <span class={'appmark' + (small ? ' mini' : '')} aria-hidden="true">{name.slice(0, 1)}</span>;
  }
  const picture = /^data:image\/(png|jpeg|webp)/.test(icon), size = drawn.of === icon ? drawn.size : '';
  const measure = (w: number) => setDrawn({ of: icon, size: w > 0 && w <= 24 && !icon.startsWith('data:image/svg') ? 'small' : picture && w >= 120 ? 'fill' : '' });
  return (
    // A shipped logo is a whole rounded tile already (as the iPhone's): it fills the mark.
    <span class={'appmark icon' + (size === 'fill' || (shipped && icon === shipped) ? ' fill' : '') + (small ? ' mini' : '')} aria-hidden="true">
      <img src={icon} alt="" class={size === 'small' ? 'small' : ''} onError={() => setBroken(icon)}
        onLoad={(e) => measure((e.currentTarget as HTMLImageElement).naturalWidth)} />
    </span>
  );
}
