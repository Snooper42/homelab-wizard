// The four tiles at the top of Status: what runs, what needs a look, what
// the homelab saves a year, and the nightly updates (with Pause/Resume).
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { dayText, dollars } from '../format';
import { Card } from '../parts/Card';
import { Hover } from '../parts/Hover';
import { Spark } from '../Spark';
import { keptRestarting } from './stopFor';

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
  const since = dayText(new Date(first.date + 'T12:00:00'), { month: 'short', day: 'numeric' });
  return (
    <>
      <Spark values={pts.map((p) => p.annual)} />
      <span class="trend">{delta === 0 ? `same since ${since}` : `${delta > 0 ? '+' : '−'}${dollars(Math.abs(delta))} since ${since}`}</span>
    </>
  );
}

/** What the apps have saved since the first record, month by month: each
 * recorded day counts its yearly figure over 365, and a day between two
 * records counts the earlier one's. Months newest first. */
export function savedSoFar(history: savings.Point[]): { total: number; since: string; months: { month: string; amount: number }[] } {
  const pts = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = new Map<string, number>();
  let total = 0;
  pts.forEach((p, i) => {
    const day = new Date(p.date + 'T12:00:00');
    const next = pts[i + 1] ? new Date(pts[i + 1].date + 'T12:00:00') : new Date(day.getTime() + 864e5);
    for (const d = new Date(day); d < next; d.setDate(d.getDate() + 1)) {
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(month, (byMonth.get(month) || 0) + p.annual / 365);
      total += p.annual / 365;
    }
  });
  const months = [...byMonth].map(([month, amount]) => ({ month, amount })).sort((a, b) => b.month.localeCompare(a.month));
  return { total, since: pts[0]?.date || '', months };
}

/** The year's figure, and on hover (or Tab) what has been saved so far, month by month. */
function SavedHover({ value, history }: { value: string; history: savings.Point[] }) {
  const s = savedSoFar(history);
  if (!s.since) return <>{value}</>;
  const since = dayText(new Date(s.since + 'T12:00:00'), { month: 'short', day: 'numeric', year: 'numeric' });
  const monthName = (m: string) => dayText(new Date(m + '-15T12:00:00'), { month: 'long', year: 'numeric' });
  return (
    <Hover cls="savedso" label={value} tip={
      <>
        <strong>Saved so far: {dollars(s.total)}</strong>
        <span class="muted">since {since}, from what the apps replace each day</span>
        <ul class="savedmonths">{s.months.slice(0, 12).map((m) => <li key={m.month}><span>{monthName(m.month)}</span><span>{dollars(m.amount)}</span></li>)}</ul>
      </>
    } />
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

/** The phone companion before the scheduled jobs that run it: not counted yet. */
export const awaitingJobs = (a: api.AppStatus) => a.id === 'homelab-companion' && a.state === 'not running';

/** Apps that need a look: unwell, not answering, or not running; not one stopped on purpose (held). */
export const troubled = (a: api.AppStatus, held: Record<string, stopped.Stop> = {}) => a.health === 'unhealthy' || a.health === 'restarting' || !!a.notAnswering || a.state === 'missing' || (a.state === 'stopped' && (!held[a.id] || keptRestarting(held[a.id])));

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
  const trouble = st.apps.filter((a) => troubled(a, st.stopped));
  const u = st.updates;
  return (
    <>
      <Tile label="Running" value={<>{running.length}<small> of {counted}</small></>}
        sub={st.missing ? <span class="bad">{st.missing === 1 ? '1 baseline app is down' : `${st.missing} baseline apps are down`}</span> : 'All baseline apps are up'} />
      <Tile label="Needs a look" value={String(trouble.length)} tone={trouble.length ? 'warn' : ''}
        sub={trouble.length ? trouble.slice(0, 3).map((a) => a.name).join(', ') + (trouble.length > 3 ? '…' : '') : 'Nothing unhealthy or stopped'} />
      <Tile label="Replaces a year" value={<SavedHover value={st.savings > 0 ? dollars(st.savings) : '$0'} history={history} />} sub={<SavingsTrend history={history} />} />
      <Tile label="Nightly updates" value={u?.paused ? 'Paused' : 'On'}
        sub={<>{u?.paused ? 'Until you resume them' : `Run ${u?.schedule}`}<PauseButton paused={!!u?.paused} onPause={onPause} /></>} />
    </>
  );
}

/** Draws the tiles into el, updating what changed since the last time. */
export function mountTiles(el: Element, props: TilesProps) {
  render(<Tiles {...props} />, el);
}
