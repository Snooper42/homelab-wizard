// Status's smaller cards: the watchdog's last run, protection, recent
// alerts, storage, and this week. app.ts reads each and mounts it into its
// card; these only draw.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { ago, clockText, dayText, never } from '../format';
import { CardHead as Head } from '../parts/Card';
import { Sheet } from '../parts/Sheet';
import { Row, Rows, type Tone } from '../parts/Row';
import { attackDetail, attackFrom, attackWords } from './attack';

export interface WatchdogProps {
  w: health.Summary;
  /** The stopped apps it doesn't check (stopped, not on purpose): said beside "All checks passed". */
  unchecked?: string[];
  openSetup: () => void;
  fix: () => void;
  /** Stops an app by its id: the memory card's Stop. */
  stop?: (id: string) => void;
  /** Snoozes a failing check's alerts for hours (0: alerts again now). */
  snooze?: (check: string, hours: number) => void;
}

/** When a snooze ends, in words: "3:40 PM" today, "Sat 9:15 AM" after. */
const wakeText = (t: string) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? clockText(d) : `${dayText(d, { weekday: 'short' })} ${clockText(d)}`;
};

/**
 * Snooze on a failing check: no alerts about it for an hour or a day, for a
 * failure you already know of. The watchdog goes on checking it, and alerts
 * when the snooze ends if it still fails.
 */
function SnoozePick({ check, until, snooze }: { check: string; until?: string; snooze: (check: string, hours: number) => void }) {
  return (
    <select class="snoozepick" aria-label={`Snooze the alerts about ${check}`} value="" onChange={(e) => { const v = e.currentTarget.value; if (v !== '') snooze(check, Number(v)); }}>
      <option value="" disabled>{until ? `Snoozed until ${wakeText(until)}` : 'Snooze…'}</option>
      <option value="1">For an hour</option>
      <option value="24">For a day</option>
      {until && <option value="0">Alert again now</option>}
    </select>
  );
}

/** Memory as the alert says it, in the binary units Docker sets it in: 2.1 GB, 900 MB. */
export const memText = (n: number) => (n >= 2 ** 30 ? `${(n / 2 ** 30).toFixed(1)} GB` : `${Math.round(n / 2 ** 20)} MB`);

/**
 * Memory nearly full: the apps have stayed above 90% of what Docker has
 * long enough for the watchdog to alert (health.StepMemory). The biggest,
 * each with Stop, until it comes down.
 */
function MemoryPressure({ m, stop }: { m: health.Memory; stop?: (id: string) => void }) {
  const share = m.total ? Math.round((m.used / m.total) * 100) : 0;
  return (
    <div id="memoryPressure">
      <div class="row more">
        <span><span class="bad">Memory nearly full:</span> <span class="muted">the apps use {share}% of the {memText(m.total)} Docker has, high since {ago(m.since)}. Stop one you don't need now.</span></span>
      </div>
      <Rows>
        {(m.biggest || []).map((a) => (
          <Row key={a.name} dot="warn" title={a.name} end={<>
            <span class="muted">{memText(a.bytes)}</span>
            {a.id && stop && <button class="small memstop" aria-label={`Stop ${a.name}`} onClick={() => stop(a.id!)}>Stop</button>}
          </>} />
        ))}
      </Rows>
    </div>
  );
}

/**
 * The watchdog's last run: every app, public address, database copy,
 * Duplicati job, and the CrowdSec bouncer, checked every 15 minutes by the
 * scheduled job. Failing checks are the ones it alerted about.
 */
export function Watchdog({ w, unchecked = [], openSetup, fix, stop, snooze }: WatchdogProps) {
  if (never(w.lastRun)) {
    return <Head title="Watchdog"><span class="muted">It checks every app, address, and backup every 15 minutes once the jobs are installed. <ActionLink onClick={openSetup}>Open Setup</ActionLink></span></Head>;
  }
  const failing = w.failing || [];
  const late = Date.now() - new Date(w.lastRun).getTime() > 45 * 60000;
  return (
    <>
      <Head title="Watchdog">
        <span>
          {failing.length ? <span class="bad">{failing.length} of {w.checks} checks failing</span> : <span class="ok">✓ All {w.checks} checks passed</span>}
          <span class="muted">{w.pending && !failing.length ? `, ${w.pending} checked again next run` : ''} · {ago(w.lastRun)}</span>
          {!!unchecked.length && <span class="warn unchecked"> · Not checked while stopped: {unchecked.join(', ')}</span>}
        </span>
      </Head>
      {w.memory && <MemoryPressure m={w.memory} stop={stop} />}
      {late && <div class="muted more">It has not run since {ago(w.lastRun)}. Setup › Install the jobs schedules it every 15 minutes.</div>}
      {!!failing.length && (
        <div class="row more">
          <span class="muted">Fix it restarts what is down or unwell and reconnects what dropped; it shows the plan first.</span>
          <button id="watchFix" class="small" onClick={fix}>Fix it</button>
        </div>
      )}
      {!!failing.length && (
        <Rows>
          {failing.map((f) => {
            const until = w.snoozed?.[f.name];
            return <Row key={f.name} dot="bad" title={f.name} sub={until ? `${f.problem}. No alerts about it until ${wakeText(until)}` : f.problem} when={ago(f.since)} whenTitle="Failing since"
              end={snooze && <SnoozePick check={f.name} until={until} snooze={snooze} />} />;
          })}
        </Rows>
      )}
    </>
  );
}

