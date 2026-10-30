// Status's smaller cards: the watchdog's last run, protection, recent
// alerts, storage, and this week. app.ts reads each and mounts it into its
// card; these only draw.
import { render } from 'preact';
import { ActionLink } from '../ActionLink';
import { ago, never } from '../format';
import { CardHead as Head } from '../parts/Card';
import { Row, Rows, type Tone } from '../parts/Row';

export interface WatchdogProps {
  w: health.Summary;
  openSetup: () => void;
  fix: () => void;
}

/**
 * The watchdog's last run: every app, public address, database copy,
 * Duplicati job, and the CrowdSec bouncer, checked every 15 minutes by the
 * scheduled job. Failing checks are the ones it alerted about.
 */
export function Watchdog({ w, openSetup, fix }: WatchdogProps) {
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
        </span>
      </Head>
      {late && <div class="muted more">It has not run since {ago(w.lastRun)}. Setup › Install the jobs schedules it every 15 minutes.</div>}
      {!!failing.length && (
        <div class="row more">
          <span class="muted">Fix it restarts what is down or unwell and reconnects what dropped; it shows the plan first.</span>
          <button id="watchFix" class="small" onClick={fix}>Fix it</button>
        </div>
      )}
      {!!failing.length && (
        <Rows>
          {failing.map((f) => <Row key={f.name} dot="bad" title={f.name} sub={f.problem} when={ago(f.since)} whenTitle="Failing since" />)}
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
            <Row key={i} dot={a.banned ? 'bad' : ''} title={a.scenario} sub={[a.ip, a.country, a.network].filter(Boolean).join(' · ')}
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
  /** Why they could not be read. */
  problem?: string;
  openSetup: () => void;
}

/** Recent alerts: what the nightly updates, Duplicati, Uptime Kuma, and the watchdog sent to ntfy in the last 12 hours. */
export function Alerts({ events, problem, openSetup }: AlertsProps) {
  if (!events) {
    return (
      <Head title="Recent alerts">
        {/NTFY_READ_TOKEN/.test(problem || '')
          ? <span class="muted">They appear here once the alert token is set up. <ActionLink onClick={openSetup}>Open Setup</ActionLink></span>
          : <span class="muted">{problem}</span>}
      </Head>
    );
  }
  if (!events.length) return <Head title="Recent alerts"><span class="ok">✓ None in the last 12 hours</span></Head>;
  const shown = events.slice(0, 5);
  const tone = (e: notify.Event): Tone => ((e.priority || 0) >= 4 ? 'bad' : (e.tags || []).includes('white_check_mark') || /^recovered/i.test(e.title || '') ? 'ok' : '');
  return (
    <>
      <Head title="Recent alerts"><span class="muted">{events.length} in the last 12 hours</span></Head>
      <Rows>
        {shown.map((e) => (
          <Row key={e.id} dot={tone(e)} title={e.title || e.message} sub={e.title && e.message && e.message.split('\n').map((line, i) => <div key={i}>{line}</div>)}
            end={<span class="badge">{topicName[e.topic] || e.topic}</span>} when={ago(e.time)} />
        ))}
      </Rows>
      {events.length > shown.length && <div class="muted more">and {events.length - shown.length} more in the ntfy app</div>}
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
    <Rows kind="usage">
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
