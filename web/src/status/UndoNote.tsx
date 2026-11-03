// A note at the bottom of the window after apps were stopped: what stopped,
// and Undo, which starts them again. It stays 10 seconds, longer while the
// pointer or the focus is on it (so it is never gone mid-reach), and ⌘Z
// (Ctrl+Z elsewhere) undoes too while it shows.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface UndoNoteProps {
  /** What happened: "Stopped 6 Media apps". */
  words: string;
  undo: () => void;
  close: () => void;
}

/** How long the note stays. */
export const undoFor = 10000;

export function UndoNote({ words, undo, close }: UndoNoteProps) {
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
      <button type="button" class="undobtn" onClick={undo}>Undo</button>
      <button type="button" class="iconbtn" aria-label="Close" onClick={close}>×</button>
    </div>
  );
}

/** Draws the note into el, or takes it away (null). */
export const mountUndoNote = (el: Element, p: UndoNoteProps | null) => render(p && <UndoNote {...p} />, el);
