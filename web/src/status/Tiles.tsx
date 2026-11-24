// The four tiles at the top of Status: what runs, what needs a look, what
// the homelab saves a year, and the nightly updates (with Pause/Resume).
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { bytes, dayText, dollars } from '../format';
import { Card } from '../parts/Card';
import { Hover } from '../parts/Hover';
import { Spark } from '../Spark';
import { keptRestarting } from './stopFor';
import { AppMark } from '../parts/AppMark';
import { facts, type HealthProps, StartAgent } from '../setup/Health';

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
  /** Each app's state in a few words, as its row says it (AppList's stateOf). */
  words?: (a: api.AppStatus) => string;
  /** Start an app that needs you; Logs and Its page open its page (at its log). */
  start?: (a: api.AppStatus) => void;
  logs?: (a: api.AppStatus) => void;
  open?: (a: api.AppStatus) => void;
  history: savings.Point[];
  /** Pauses (true) or resumes the nightly updates. */
  onPause: (paused: boolean) => Promise<void>;
  /** Opens Choose apps, from a homelab with no apps yet. */
  onChoose: () => void;
  /** Last night's copies as Backups read them (null until read): the Backups card (redesign-loop R6, the picture's). */
  backups?: { copied: number; of: number; skipped: string[]; at: string } | null;
  openBackups?: () => void;
  /** This machine's facts as Setup read them (none on a phone): the This Mac card. */
  mac?: HealthProps | null;
  /** On a phone: the computer's free space and power as it sends them (the machine card), for This machine. */
  machine?: MachineFacts | null;
}

/** The computer's free space and power, as `core.MachineFacts` sends them to a phone. */
export interface MachineFacts { free: number; total: number; low: boolean; power?: string; keptAwake: boolean }

export function Tiles({ status: st, history, onPause, onChoose, words, start, logs, open, backups, openBackups, mac, machine }: TilesProps) {
  // No app yet: no 0-of-0 tiles, but what to do first (the empty list hides with it).
  if (!st.apps.length) {
    return (
      <Card kind="emptystate" id="statusEmpty">
        <h2>No apps yet</h2>
        <p>Pick a few on Choose apps. They show up here as they start, with their addresses.</p>
        <button class="btn primary" onClick={onChoose}>Choose apps</button>
      </Card>
    );
  }
  const running = st.apps.filter((a) => a.state === 'running');
  const counted = st.apps.filter((a) => !awaitingJobs(a)).length;
  const trouble = st.apps.filter((a) => troubled(a, st.stopped));
  const u = st.updates;
  return (
    <>
      {/* The headline (docs/Redesign.md, Status; redesign-loop R6): All good, or how many apps need you, each with its fix. */}
      <Card kind={'tile headline' + (trouble.length ? ' warn' : ' good')} id="statusHeadline">
        <div class="headlinemain">
          <div class="value">{trouble.length ? (trouble.length === 1 ? '1 app needs you' : `${trouble.length} apps need you`) : 'All good'}</div>
          <div class="label">{running.length} of {counted} running</div>
          <div class="sub"><span>{st.missing ? <span class="bad">{st.missing === 1 ? "1 of the homelab's own apps is down." : `${st.missing} of the homelab's own apps are down.`}</span> : "The homelab's own apps are all up."}{!trouble.length && ' Nothing unhealthy or stopped.'}</span></div>
        </div>
        {!!trouble.length && <ul class="headlineapps">
          {trouble.slice(0, 3).map((a) => (
            <li key={a.id}>
              <AppMark id={a.id} name={a.name} icon="" small />
              <span class="grow"><strong>{a.name}</strong><span class="muted">{words ? words(a) : a.state}</span></span>
              <span class="headlineacts">
                {start && a.state !== 'running' && <button type="button" class="btn primary small" onClick={() => start(a)}>Start</button>}
                {logs && a.state !== 'missing' && <button type="button" class="btn small" onClick={() => logs(a)}>Logs</button>}
                {open && <button type="button" class="btn small" onClick={() => open(a)}>Its page</button>}
              </span>
            </li>
          ))}
          {trouble.length > 3 && <li class="muted">and {trouble.length - 3} more, in the list below</li>}
        </ul>}
      </Card>
      {/* The picture's Backups and This Mac beside the headline (redesign-loop R6); Instead of subscriptions is lower (Savings). */}
      <Card kind="tile statuscard" id="statusBackups">
        <div class="label">Backups{openBackups && <button type="button" class="linkbtn statusmore" onClick={openBackups}>Backups ›</button>}</div>
        <div class="value">{backups ? <>{backups.copied}<small> of {backups.of}</small></> : '…'}</div>
        <div class="sub">{!backups ? 'Reading last night…' : <span>{backups.at}{backups.skipped.length ? <>{' · '}<span class="warn">{backups.skipped.join(', ')} skipped</span></> : ''}</span>}</div>
      </Card>
      {mac ? <MacCard mac={mac} updates={u} onPause={onPause} /> : machine?.total ? <MachineCard m={machine} updates={u} onPause={onPause} /> : (
        <Tile label="Nightly updates" value={u?.paused ? 'Paused' : 'On'}
          sub={<>{u?.paused ? 'Until you resume them' : `Run ${u?.schedule}`}<PauseButton paused={!!u?.paused} onPause={onPause} /></>} />
      )}
    </>
  );
}

