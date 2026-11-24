// An app's mark: its own icon, or its first letter (an app's page; Status's categories, small).

import { useState } from 'preact/hooks';

/** The app's own icon in a tile, or its first letter when it has none
 * (or the picture cannot be drawn). A favicon of 24 pixels or less is
 * drawn larger with sharp pixels rather than blurred; a home screen icon
 * (a picture of 120 pixels or more) fills the tile, as on a phone. */
export function AppMark({ name, icon, small }: { name: string; icon: string; small?: boolean }) {
  const [broken, setBroken] = useState('');
  // How the picture is drawn, for the icon it was measured on.
  const [drawn, setDrawn] = useState({ of: '', size: '' });
  if (!icon || broken === icon) return <span class={'appmark' + (small ? ' mini' : '')} aria-hidden="true">{name.slice(0, 1)}</span>;
  const picture = /^data:image\/(png|jpeg|webp)/.test(icon), size = drawn.of === icon ? drawn.size : '';
  const measure = (w: number) => setDrawn({ of: icon, size: w > 0 && w <= 24 && !icon.startsWith('data:image/svg') ? 'small' : picture && w >= 120 ? 'fill' : '' });
  return (
    <span class={'appmark icon' + (size === 'fill' ? ' fill' : '') + (small ? ' mini' : '')} aria-hidden="true">
      <img src={icon} alt="" class={size === 'small' ? 'small' : ''} onError={() => setBroken(icon)}
        onLoad={(e) => measure((e.currentTarget as HTMLImageElement).naturalWidth)} />
    </span>
  );
}
