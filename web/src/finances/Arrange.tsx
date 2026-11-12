// Arrange the Dashboard (the owner, Nov 12: "you should be able to move them
// around, maybe resize them"; the mockup's artboard 5 was a yes, kept per
// device): Arrange the Dashboard, then each card's handle to drag it, or ▲ ▼
// for the keyboard; a third, half or the whole row for its width; Hide, the
// hidden waiting below to come back; Reset to the usual; Done. Kept in this
// device's storage only, in try: none kept is the usual board, drawn as it
// always was. Not on a phone, where the cards stack anyway.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export type Width = 'third' | 'half' | 'full';

/** What a device keeps: the cards' order (by id), the hidden ones, and each card's width when picked. */
export interface Layout { order: string[]; hidden: string[]; widths: Record<string, Width> }

/** One card on the board: its id, its name (for the buttons' words), its usual width, and what it draws (none: not now). */
export interface Slot { id: string; title: string; width: Width; node: ComponentChildren }

const key = 'homelab.finances.layout';
const widths: Width[] = ['third', 'half', 'full'];

/** The layout this device keeps, or none (the usual board). */
export function readLayout(): Layout | null {
  try {
    const l = JSON.parse(localStorage.getItem(key) || 'null');
    if (!l || !Array.isArray(l.order)) return null;
    const ok = (x: unknown): x is string => typeof x === 'string';
    const w: Record<string, Width> = {};
    for (const [id, v] of Object.entries((l.widths && typeof l.widths === 'object' ? l.widths : {}) as Record<string, unknown>)) if (widths.includes(v as Width)) w[id] = v as Width;
    return { order: l.order.filter(ok), hidden: Array.isArray(l.hidden) ? l.hidden.filter(ok) : [], widths: w };
  } catch { return null; }
}

/** Keeps a layout on this device, or forgets it (Reset). */
export function keepLayout(l: Layout | null) {
  try { if (l) localStorage.setItem(key, JSON.stringify(l)); else localStorage.removeItem(key); } catch { /* not kept: the board still shows it until reload */ }
}

/** The slots in a layout's order: those it names first, as it names them, then any it doesn't (a card new since), in their usual places. */
export function ordered(slots: Slot[], l: Layout | null): Slot[] {
  if (!l) return slots;
  const at = (id: string) => l.order.indexOf(id);
  const named = slots.filter((s) => at(s.id) >= 0).sort((a, b) => at(a.id) - at(b.id));
  return [...named, ...slots.filter((s) => at(s.id) < 0)];
}

export function ArrangedBoard({ slots, phone }: { slots: Slot[]; phone?: boolean }) {
  const [layout, setLayout] = useState<Layout | null>(readLayout);
  const [editing, setEditing] = useState(false);
  const [dragged, setDragged] = useState('');
  const present = slots.filter((s) => !!s.node);
  // On a phone, or never arranged: the usual board, exactly as it was drawn before.
  if (phone) return <div class="fx-board">{present.map((s) => s.node)}</div>;
  const button = <div class="fx-arrange">{editing
    ? <><span class="fx-arrangehint">Drag a card by its handle, or use ▲ ▼. Pick its width; Hide what you don't use. Kept on this device.</span>
      <button type="button" class="btn" onClick={() => { keepLayout(null); setLayout(null); }}>Reset to the usual</button>
      <button type="button" class="btn fx-primary" onClick={() => setEditing(false)}>Done</button></>
    : <button type="button" class="small" onClick={() => setEditing(true)}>Arrange the Dashboard</button>}</div>;
  if (!layout && !editing) return <>{button}<div class="fx-board">{present.map((s) => s.node)}</div></>;
  const all = ordered(present, layout);
  const hidden = new Set(layout?.hidden || []);
  const shown = all.filter((s) => !hidden.has(s.id));
  const widthOf = (s: Slot) => layout?.widths[s.id] || s.width;
  const save = (l: Layout) => { keepLayout(l); setLayout(l); };
  const base = (): Layout => layout ? { ...layout, widths: { ...layout.widths }, hidden: [...layout.hidden] } : { order: all.map((s) => s.id), hidden: [], widths: {} };
  const reorder = (ids: string[]) => {
    // The new order of what shows, the hidden kept after it as they were.
    const l = base();
    save({ ...l, order: [...ids, ...all.map((s) => s.id).filter((id) => !ids.includes(id))] });
  };
  const move = (id: string, by: number) => {
    const ids = shown.map((s) => s.id), i = ids.indexOf(id), j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder(ids);
  };
  const dropOn = (target: string) => {
    if (!dragged || dragged === target) return;
    const ids = shown.map((s) => s.id).filter((id) => id !== dragged);
    ids.splice(ids.indexOf(target), 0, dragged);
    reorder(ids);
    setDragged('');
  };
  const setWidth = (id: string, w: Width) => { const l = base(); l.widths[id] = w; save(l); };
  const hide = (id: string, off: boolean) => { const l = base(); save({ ...l, hidden: off ? [...l.hidden, id] : l.hidden.filter((x) => x !== id) }); };
  return (
    <>
      {button}
      <div class={'fx-board arranged' + (editing ? ' editing' : '')}>
        {shown.map((s, i) => (
          <div key={s.id} class={'fx-slot w-' + widthOf(s) + (dragged === s.id ? ' dragging' : '')} data-card={s.id}
            onDragOver={editing ? (e) => e.preventDefault() : undefined} onDrop={editing ? (e) => { e.preventDefault(); dropOn(s.id); } : undefined}>
            {editing && <div class="fx-slotbar">
              <span class="fx-handle" draggable onDragStart={(e) => { setDragged(s.id); e.dataTransfer?.setData('text/plain', s.id); }} onDragEnd={() => setDragged('')} title="Drag to move" aria-hidden="true">⋮⋮</span>
              <button type="button" class="small" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => move(s.id, -1)}>▲</button>
              <button type="button" class="small" aria-label={`Move ${s.title} down`} disabled={i === shown.length - 1} onClick={() => move(s.id, 1)}>▼</button>
              <span class="grow" />
              <span class="fx-widths" role="group" aria-label={`${s.title}'s width`}>
                {widths.map((w) => <button key={w} type="button" class={'small' + (widthOf(s) === w ? ' on' : '')} aria-pressed={widthOf(s) === w} onClick={() => setWidth(s.id, w)}>{w === 'third' ? '⅓' : w === 'half' ? '½' : 'Full'}<span class="sr">{w === 'third' ? ' a third' : w === 'half' ? ' half' : ' the whole row'}</span></button>)}
              </span>
              <button type="button" class="small" onClick={() => hide(s.id, true)}>Hide<span class="sr"> {s.title}</span></button>
            </div>}
            {s.node}
          </div>
        ))}
      </div>
      {editing && hidden.size > 0 && <div class="fx-hiddencards">
        <span class="muted">Hidden:</span>
        {all.filter((s) => hidden.has(s.id)).map((s) => <button key={s.id} type="button" class="small" onClick={() => hide(s.id, false)}>+ {s.title}</button>)}
      </div>}
    </>
  );
}
