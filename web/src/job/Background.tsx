// A command that carries on with its sheet hidden. The command sheet
// (sheets/Sheet.tsx) holds the window while it is open, so a long one
// (Update all apps now, an app's update, Fix it) offers Hide: the sheet
// goes, the command runs on, and a chip at the foot of the sidebar (above
// the tab bar on a phone) shows its title, its bar, and its step. Clicking
// the chip brings the sheet back; once the command ends, the chip says how
// it went until it is opened or dismissed.
import { render } from 'preact';
import { $ } from '../core';

interface Bg {
  title: string;
  state: 'running' | 'done' | 'failed';
  /** How far, 0 to 100; 0 is "working" without a measure. */
  pct: number;
  step: string;
}

let bg: Bg | null = null;
let hidden = false;
let show: () => void = () => {};

/** A command starts in the command sheet; open shows that sheet again. */
export function bgStart(title: string, open: () => void) {
  bg = { title, state: 'running', pct: 0, step: '' };
  hidden = false;
  show = open;
  draw();
}

/** The command's sheet was hidden while it runs: the chip shows it. */
export function bgHide() { if (bg) { hidden = true; draw(); } }

/** The bar and step, as the sheet shows them. */
export function bgProgress(pct: number, step: string) {
  if (!bg || bg.state !== 'running') return;
  bg.pct = pct;
  bg.step = step;
  if (hidden) draw();
}

/** The command ended: the chip says how, if its sheet is hidden. */
export function bgEnd(failed: boolean) {
  if (!bg) return;
  if (!hidden) { bg = null; return; }
  bg.state = failed ? 'failed' : 'done';
  draw();
}

/** A command runs with its sheet open or hidden: its title, else "". */
export const bgRunning = () => (bg?.state === 'running' ? bg.title : '');

function open() {
  hidden = false;
  if (bg && bg.state !== 'running') bg = null;
  draw();
  show();
}

function dismiss() { bg = null; hidden = false; draw(); }

function Chip({ b }: { b: Bg }) {
  const words = b.state === 'done' ? 'Done' : b.state === 'failed' ? 'Stopped with a problem' : b.step || 'Working…';
  return (
    <div class={'bgjob ' + b.state}>
      <button class="bgopen" onClick={open} title="Show it">
        <span class="bgtitle">{b.title}</span>
        <span class={'bgtrack' + (b.state === 'running' && !b.pct ? ' working' : '')} aria-hidden="true">
          <span class="bgfill" style={{ width: `${b.state === 'running' ? b.pct : 100}%` }}></span>
        </span>
        <span class="bgstep" role="status" aria-live="polite">{words}</span>
      </button>
      {b.state !== 'running' && <button class="bgdismiss" onClick={dismiss} aria-label={`Dismiss ${b.title}`}>×</button>}
    </div>
  );
}

function draw() {
  const el = $('bgJob');
  if (el) render(hidden && bg ? <Chip b={bg} /> : null, el);
}