/** Protection: whether the proxy enforces CrowdSec's bans, and the attacks caught this week. */
export function Protection({ p, fix }: { p: crowdsec.Protection; fix: () => void }) {
  const recent = p.recent || [];
  const week = p.week === 1 ? '1 attack caught this week' : `${p.week} caught this week`;
  return (
    <>
      <Head title="Protection">
        <span>
          {p.enforced ? <span class="ok">✓ Bans enforced</span> : <span class="bad">Bans not enforced</span>}
          <span class="muted"> · {p.week ? week : 'nothing caught this week'}{p.bannedNow ? ` · ${p.bannedNow} banned now` : ''}</span>
        </span>
      </Head>
      {!p.enforced && (
        <div class="row more">
          <span class="muted" title={p.bouncer}>The proxy is not getting CrowdSec's ban list, so new attackers are not blocked.</span>
          <button id="protectFix" class="small" title="Reconnects the proxy to CrowdSec (both restart for a moment); shows the plan first" onClick={fix}>Fix</button>
        </div>
      )}
      {!!recent.length && (
        <Rows>
          {recent.slice(0, 3).map((a, i) => (
            <Row key={i} dot={a.banned ? 'bad' : ''} title={<span title={attackDetail(a)}>{attackWords(a.scenario)}</span>} sub={attackFrom(a)}
              end={a.banned && <span class="badge">Banned</span>} when={ago(a.when)} />
          ))}
        </Rows>
      )}
    </>
  );
}

const topicName: Record<string, string> = { watchtower: 'Updates', 'duplicati-alerts': 'Backups', 'uptime-kuma': 'Uptime Kuma', 'tunnel-watchdog': 'Watchdog' };

export interface AlertsProps {
  /** The alerts of the last 12 hours, newest first; null when they could not be read. */
  events: notify.Event[] | null;
  /** Every alert the computer kept (internal/history), newest first: Every alert…. */
  log: () => Promise<history.Alert[]>;
  /** Why they could not be read. */
  problem?: string;
  openSetup: () => void;
  /** Reads them again now, less those whose problem has cleared. */
  refresh: () => Promise<void>;
  /** The watchdog's last run, for Snooze… on an alert whose check still fails. */
  watch?: () => health.Summary | null;
  /** Snoozes a failing check's alerts for hours (0: alerts again now), as the Watchdog card's. */
  snooze?: (check: string, hours: number) => Promise<void>;
}

