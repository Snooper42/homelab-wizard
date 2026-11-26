// A screen's own menu in the sidebar, under the strip of the homelab's screens, as Finances' and Tidy Up's (the owner,
// Nov 24: every screen's sidebar the same): an icon and a name each, a count where something waits, the one shown marked.
// Status, Backups, Choose apps and Setup each mount one into their #…Side in index.html; the sidebar shows the one whose
// screen is open. A pick goes straight to its part: no animation.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface SideItem {
  key: string;
  label: string;
  /** A Feather icon's path (24 by 24). */
  icon: string;
  /** How many wait on you here, in the sidebar's amber; none when 0. */
  count?: number;
  /** How many it holds, in grey (Status' categories: their apps); none when 0. */
  total?: number;
  /** One of them wants a look (an app stopped): an amber dot before the total. */
  dot?: boolean;
}

export interface SideMenuProps {
  /** What a screen reader calls the list: "Status". */
  label: string;
  items: SideItem[];
  /** The item marked as shown. */
  here: string;
  pick: (key: string) => void;
}

/** Feather's icons for the menus (feathericons.com, MIT): the catalog's categories by id, and each screen's parts. */
export const sideIcons: Record<string, string> = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  attention: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  pinned: 'M12 17v5M5 17h14l-2-6V4h1V2H6v2h1v7z',
  network: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  security: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  system: 'M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01',
  cloud: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
  documents: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  finance: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  media: 'M2 2h20v20H2zM7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5',
  'media-automation': 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  household: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  other: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM8 12h.01M12 12h.01M16 12h.01',
  backups: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  night: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  restore: 'M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  offsite: 'M3 11h18v11H3zM7 11V7a5 5 0 0 1 10 0v4',
  apps: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  start: 'M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z',
  steps: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  add: 'M12 5v14M5 12h14',
  analytics: 'M3 3v18h18M7 14l4-4 4 4 5-6',
  own: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12',
};

export function SideMenu({ label, items, here, pick }: SideMenuProps) {
  return (
    <ul class="finmenu sidemenulist" aria-label={label}>
      {items.map((it) => (
        <li key={it.key}>
          <button type="button" class={'finmenuitem' + (here === it.key ? ' on' : '')} data-key={it.key} aria-current={here === it.key ? 'page' : undefined} onClick={() => pick(it.key)}>
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={it.icon} /></svg><span>{it.label}</span>{!!it.count && <span class="count">{it.count}</span>}{it.dot && <span class="sidedot" role="img" aria-label="One stopped" />}{!!it.total && <span class="total">{it.total}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The same menu as one button on a phone's narrow page (the owner, Nov 25: "like a drop down menu"): where you are,
 * with a chevron; a tap lists every item, as the sidebar has them, and a pick goes there and closes it. A press
 * anywhere else, or Escape, closes it too. */
export function SideDropdown({ label, items, here, pick }: SideMenuProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector<HTMLButtonElement>('.sidedropbtn')?.focus(); } };
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('touchstart', outside, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside, true); document.removeEventListener('touchstart', outside, true); document.removeEventListener('keydown', esc); };
  }, [open]);
  const now = items.find((i) => i.key === here) || items[0];
  const waiting = items.some((i) => i.dot);
  return (
    <div class={'sidedrop' + (open ? ' open' : '')} ref={wrap}>
      <button type="button" class="sidedropbtn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        {now && <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={now.icon} /></svg>}
        <span>{now?.label}</span>{waiting && !open && <span class="sidedot" role="img" aria-label="One stopped" />}
        <svg class="icon chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <SideMenu label={label} items={items} here={here} pick={(k) => { setOpen(false); pick(k); }} />}
    </div>
  );
}

/** Draws the dropdown into el; null clears it. */
export const mountSideDropdown = (el: Element, props: SideMenuProps | null) => render(props && <SideDropdown {...props} />, el);

/** Draws a screen's menu into its place in the sidebar; null clears it. */
export const mountSideMenu = (el: Element, props: SideMenuProps | null) => render(props && <SideMenu {...props} />, el);

/** Shows the part a menu item names at the top of the screen, at once; the top of the screen for none. */
export function goToPart(screen: string, el: Element | null) {
  if (el) el.scrollIntoView({ block: 'start' });
  else document.getElementById(screen)?.closest('main')?.scrollTo({ top: 0 });
}
