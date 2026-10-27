// Settings' page list on the left: General (with Appearance, People, and
// Phones), then the installed apps, then the rest, each with a count of
// matches while searching.
import { render } from 'preact';

export interface NavGroup { head: string; pages: string[] }

export interface NavProps {
  groups: NavGroup[];
  /** The page shown; none while searching. */
  active: string;
  /** While searching: the matches on each page. */
  counts: Record<string, number> | null;
  pick: (page: string) => void;
}

export function Nav({ groups, active, counts, pick }: NavProps) {
  return (
    <>
      {groups.filter((g) => g.pages.length).map((g) => [
        <div class="navhead" key={'h:' + g.head}>{g.head}</div>,
        ...g.pages.map((name) => (
          <button key={name} class={'pagebtn' + (!counts && name === active ? ' active' : '') + (counts && !counts[name] ? ' nomatch' : '')} data-page={name} onClick={() => pick(name)}>
            <span>{name}</span><span class="n">{counts && counts[name] ? String(counts[name]) : ''}</span>
          </button>
        )),
      ])}
    </>
  );
}

export function mountNav(el: Element, props: NavProps) { render(<Nav {...props} />, el); }
