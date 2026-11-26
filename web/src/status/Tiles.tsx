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
import { Icon } from '../Icon';
import { nightTone, nightWords } from '../backups/Backups';
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
        <span class="muted">since {since}</span>
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
  /** Opens Find an app (every app and the starter sets), from a homelab with no apps yet. */
  onChoose: () => void;
  /** Last night's copies as Backups read them (null until read): the Backups card (redesign-loop R6, the picture's). */
  backups?: { copied: number; of: number; skipped: string[]; at: string } | null;
  openBackups?: () => void;
  /** This week as the watchdog saw it: a square per day (ok, warn, bad), and when it last checked; null before it's read. */
  week?: { days: string[]; checked: string } | null;
  /** The last nights' copies (Backups' squares), oldest first. */
  nights?: backup.Night[];
  /** Starts each stopped app; and shows them all in the list. */
  startAll?: (apps: api.AppStatus[]) => void;
  seeAll?: () => void;
  /** This machine's facts as Setup read them (none on a phone): the This Mac card. */
  mac?: HealthProps | null;
  /** On a phone: the computer's free space and power as it sends them (the machine card), for This machine. */
  machine?: MachineFacts | null;
}

/** The computer's free space and power, as `core.MachineFacts` sends them to a phone. */
export interface MachineFacts { free: number; total: number; low: boolean; power?: string; keptAwake: boolean }

export function Tiles({ status: st, history, onPause, onChoose, words, start, logs, open, backups, openBackups, mac, machine, week, nights, startAll, seeAll }: TilesProps) {
  // No app yet: no 0-of-0 tiles, but what to do first (the empty list hides with it).
  if (!st.apps.length) {
    return (
      <Card kind="emptystate" id="statusEmpty">
        <h2>No apps yet</h2>
        <button class="btn primary" onClick={onChoose}>Find an app</button>
      </Card>
    );
  }
  const running = st.apps.filter((a) => a.state === 'running');
  const counted = st.apps.filter((a) => !awaitingJobs(a)).length;
  const trouble = st.apps.filter((a) => troubled(a, st.stopped));
  const u = st.updates;
  // The owner's web-wide pictures (Nov 25): Apps, Backups and the machine as three cards of one anatomy (title row,
  // one figure, one line, a footer at the same height), each drawn in every state. Never "needs you": what happened.
  const lower = (w: string) => w.charAt(0).toLowerCase() + w.slice(1);
  const one = trouble.length === 1 ? trouble[0] : null;
  const outages = week ? week.days.filter((d) => d !== 'ok').length : 0;
  return (
    <>
      <Card kind="tile ovcard" id="statusApps">
        <div class="anthead"><h2>Apps</h2><span class="muted">{week?.checked || ''}</span></div>
        <div class={'antfig' + (trouble.length ? ' warn' : '')}>{trouble.length ? <>{running.length}<span class="muted"> of {counted} running</span></> : <>{running.length}<span class="muted"> running</span></>}</div>
        <div class="antline muted">
          {st.missing ? <span class="bad">{st.missing === 1 ? "1 of the homelab's own apps is down" : `${st.missing} of the homelab's own apps are down`}</span>
            : one ? <span class="antwho"><AppMark id={one.id} name={one.name} icon="" small /><span class="antname">{one.name} {lower(words ? words(one) : one.state)}</span></span>
            : trouble.length ? <span class="antwho"><span class="antname">{trouble.map((a) => a.name).join(', ')} stopped</span></span>
            : <span>All answering{week ? ` · ${outages ? `${outages === 1 ? '1 day' : `${outages} days`} with an outage this week` : 'no outage this week'}` : ''}</span>}
        </div>
        <div class="antfoot">
          {one ? <span class="ovacts">
            {start && one.state !== 'running' && <button type="button" class="primary small" onClick={() => start(one)}><Icon name="start" />Start</button>}
            {logs && one.state !== 'missing' && <button type="button" class="btn small" onClick={() => logs(one)}><Icon name="logs" />Logs</button>}
            {open && <button type="button" class="iconbtn" aria-label={`${one.name}: its page`} title={`${one.name}: its page`} onClick={() => open(one)}><Icon name="more" /></button>}
          </span>
            : trouble.length ? <span class="ovacts">
              {startAll && <button type="button" class="primary small" onClick={() => startAll(trouble)}><Icon name="start" />Start all</button>}
              {seeAll && <button type="button" class="btn small" onClick={seeAll}>See them</button>}
            </span>
            : week ? <span class="ovdays" role="img" aria-label={`This week: ${outages ? `${outages} days with an outage` : 'no outage'}`}>{week.days.map((d, i) => <i key={i} class={d} />)}</span>
            : <span class="antempty" />}
        </div>
      </Card>
      <Card kind="tile ovcard" id="statusBackups">
        <div class="anthead"><h2>{openBackups ? <button type="button" class="linkbtn ovtitle" onClick={openBackups}>Backups</button> : 'Backups'}</h2><span class="muted">Every night at 03:30</span></div>
        <div class={'antfig' + (backups?.skipped.length ? ' warn' : '')}>{backups ? <>{backups.copied}<span class="muted"> of {backups.of} copied</span></> : '—'}</div>
        <div class="antline muted">{!backups ? 'Reading last night…' : <span>{backups.at}{backups.skipped.length ? <>{' · '}<span class="warn">{backups.skipped.join(', ')} skipped</span></> : ''}</span>}</div>
        <div class="antfoot">{nights?.length ? <span class="ovdays" role="img" aria-label={`The last ${Math.min(14, nights.length)} nights`}>{nights.slice(-14).map((n) => <i key={n.date} class={nightTone(n)} title={nightWords(n, (id) => id)} />)}</span> : <span class="antempty" />}</div>
      </Card>
      {mac ? <MacCard mac={mac} updates={u} onPause={onPause} /> : machine?.total ? <MachineCard m={machine} updates={u} onPause={onPause} /> : (
        <Card kind="tile ovcard" id="statusMachine">
          <div class="anthead"><h2>Updates</h2><span class="muted" /></div>
          <div class="antfig">{u?.paused ? 'Paused' : 'On'}</div>
          <div class="antline muted">{u?.paused ? 'Until you resume them' : `Run ${u?.schedule}`}</div>
          <div class="antfoot"><PauseButton paused={!!u?.paused} onPause={onPause} /></div>
        </Card>
      )}
    </>
  );
}

