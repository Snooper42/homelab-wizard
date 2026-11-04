// The command palette: ⌘K (Ctrl+K elsewhere, and View › Command Palette on
// a Mac) on any screen, then type "immich" for its Open, Restart, or Logs,
// or "stop media", "back up now", "update all". The arrow keys pick, Return
// runs, Escape or a press outside closes it with the focus back where it
// was. Stop asks for a second press, as the row's menu does; what changes
// more than one thing (Update all) shows its plan first, as its button does.
// Not while a sheet is open (a job or a form owns the window), nor on a wall
// screen.
import { render } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Command, commands, match } from './commands';
import { focusScreen } from '../app';

interface PaletteProps {
  /** Read each time it opens. */
  list: () => Command[];
  /** back: the focus where it was (or, after moving to another screen, on its heading); none: where a press outside put it. */
  close: (focus: 'back' | 'none') => void;
}

export function Palette({ list, close }: PaletteProps) {
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const shown = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  // A stop waits for its second press: the command's id, and how it was pressed.
  const [sure, setSure] = useState<{ id: string; by: 'key' | 'click' } | null>(null);
  const [said, setSaid] = useState('');
  const all = useMemo(list, []);
  const found = useMemo(() => match(all, query), [all, query]);
  const picked = found[Math.min(at, found.length - 1)];

  // The field takes the focus as the palette is drawn (not a frame later): keys typed right after ⌘K land in it.
  useLayoutEffect(() => {
    field.current?.focus();
    const outside = (e: Event) => { if (!box.current?.contains(e.target as Node)) close('none'); };
    document.addEventListener('mousedown', outside, true);
    return () => document.removeEventListener('mousedown', outside, true);
  }, []);
  // The picked one kept in sight as the arrows move past the list's edge.
  useLayoutEffect(() => { shown.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [at, query]);

  const run = (c: Command | undefined, by: 'key' | 'click') => {
    if (!c) return;
    if (c.danger && sure?.id !== c.id) { setSure({ id: c.id, by }); return; }
    const out = c.run();
    // A command done there and then says so a moment before it closes.
    if (out instanceof Promise) { out.then((w) => { setSaid(w); setTimeout(() => close('back'), 1200); }); return; }
    close('back');
  };
  const move = (to: number) => { if (!found.length) return; setAt((to + found.length) % found.length); setSure(null); };
  const label = (c: Command) => (sure?.id === c.id ? `${sure.by === 'key' ? 'Press Return' : 'Click'} again to ${c.danger}` : c.label);
  const optId = (c: Command) => 'pal-' + c.id.replace(/[^a-z0-9-]/gi, '-');

  return (
    // Not a sheet (no Close, nothing behind it waits): a field and its list, as a search field's suggestions are.
    <div ref={box} class="palette"
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close('back'); return; }
        if (e.key === 'Tab') { e.preventDefault(); return; } // the field is its only stop
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(at + (e.key === 'ArrowDown' ? 1 : -1)); return; }
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); run(picked, 'key'); }
      }}>
      <input ref={field} class="palfield" type="text" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list"
        aria-activedescendant={picked ? optId(picked) : undefined} aria-label="Find a command or an app" placeholder="Type an app or a command: immich, stop media, back up now…"
        autocomplete="off" spellcheck={false} value={query}
        onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setAt(0); setSure(null); setSaid(''); }} />
      <ul ref={shown} id="palList" class="pallist" role="listbox" aria-label="Commands">
        {found.map((c, i) => (
          <li key={c.id} id={optId(c)} role="option" aria-selected={c === picked} class={(c === picked ? 'picked' : '') + (sure?.id === c.id ? ' danger' : '')}
            onMouseMove={() => { if (i !== at) { setAt(i); setSure(null); } }}
            onMouseDown={(e) => e.preventDefault() /* the focus stays in the field */}
            onClick={() => run(c, 'click')}>
            <span class="pallabel">{label(c)}</span>{c.hint && <span class="palhint muted">{c.hint}</span>}
          </li>
        ))}
      </ul>
      <p class="palfoot muted" role="status">{said || (found.length ? '' : `Nothing has “${query.trim()}”`)}</p>
    </div>
  );
}

// Open or not, and where the focus was before.
let el: HTMLElement | null = null;
let before: HTMLElement | null = null;
const isOpen = () => !!el?.firstChild;

function shut(focus: 'back' | 'none') {
  if (!el) return;
  render(null, el);
  document.documentElement.classList.remove('palette-open');
  if (focus === 'none') return;
  // Back where it was; after a command that moved to another screen, its
  // heading. A sheet the command opened takes it for itself.
  requestAnimationFrame(() => {
    if (document.activeElement && document.activeElement !== document.body) return;
    if (before?.isConnected && before.checkVisibility()) before.focus();
    else { const s = document.querySelector('.screen.active'); if (s) focusScreen(s.id); }
  });
}

/** Opens the palette (a second ⌘K while it is open picks what is typed, to type anew). */
export function openPalette() {
  const html = document.documentElement.classList;
  if (html.contains('sheet-open') || html.contains('kiosk')) return;
  el ||= document.getElementById('palette');
  if (!el) return;
  if (isOpen()) { el.querySelector<HTMLInputElement>('.palfield')?.select(); return; }
  before = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  // An open menu (a row's, a group's) closes, as a press elsewhere closes it.
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  html.add('palette-open');
  render(<Palette list={commands} close={shut} />, el);
}
