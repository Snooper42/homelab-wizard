// First-time setup: the checklist from the engine, each step with its live
// check, what to fill in, and a button for what the engine can do. Finished
// steps fold into one line, so what is left stands out.
import { render } from 'preact';
import { ActionLink } from '../ActionLink';
import { Icon } from '../Icon';

/** What the steps' buttons do; app.ts runs each. */
export interface ChecklistActions {
  fill: (keys: string[]) => void;
  /** Runs the step, or the choice at its index. */
  run: (s: setup.Step, choice?: number) => void;
  open: (url: string) => void;
  closeSignups: () => void;
  markDone: (s: setup.Step, done: boolean) => void;
  toggleDone: () => void;
}

export interface ChecklistProps {
  steps: setup.Step[];
  /** Finished steps shown rather than folded. */
  showDone: boolean;
  /** The step running now: its buttons wait. */
  running: string | null;
  on: ChecklistActions;
}

function Actions({ s, running, on }: { s: setup.Step; running: boolean; on: ChecklistActions }) {
  const open = s.state !== 'waiting' && s.state !== 'done';
  const items = [
    open && !!s.settings?.length && <button class="small" onClick={() => on.fill(s.settings!)}>Fill in settings</button>,
    open && !!s.run?.length && <button class="small" disabled={running} onClick={() => on.run(s)}>{s.runLabel || 'Run'}</button>,
    ...(open ? (s.choices || []).map((c, ci) => <button class="small choice" disabled={running} onClick={() => on.run(s, ci)}>{c.label}</button>) : []),
    open && s.open && <ActionLink onClick={() => on.open(s.open!)}>{'Open ' + s.open.replace(/^https?:\/\//, '').replace(/\/$/, '')}</ActionLink>,
    open && s.id === 'vaultwarden' && <button class="small" onClick={on.closeSignups}>Close sign-ups now</button>,
    s.manual && s.state !== 'waiting' && (
      <label class="small"><input type="checkbox" checked={s.state === 'done'} onChange={(e) => on.markDone(s, e.currentTarget.checked)} /> Done</label>
    ),
  ].filter(Boolean);
  return items.length ? <div class="actions">{items}</div> : null;
}

export function Checklist({ steps, showDone, running, on }: ChecklistProps) {
  const done = steps.filter((s) => s.state === 'done').length;
  const some = done > 0 && done < steps.length;
  const fold = some && !showDone;
  return (
    <>
      {some && (
        <li class="done folded">
          <span class="mark"><Icon name="check" /></span>
          <div class="body"><strong class="title">{done} done</strong></div>
          <div class="actions"><a id="toggleDone" class="small" tabIndex={0} role="button" onClick={on.toggleDone}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on.toggleDone(); } }}>{showDone ? 'Hide' : 'Show'}</a></div>
        </li>
      )}
      {steps.map((s, i) => (fold && s.state === 'done' ? null : (
        // A row: the step's number, what it gives you, and its buttons on the right.
        <li key={s.id} class={s.state}>
          <span class="mark">{s.state === 'done' ? <Icon name="check" /> : String(i + 1)}</span>
          <div class="body">
            <strong class="title">{s.title}</strong>
            <div class="sub muted">{s.why}</div>
            {s.state !== 'done' && s.detail && <div class="sub">{s.detail}</div>}
          </div>
          <Actions s={s} running={running === s.id} on={on} />
        </li>
      )))}
    </>
  );
}

export const mountChecklist = (el: Element, props: ChecklistProps) => render(<Checklist {...props} />, el);