/** The machine's card (the picture's *The server*): free space as the figure, power and what runs the apps on its
 * line, and the drive's room as a bar with the nightly updates' Pause at its foot. On a phone, from what the computer sends. */
function MachineCard({ m, updates: u, onPause }: { m: MachineFacts; updates: api.Status['updates']; onPause: (paused: boolean) => Promise<void> }) {
  const power = m.power === 'battery' ? { words: 'On battery', tone: 'warn' } : m.power === 'plugged' ? (m.keptAwake ? { words: 'Plugged in', tone: '' } : { words: 'Plugged in, may sleep', tone: 'warn' }) : null;
  return <Machine id="statusMachine" name="This machine" free={m.free} total={m.total} low={m.low} line={power ? <span class={power.tone}>{power.words}</span> : null} u={u} onPause={onPause} />;
}

function MacCard({ mac, updates: u, onPause }: { mac: HealthProps; updates: api.Status['updates']; onPause: (paused: boolean) => Promise<void> }) {
  const all = facts(mac);
  const of = (k: string) => all.find((f) => f.key === k);
  const power = of('power'), runtime = of('runtime');
  const wrong = all.filter((f) => f.tone !== 'ok' && f.key !== 'disk');
  const fine = [power, runtime].filter((f) => f && f.tone === 'ok').map((f) => f!.short).join(' · ');
  const stopped = mac.h.agent === 'stopped' || mac.h.agent === 'quit';
  const d = (mac.i.disks || [])[0];
  const name = mac.machine.charAt(0).toUpperCase() + mac.machine.slice(1);
  return (
    <Machine id="statusMac" name={name} free={d?.free || 0} total={d?.total || 0} low={!!d?.low} u={u} onPause={onPause}
      line={<>{fine && <span>{fine}</span>}{wrong.map((f) => <span key={f.key} class={f.tone}>{fine ? ' · ' : ''}{f.short}</span>)}</>}
      extra={stopped ? <StartAgent id="startAgentMac" start={mac.startAgent} /> : null} />
  );
}

function Machine({ id, name, free, total, low, line, u, onPause, extra }: { id: string; name: string; free: number; total: number; low: boolean; line: ComponentChildren; u: api.Status['updates']; onPause: (paused: boolean) => Promise<void>; extra?: ComponentChildren }) {
  const used = total ? Math.min(100, Math.max(1, Math.round(100 * (1 - free / total)))) : 0;
  return (
    <Card kind="tile ovcard" id={id}>
      <div class="anthead"><h2>{name}</h2><span class="muted">{u?.paused ? 'Updates paused' : `Updates ${u?.schedule || 'nightly'}`}</span></div>
      <div class={'antfig' + (low ? ' bad' : '')}>{total ? <>{bytes(free).replace(/ \S+$/, '')}<span class="muted"> {bytes(free).replace(/^\S+ /, '')} free</span></> : '—'}</div>
      <div class="antline muted">{line}{extra}</div>
      <div class="antfoot ovmachine">
        {total ? <span class="ovbar"><span class="antbar" role="img" aria-label={`${used}% used`}><span style={{ width: `${used}%` }} /></span><small class="muted">{bytes(total - free)} of {bytes(total)} used</small></span> : <span class="antempty" />}
        <PauseButton paused={!!u?.paused} onPause={onPause} />
      </div>
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