/** This machine on a phone (the redesign's phone picture, as the iPhone app's): the computer's free space as the figure,
 * its power under it (amber when it's on battery or may sleep), and the nightly updates with Pause. */
function MachineCard({ m, updates: u, onPause }: { m: MachineFacts; updates: api.Status['updates']; onPause: (paused: boolean) => Promise<void> }) {
  const power = m.power === 'battery' ? { words: 'On battery', tone: 'warn' } : m.power === 'plugged' ? (m.keptAwake ? { words: 'Plugged in', tone: '' } : { words: 'Plugged in, may sleep', tone: 'warn' }) : null;
  return (
    <Card kind="tile statuscard" id="statusMachine">
      <div class="label">This machine</div>
      <div class={'value' + (m.low ? ' bad' : '')}>{bytes(m.free)}<small> free</small></div>
      {power && <div class={'sub ' + power.tone}><span>{power.words}</span></div>}
      <div class="sub statusupdates"><span>{u?.paused ? 'Updates paused' : `Updates ${u?.schedule ? 'run ' + u.schedule : 'nightly'}`}</span><PauseButton paused={!!u?.paused} onPause={onPause} /></div>
    </Card>
  );
}

/** This Mac (redesign-loop R6, the picture's): its free space as the figure, power and what runs the apps under it, the
 * nightly updates with Pause, and anything wrong with the machine said here too (Start for a stopped agent). */
function MacCard({ mac, updates: u, onPause }: { mac: HealthProps; updates: api.Status['updates']; onPause: (paused: boolean) => Promise<void> }) {
  const all = facts(mac);
  const of = (k: string) => all.find((f) => f.key === k);
  const disk = of('disk'), power = of('power'), runtime = of('runtime');
  const wrong = all.filter((f) => f.tone !== 'ok' && f.key !== 'disk');
  // Power and the runtime in a line when they're fine; what isn't has a line of its own, in its tone.
  const fine = [power, runtime].filter((f) => f && f.tone === 'ok').map((f) => f!.short).join(' · ');
  const stopped = mac.h.agent === 'stopped' || mac.h.agent === 'quit';
  const name = mac.machine.charAt(0).toUpperCase() + mac.machine.slice(1);
  return (
    <Card kind="tile statuscard" id="statusMac">
      <div class="label">{name}</div>
      <div class={'value' + (disk && disk.tone !== 'ok' ? ' bad' : '')}>{disk ? disk.value.replace(/ free$/, '') : '—'}<small>{disk ? ' free' : ''}</small></div>
      {fine && <div class="sub"><span>{fine}</span></div>}
      {wrong.map((f) => <div key={f.key} class={'sub ' + f.tone}><span>{f.short}</span></div>)}
      {stopped && <StartAgent id="startAgentMac" start={mac.startAgent} />}
      <div class="sub statusupdates"><span>{u?.paused ? 'Updates paused' : `Updates ${u?.schedule ? 'run ' + u.schedule : 'nightly'}`}</span><PauseButton paused={!!u?.paused} onPause={onPause} /></div>
    </Card>
  );
}

/** Instead of subscriptions, below the apps (it was beside the headline before the picture's Backups and This Mac). */
export function Savings({ status: st, history }: { status: api.Status; history: savings.Point[] }) {
  if (!st.apps.length) return null;
  return <Tile label="Instead of subscriptions" value={<><SavedHover value={st.savings > 0 ? dollars(st.savings) : '$0'} history={history} /><small> a year</small></>} sub={<SavingsTrend history={history} />} />;
}
export function mountSavings(el: Element, props: { status: api.Status; history: savings.Point[] }) { render(<Savings {...props} />, el); }

/** Draws the tiles into el, updating what changed since the last time. */
export function mountTiles(el: Element, props: TilesProps) {
  render(<Tiles {...props} />, el);
}
