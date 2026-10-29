// Finish setting up: the checklist from the engine, one line a step (what
// it gives you, and its buttons), grouped as what needs you now, what can
// wait, and what is done; a step opens for the rest of what it says. Once
// every step is done, the list is one line.
import { render } from 'preact';
import { useState } from 'preact/hooks';
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
  toggleLater: () => void;
}

export interface ChecklistProps {
  steps: setup.Step[];
  /** Finished steps shown rather than folded. */
  showDone: boolean;
  /** The steps that can wait shown rather than folded. */
  showLater: boolean;
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

/** Steps that can wait through the first week and are not done yet: not
 * counted as left to do, and listed after the rest. */
export const waits = (s: setup.Step) => !!s.later && s.state !== 'done';

/** What the progress counts: every step but those that can wait. */
export function progress(steps: setup.Step[]) {
  const counted = steps.filter((s) => !waits(s));
  const done = counted.filter((s) => s.state === 'done').length;
  return { done, total: counted.length, left: counted.length - done, wait: steps.length - counted.length };
}

/** A group's folded line: its name and count, what is in it, and Show. */
function Fold({ id, cls, title, names, shown, toggle }: { id: string; cls: string; title: string; names?: string; shown: boolean; toggle: () => void }) {
  return (
    <li class={'fold ' + cls}>
      <span class="mark">{cls === 'done' ? <Icon name="check" /> : <Icon name="clock" />}</span>
      <div class="body"><strong class="title">{title}</strong>{!shown && names && <span class="names muted">{' · ' + names}</span>}</div>
      <div class="actions"><button id={id} class="linkbtn small" aria-expanded={shown} onClick={toggle}>{shown ? 'Hide' : 'Show'}</button></div>
    </li>
  );
}

export function Checklist({ steps, showDone, showLater, running, on }: ChecklistProps) {
  // Which steps are open for the rest of what they say.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpened({ ...opened, [id]: !opened[id] });
  const now = steps.filter((s) => !waits(s) && s.state !== 'done');
  const later = steps.filter(waits);
  const done = steps.filter((s) => s.state === 'done');
  const row = (s: setup.Step, n: number) => {
    const open = !!opened[s.id];
    const more = s.why || s.detail;
    return (
      // A row: the step's number, what it gives you (one line until it is
      // opened), its buttons, and the chevron that opens it.
      <li key={s.id} class={s.state + (open ? ' open' : '')}>
        <span class="mark">{s.state === 'done' ? <Icon name="check" /> : String(n)}</span>
        <div class="body">
          <strong class="title">{s.title}</strong>
          <div class="sub muted">{s.why}</div>
          {open && s.state !== 'done' && s.detail && <div class="sub detail">{s.detail}</div>}
        </div>
        <Actions s={s} running={running === s.id} on={on} />
        {more && (
          <button class="iconbtn more" aria-expanded={open} aria-label={(open ? 'Less about: ' : 'More about: ') + s.title} onClick={() => toggle(s.id)}>
            <Icon name="chevron" />
          </button>
        )}
      </li>
    );
  };
  if (!now.length && !later.length) {
    return (
      <>
        <li class="alldone">
          <span class="mark"><Icon name="check" /></span>
          <div class="body">
            <strong class="title">{`All ${steps.length} steps are done`}</strong>
            <div class="sub muted">If one comes undone (a token runs out, the backup drive goes away), it shows here again, and Setup comes back in the sidebar.</div>
          </div>
          <div class="actions"><button id="toggleDone" class="linkbtn small" aria-expanded={showDone} onClick={on.toggleDone}>{showDone ? 'Hide' : 'Show'}</button></div>
        </li>
        {showDone && done.map((s, i) => row(s, i + 1))}
      </>
    );
  }
  return (
    <>
      {!!now.length && <li class="grouphead">{`Needs you · ${now.length}`}</li>}
      {now.map((s, i) => row(s, i + 1))}
      {!!later.length && <Fold id="toggleLater" cls="later" title={`Can wait · ${later.length}`} names={later.map((s) => s.title).join(', ')} shown={showLater} toggle={on.toggleLater} />}
      {showLater && later.map((s, i) => row(s, now.length + i + 1))}
      {!!done.length && <Fold id="toggleDone" cls="done" title={`Done · ${done.length}`} shown={showDone} toggle={on.toggleDone} />}
      {showDone && done.map((s, i) => row(s, i + 1))}
    </>
  );
}

export const mountChecklist = (el: Element, props: ChecklistProps) => render(<Checklist {...props} />, el);
