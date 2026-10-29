// The four tiles at the top of Status: what runs, what needs a look, what
// the homelab saves a year, and the nightly updates (with Pause/Resume).
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { dollars } from '../format';
import { Card } from '../parts/Card';
import { Spark } from '../Spark';

export function Tile({ label, value, sub, tone, id, title }: { label: string; value: ComponentChildren; sub: ComponentChildren; tone?: string; id?: string; title?: string }) {
  return (
    <Card kind={'tile' + (tone ? ' ' + tone : '')} id={id} title={title}>
      <div class="label">{label}</div>
      <div class="value">{value}</div>
      <div class="sub">{sub}</div>
    </Card>
  );
}

/** A sparkline of the last 90 recorded days and the change since the first
 * of them (the nightly backup records one a day). */
export function SavingsTrend({ history }: { history: savings.Point[] }) {
  const pts = history.slice(-90);
  if (pts.length < 2) return <>in subscriptions</>;
  const first = pts[0], last = pts[pts.length - 1];
  const delta = last.annual - first.annual;
  const since = new Date(first.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <>
      <Spark values={pts.map((p) => p.annual)} />
      <span class="trend">{delta === 0 ? `same since ${since}` : `${delta > 0 ? '+' : '−'}${dollars(Math.abs(delta))} since ${since}`}</span>
    </>
  );
}

/** Pause or Resume: disabled while the change is made. */
function PauseButton({ paused, onPause }: { paused: boolean; onPause: (paused: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try {
      await onPause(!paused);
    } finally {
      setBusy(false);
    }
  };
  return <button class="small change" disabled={busy} onClick={click}>{paused ? 'Resume' : 'Pause'}</button>;
}

/** Apps that need a look: unwell, not answering, or not running. */
/** The phone companion before the scheduled jobs that run it: not counted yet. */
export const awaitingJobs = (a: api.AppStatus) => a.id === 'homelab-companion' && a.state === 'not running';

export const troubled = (a: api.AppStatus) => a.health === 'unhealthy' || a.health === 'restarting' || !!a.notAnswering || a.state === 'missing' || a.state === 'stopped';

export interface TilesProps {
  status: api.Status;
  history: savings.Point[];
  /** Pauses (true) or resumes the nightly updates. */
  onPause: (paused: boolean) => Promise<void>;
  /** Opens Choose stacks, from a homelab with no apps yet. */
  onChoose: () => void;
}

export function Tiles({ status: st, history, onPause, onChoose }: TilesProps) {
  // No app yet: no 0-of-0 tiles, but what to do first (the empty list hides with it).
  if (!st.apps.length) {
    return (
      <Card kind="emptystate" id="statusEmpty">
        <h2>No apps yet</h2>
        <p>Pick a few on Choose stacks. They show up here as they start, with their addresses.</p>
        <button class="btn primary" onClick={onChoose}>Choose stacks</button>
      </Card>
    );
  }
  const running = st.apps.filter((a) => a.state === 'running');
  const counted = st.apps.filter((a) => !awaitingJobs(a)).length;
  const trouble = st.apps.filter(troubled);
  const u = st.updates;
  return (
    <>
      <Tile label="Running" value={<>{running.length}<small> of {counted}</small></>}
        sub={st.missing ? <span class="bad">{st.missing} baseline app(s) down</span> : 'All baseline apps are up'} />
      <Tile label="Needs a look" value={String(trouble.length)} tone={trouble.length ? 'warn' : ''}
        sub={trouble.length ? trouble.slice(0, 3).map((a) => a.name).join(', ') + (trouble.length > 3 ? '…' : '') : 'Nothing unhealthy or stopped'} />
      <Tile label="Replaces a year" value={st.savings > 0 ? dollars(st.savings) : '$0'} sub={<SavingsTrend history={history} />} />
      <Tile label="Nightly updates" value={u?.paused ? 'Paused' : 'On'}
        sub={<>{u?.paused ? 'Until you resume them' : `Run ${u?.schedule}`}<PauseButton paused={!!u?.paused} onPause={onPause} /></>} />
    </>
  );
}

/** Draws the tiles into el, updating what changed since the last time. */
export function mountTiles(el: Element, props: TilesProps) {
  render(<Tiles {...props} />, el);
}
