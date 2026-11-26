import { render } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../Icon';

/** A folded set of pages: a category of apps, or the apps not installed. */
export interface NavFold { label: string; pages: string[] }

/** A group: its pages and folds, in order. */
export interface NavGroup { head: string; items: (string | NavFold)[] }

export interface NavProps {
  groups: NavGroup[];
  /** The page shown; none while searching. */
  active: string;
  /** While searching: the matches on each page. */
  counts: Record<string, number> | null;
  pick: (page: string) => void;
}

/** Feather's icons (feathericons.com, MIT) for Settings' own pages, as every screen's menu in the sidebar has; an app's
 * page, in its fold, has none. This machine's page is the last one ("This Mac", "This PC", …). */
const pageIcons: Record<string, string> = {
  General: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  People: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  Phones: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
  'Automatic care': 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  Alerts: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  'Reaching the apps': 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  Storage: 'M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01',
  Appearance: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10z',
  'Tidy Up': 'M3 6h18M7 12h10M10 18h4',
};
const machineIcon = 'M2 3h20v14H2zM8 21h8M12 17v4';

function PageButton({ name, active, counts, pick, inFold }: { name: string; active: string; counts: Record<string, number> | null; pick: (p: string) => void; inFold?: boolean }) {
  const icon = inFold ? '' : pageIcons[name] || (/^This /.test(name) ? machineIcon : '');
  return (
    <button key={name} class={'pagebtn' + (inFold ? ' infold' : '') + (!counts && name === active ? ' active' : '') + (counts && !counts[name] ? ' nomatch' : '')} data-page={name} onClick={() => pick(name)}>
      <span class="pagename">{icon && <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg>}<span>{name}</span></span><span class="n">{counts && counts[name] ? String(counts[name]) : ''}</span>
    </button>
  );
}

/** The same pages as one drop-down, for a screen too narrow for the list
 * (big text in a small window): each group and fold its own heading. */
function PagePicker({ groups, active, counts, pick }: NavProps) {
  const option = (name: string) => <option key={name} value={name}>{counts && counts[name] ? `${name} (${counts[name]})` : name}</option>;
  return (
    <label class="pagepick">
      <span>Page</span>
      <select value={counts ? '' : active} onChange={(e) => pick(e.currentTarget.value)}>
        {counts && <option value="" disabled>Matches on…</option>}
        {groups.filter((g) => g.items.length).flatMap((g) => {
          const pages = g.items.filter((i): i is string => typeof i === 'string');
          const folds = g.items.filter((i): i is NavFold => typeof i !== 'string');
          return [
            ...(pages.length ? [<optgroup key={'h:' + g.head} label={g.head || 'Settings'}>{pages.map(option)}</optgroup>] : []),
            ...folds.map((f) => <optgroup key={'f:' + f.label} label={pages.length ? f.label : `${g.head} › ${f.label}`}>{f.pages.map(option)}</optgroup>),
          ];
        })}
      </select>
    </label>
  );
}

export function Nav({ groups, active, counts, pick }: NavProps) {
  // The folds opened or closed by hand; the others follow the page shown.
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const matches = (f: NavFold) => !!counts && f.pages.some((p) => counts[p]);
  const isOpen = (f: NavFold) => (counts ? matches(f) : picked[f.label] ?? f.pages.includes(active));
  return (
    <>
      <PagePicker groups={groups} active={active} counts={counts} pick={pick} />
      {groups.filter((g) => g.items.length).map((g) => [
        g.head && <div class="navhead" key={'h:' + g.head}>{g.head}</div>,
        ...g.items.map((item) => {
          if (typeof item === 'string') return <PageButton key={item} name={item} active={active} counts={counts} pick={pick} />;
          const f = item, open = isOpen(f);
          const n = counts ? f.pages.reduce((sum, p) => sum + (counts[p] || 0), 0) : f.pages.length;
          return [
            <button key={'f:' + f.label} class={'navfold' + (open ? ' open' : '') + (counts && !n ? ' nomatch' : '')} aria-expanded={open}
              onClick={() => setPicked({ ...picked, [f.label]: !open })}>
              <span><Icon name="chevron" />{f.label}</span><span class="n">{n ? String(n) : ''}</span>
            </button>,
            ...(open ? f.pages.map((name) => <PageButton key={name} name={name} active={active} counts={counts} pick={pick} inFold />) : []),
          ];
        }),
      ])}
    </>
  );
}

export function mountNav(el: Element, props: NavProps) { render(<Nav {...props} />, el); }
/** The drop-down alone, over the page, for the computer whose list is in the sidebar: a small window's rail has no room for it. */
export function mountPagePicker(el: Element, props: NavProps) { render(<PagePicker {...props} />, el); }
