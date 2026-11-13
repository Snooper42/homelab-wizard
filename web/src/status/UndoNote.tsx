// A note at the bottom of the window after apps were stopped: what stopped,
// and Undo, which starts them again (or, from showUndo, after transactions
// were deleted, which brings them back). It stays 10 seconds, longer while the
// pointer or the focus is on it (so it is never gone mid-reach), and ⌘Z
// (Ctrl+Z elsewhere) undoes too while it shows.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface UndoNoteProps {
  /** What happened: "Stopped 6 Media apps". */
  words: string;
  undo: () => void;
  close: () => void;
  /** Its button's word: Undo, or Open for a page sent from the computer (showNote). */
  label?: string;
}

/** How long the note stays. */
export const undoFor = 10000;

export function UndoNote({ words, undo, close, label = 'Undo' }: UndoNoteProps) {
  const [held, setHeld] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (held) return;
    const t = setTimeout(close, undoFor);
    return () => clearTimeout(t);
  }, [held, words]);
  return (
    <div ref={box} class="undonote" role="status"
      onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(!!box.current?.contains(document.activeElement))}
      onFocusIn={() => setHeld(true)} onFocusOut={() => setTimeout(() => setHeld(!!box.current?.matches(':hover') || !!box.current?.contains(document.activeElement)))}>
      <span class="undowords">{words}</span>
      <button type="button" class="undobtn" onClick={undo}>{label}</button>
      <button type="button" class="iconbtn" aria-label="Close" onClick={close}>×</button>
    </div>
  );
}

/** What showUndo's note undoes while it shows; another note in its place lets it go. */
let shown: (() => void) | null = null;

/** Draws the note into el, or takes it away (null). */
export const mountUndoNote = (el: Element, p: UndoNoteProps | null) => {
  if (!p || p.undo !== shown) shown = null;
  render(p && <UndoNote {...p} />, el);
};

/** The note, at the bottom of the window, for something undone by undo: its Undo, or ⌘Z (Ctrl+Z) while it shows. */
export function showUndo(words: string, undo: () => void) {
  const el = document.getElementById('undoNote');
  if (!el) return;
  const close = () => mountUndoNote(el, null);
  const now = () => { close(); undo(); };
  mountUndoNote(el, { words, undo: now, close });
  shown = now;
}

/** Undoes what showUndo's note says while it shows (⌘Z); false when it is not showing. */
export function undoShown(): boolean {
  if (!shown) return false;
  shown();
  return true;
}

/** The same note with another button (Open: a page the computer sent the phone): no ⌘Z, since it undoes nothing. */
export function showNote(words: string, label: string, act: () => void) {
  const el = document.getElementById('undoNote');
  if (!el) return;
  const close = () => mountUndoNote(el, null);
  mountUndoNote(el, { words, label, undo: () => { close(); act(); }, close });
}