/** An alert's message, one line each: a long list (eleven apps that came back) shows its first 3 lines and Show the N more. */
function Lines({ text }: { text: string }) {
  const [all, setAll] = useState(false);
  const lines = text.split('\n').filter((l) => l.trim());
  const cut = !all && lines.length > 4;
  return (
    <>
      {(cut ? lines.slice(0, 3) : lines).map((line, i) => <div key={i}>{line}</div>)}
      {lines.length > 4 && <button type="button" class="linkbtn morelines" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show less' : `Show ${lines.length - 3} more`}</button>}
    </>
  );
}

/**
 * Recent alerts: what the nightly updates, Duplicati, Uptime Kuma, and the
 * watchdog sent to ntfy in the last 12 hours, less those whose problem has
 * cleared since (a later watchdog run passed, the apps a backup skipped run
 * again). Check again reads them now rather than at the next minute's poll.
 */
export function Alerts({ events, problem, openSetup, refresh, log, watch, snooze }: AlertsProps) {
  const [checking, setChecking] = useState(false);
  const again = () => { setChecking(true); refresh().finally(() => setChecking(false)); };
  const check = <button id="alertsCheck" class="small" disabled={checking} title="Reads the alerts again and leaves out those whose problem has cleared" onClick={again}>{checking ? 'Checking…' : 'Check again'}</button>;
  const every = <AlertLog log={log} watch={watch} snooze={snooze} />;
  if (!events) {
    return (
      <Head title="Recent alerts">
        {/NTFY_READ_TOKEN/.test(problem || '')
          ? <span class="muted">They appear here once the alert token is set up. <ActionLink onClick={openSetup}>Open Setup</ActionLink> {every}</span>
          : <span class="muted">{problem} {every}</span>}
      </Head>
    );
  }
  if (!events.length) return <Head title="Recent alerts"><span><span class="ok">✓ None in the last 12 hours</span> {check} {every}</span></Head>;
  const shown = events.slice(0, 5);
  const tone = (e: notify.Event): Tone => ((e.priority || 0) >= 4 ? 'bad' : (e.tags || []).includes('white_check_mark') || /^recovered/i.test(e.title || '') ? 'ok' : '');
  return (
    <>
      <Head title="Recent alerts"><span><span class="muted">{events.length} in the last 12 hours</span> {check} {every}</span></Head>
      <Rows>
        {shown.map((e) => (
          <Row key={e.id} dot={tone(e)} title={e.title || e.message} sub={e.title && e.message && <Lines text={e.message} />}
            end={<span class="badge">{topicName[e.topic] || e.topic}</span>} when={ago(e.time)} />
        ))}
      </Rows>
      {events.length > shown.length && <div class="muted more">and {events.length - shown.length} more in Every alert…</div>}
    </>
  );
}

/** What became of a kept alert: when its problem cleared, or who snoozed it until when; "" for neither. */
export function alertFate(a: history.Alert, now = Date.now()): string {
  if (a.clearedAt) return `Cleared at ${wakeText(a.clearedAt)}`;
  if (a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now) return a.snoozedBy ? `Snoozed by ${a.snoozedBy} until ${wakeText(a.snoozedUntil)}` : `Snoozed until ${wakeText(a.snoozedUntil)}`;
  return a.checks?.length ? 'Not cleared yet' : '';
}

/**
 * The checks of a kept alert that Snooze… is for: not cleared, and still
 * failing at the watchdog's last run. None for an alert about no check.
 */
export function snoozable(a: history.Alert, w: health.Summary | null | undefined): string[] {
  if (a.clearedAt || !w) return [];
  const failing = new Set((w.failing || []).map((f) => f.name));
  return (a.checks || []).filter((c) => failing.has(c));
}

/**
 * Every alert…: the computer's record of the alerts it sent (the last 90
 * days, internal/history), long after ntfy has let them go, each with when
 * its problem cleared or who snoozed it, and Snooze… on one whose check
 * still fails (hidden on a phone that only looks, as the Watchdog card's).
 */
function AlertLog({ log, watch, snooze }: { log: () => Promise<history.Alert[]>; watch?: () => health.Summary | null; snooze?: (check: string, hours: number) => Promise<void> }) {
  const [all, setAll] = useState<history.Alert[] | null>(null);
  const [problem, setProblem] = useState('');
  // The watchdog's run as it was when the sheet opened or a snooze ended.
  const [w, setW] = useState<health.Summary | null>(null);
  const sheet = () => document.getElementById('alertLogSheet');
  const open = () => {
    setProblem('');
    setW(watch?.() || null);
    log().then(setAll, (e) => setProblem(String(e?.message || e)));
    const s = sheet();
    if (s) s.hidden = false;
  };
  const close = () => { const s = sheet(); if (s) s.hidden = true; };
  // A snooze, then the watchdog's run and the record read again, so the pick says until when.
  const pick = (check: string, hours: number) => {
    if (!snooze) return;
    snooze(check, hours).then(() => { setW(watch?.() || null); return log().then(setAll); }, (e) => setProblem(String(e?.message || e)));
  };
  const tone = (a: history.Alert): Tone => (a.clearedAt ? 'ok' : (a.priority || 0) >= 4 ? 'bad' : '');
  return (
    <>
      <button type="button" class="small" onClick={open}>Every alert…</button>
      <Sheet id="alertLogSheet" titleId="alertLogTitle">
        <h2 id="alertLogTitle">Every alert</h2>
        <p class="muted">What the homelab alerted about in the last 90 days, kept on this computer: when each problem cleared, and who snoozed one.</p>
        {problem ? <p class="muted">{problem}</p>
          : all === null ? <p class="muted">Reading…</p>
            : all.length ? (
              <Rows>
                {all.map((a) => {
                  const fate = alertFate(a);
                  const open = snooze ? snoozable(a, w) : [];
                  return (
                    <Row key={a.id} dot={tone(a)} title={a.title}
                      sub={<>{a.body && <Lines text={a.body} />}{fate && <div class="fate">{fate}</div>}</>}
                      end={<>{open.map((c) => <SnoozePick key={c} check={c} until={w?.snoozed?.[c]} snooze={pick} />)}<span class="badge">{topicName[a.topic] || a.topic}</span></>} when={ago(a.at)} />
                  );
                })}
              </Rows>
            ) : <p class="muted">No alerts kept yet. From now on, each one the homelab sends is kept here for 90 days.</p>}
        <div class="actions"><button class="small" onClick={close}>Close</button></div>
      </Sheet>
    </>
  );
}

/** "412 GB": sizes in powers of 1000, as disks are sold. */
export function bytesText(n: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${i ? n.toFixed(n < 10 ? 1 : 0) : n} ${units[i]}`;
}

function Bars({ rows }: { rows: { label: string; bytes: number }[] }) {
  const most = rows[0].bytes;
  return (
    <Rows kind="usage sizes">
      {rows.map((r) => (
        <Row key={r.label} title={r.label} when={bytesText(r.bytes)} whenPlain>
          <div class="bar"><span style={`width:${Math.max(2, Math.round((r.bytes / most) * 100))}%`} /></div>
        </Row>
      ))}
    </Rows>
  );
}

/** Whether Storage has anything to show. */
export const storageShown = (rec: storage.Record | null) => (rec?.photos || []).some((p) => p.bytes > 0) || (rec?.apps || []).some((f) => f.bytes > 0);

/** Photos per person (Immich) and what each app keeps, as the nightly backup last measured them. */
export function Storage({ rec, nameOf }: { rec: storage.Record; nameOf: (id: string) => string }) {
  const people = (rec.photos || []).filter((p) => p.bytes > 0);
  const folders = (rec.apps || []).filter((f) => f.bytes > 0);
  const total = (rows: { bytes: number }[]) => rows.reduce((t, r) => t + r.bytes, 0);
  return (
    <>
      {!!people.length && <>
        <Head title="Photos per person"><span class="muted">{bytesText(total(people))} in Immich · {ago(rec.when)}</span></Head>
        <Bars rows={people.map((p) => ({ label: p.name, bytes: p.bytes }))} />
      </>}
      {!!folders.length && <>
        <Head title="What the apps keep"><span class="muted" title="Each app’s folder in data/appdata, measured by the nightly backup; photos and media on their own drive are not counted">{bytesText(total(folders))} of app data · {ago(rec.when)}</span></Head>
        <Bars rows={folders.slice(0, 6).map((f) => ({ label: nameOf(f.app), bytes: f.bytes }))} />
      </>}
    </>
  );
}

/** This week: the Sunday summary (homelab digest), one line per thing it looked at. */
export function Week({ w }: { w: app.Weekly }) {
  const lines = w.body.split('\n').filter(Boolean);
  // ✓ fine, • needs a look, ◦ still to set up on a new homelab; the rest
  // (savings, attacks caught, updates waiting) are news, in grey.
  const toSet = lines.filter((l) => l.startsWith('◦')).length;
  const head = w.problems ? <span class="warn">{`${w.problems} thing${w.problems === 1 ? '' : 's'} to look at`}</span>
    : toSet ? <span class="muted">{`Getting started: ${toSet} still to set up`}</span> : <span class="ok">✓ All well</span>;
  return (
    <>
      <Head title="This week">{head}</Head>
      <Rows kind="week">
        {lines.map((l, i) => <Row key={i} dot={l.startsWith('✓') ? 'ok' : l.startsWith('•') ? 'warn' : ''}>{l.replace(/^[✓•◦]\s*/, '')}</Row>)}
      </Rows>
      <p class="muted">The same summary reaches your phone on Sundays once alerts are set up.</p>
    </>
  );
}

export const mountWatchdog = (el: Element, props: WatchdogProps) => render(<Watchdog {...props} />, el);
export const mountProtection = (el: Element, props: { p: crowdsec.Protection; fix: () => void }) => render(<Protection {...props} />, el);
export const mountAlerts = (el: Element, props: AlertsProps) => render(<Alerts {...props} />, el);
export const mountStorage = (el: Element, props: { rec: storage.Record; nameOf: (id: string) => string }) => render(<Storage {...props} />, el);
export const mountWeek = (el: Element, props: { w: app.Weekly }) => render(<Week {...props} />, el);
/** Empties a card, so a card shown again starts afresh. */
export const clearCard = (el: Element) => render(null, el);
