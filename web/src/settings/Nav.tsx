// Settings' page list on the left, in groups (this machine, the household,
// reaching the apps), then the installed apps folded by category, then the
// apps not installed folded as one; each page with a count of matches while
// searching. A fold opens by itself when it holds the page shown, or a match.
// A screen too narrow for the list shows the same pages as one drop-down.
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

function PageButton({ name, active, counts, pick, inFold }: { name: string; active: string; counts: Record<string, number> | null; pick: (p: string) => void; inFold?: boolean }) {
  return (
    <button key={name} class={'pagebtn' + (inFold ? ' infold' : '') + (!counts && name === active ? ' active' : '') + (counts && !counts[name] ? ' nomatch' : '')} data-page={name} onClick={() => pick(name)}>
      <span>{name}</span><span class="n">{counts && counts[name] ? String(counts[name]) : ''}</span>
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
            ...(pages.length ? [<optgroup key={'h:' + g.head} label={g.head}>{pages.map(option)}</optgroup>] : []),
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
        <div class="navhead" key={'h:' + g.head}>{g.head}</div>,
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
