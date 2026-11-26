import { render } from 'preact';
import { Card, CardHead } from '../parts/Card';
import { progress, waits } from './Checklist';

export function SetupOnStatus({ steps, open }: { steps: setup.Step[]; open: () => void }) {
  const p = progress(steps);
  if (!p.left) return null;
  const next = steps.filter((s) => s.state !== 'done' && !waits(s)).slice(0, 3);
  return (
    <Card kind="setuponstatus" id="setupOnStatusCard">
      <CardHead title="Finish setting up"><button type="button" class="small primary" onClick={open}>Continue</button></CardHead>
      <p class="muted">{p.done} of {p.total} done · {p.left} left</p>
      <ul class="setupnext">{next.map((s) => <li key={s.id}>{s.title}</li>)}</ul>
    </Card>
  );
}

/** Draws the card into el, or nothing (none left, or no steps: a wall screen, a member's phone). */
export const mountSetupOnStatus = (el: Element, props: { steps: setup.Step[] | null; open: () => void }) =>
  render(props.steps?.length ? <SetupOnStatus steps={props.steps} open={props.open} /> : null, el);
