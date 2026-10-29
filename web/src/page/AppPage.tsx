// An app's page: everything about one app in one place, opened from its
// row on Status. Its state and buttons at the top; how to reach it, what it
// uses, its week, and its last backup as four tiles; then its log (with
// Explain this), its updates, who uses it, and the actions needed now and
// then. screens/apppage.ts reads what it shows and runs what it does.
import { render, type ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { ago, bytes, never } from '../format';
import { Icon } from '../Icon';
import { Card, CardHead } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows } from '../parts/Row';
import { Tile } from '../status/Tiles';
import type { Pending } from '../status/AppList';

/** What the page does; screens/apppage.ts runs each. */
export interface AppPageActions {
  back: () => void;
  /** start, stop, restart, or rollback. */
  act: (action: string) => void;
  /** Update: what it brings first, then Update. */
  update: () => void;
  open: (url: string) => void;
  phone: () => void;
  signIn: (keys: string[]) => void;
  /** Copies text and says what was copied. */
  copy: (text: string) => Promise<string>;
  /** The end of its log: its last lines. */
  logs: (lines: number) => Promise<string>;
  /** What the Ollama on this machine says of its log. */
  explain: () => Promise<string>;
  backupNow: () => void;
  openBackups: () => void;
  /** Turns one of its settings on or off: "updates" or "alerts". */
  setting: (setting: string, on: boolean) => void;
  /** Remove: a backup of it first, then its container goes; its data stays. */
  remove: () => void;
  openPeople: () => void;
}

/** One day of the week's bars: the watchdog's passing and total runs. */
export interface Day {
  /** M, T, W…, as the system's calendar writes a weekday in one letter. */
  letter: string;
  /** Monday 27 Oct. */
  name: string;
  /** Monday. */
  weekday: string;
  ok: number;
  all: number;
  today: boolean;
}

export interface AppPageProps {
  a: api.AppStatus;
  entry?: api.App;
  /** The dot's class and the words for its state (AppList's stateOf). */
  state: [string, string];
  /** Its action since the click, until the runtime confirms it. */
  pending?: Pending;
  /** An app's command runs: the buttons wait. */
  busy: boolean;
  /** docker stats for it, while it runs: undefined until read, null when stats did not list it. */
  usage?: docker.Stat | null;
  /** What it keeps on disk, as the nightly backup last measured it. */
  disk?: number;
  days: Day[];
  backup: backup.Overview | null;
  /** The household members who use it; null when it is not one people sign in to. */
  people: people.Person[] | null;
  /** Dozzle's address while it runs, for following the log live; "" when not (or on a phone). */
  dozzle: string;
  /** The Ollama model that explains a log, "" when there is none. */
  explainer: string;
  /** This machine as the system calls it: "this Mac", "this PC". */
  machine: string;
  /** Its settings switched since the click, until Status says so. */
  switching: Record<string, boolean>;
  /** The app's own icon as a data: URL (its favicon, kept by the Go side); "" for none. */
  icon: string;
  /** The phone companion: no Open on a phone. */
  companion: boolean;
  on: AppPageActions;
}

const doing: Record<string, string> = { start: 'Starting…', stop: 'Stopping…', restart: 'Restarting…', update: 'Updating…', rollback: 'Rolling back…' };

/** How long it has been up: "up 8 hours", "up 3 days". */
export function uptime(since?: string): string {
  if (!since) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000)), hours = Math.round(mins / 60);
  return mins < 60 ? (mins <= 1 ? 'up a minute' : `up ${mins} minutes`) : hours < 48 ? (hours === 1 ? 'up an hour' : `up ${hours} hours`) : `up ${Math.round(hours / 24)} days`;
}

/** docker stats' memory ("182MiB", "1.4GiB") as a file size ("182 MB"). */
export function memory(mem: string): string {
  const m = /^([\d.]+)\s*([KMGT]?)i?B$/i.exec(mem.trim());
  if (!m) return mem;
  return bytes(Number(m[1]) * 1024 ** ' KMGT'.indexOf((m[2] || ' ').toUpperCase()));
}

/** When a backup ran, as a calendar says it: "Today, 03:12", "Yesterday, 03:12", "Mon 20 Oct". */
export function when(t: string, now = new Date()): string {
  const d = new Date(t);
  const clock = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 864e5);
  if (days === 0) return `Today, ${clock}`;
  if (days === 1) return `Yesterday, ${clock}`;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The tone of a day's bar: every check passed, some, none, or none run. */
export const dayTone = (d: Day) => (!d.all ? '' : d.ok === d.all ? 'ok' : d.ok ? 'warn' : 'bad');

/** The share of the week's checks it passed, 0 to 1 (1 with none run). */
export function weekShare(days: Day[]): number {
  const ok = days.reduce((n, d) => n + d.ok, 0), all = days.reduce((n, d) => n + d.all, 0);
  return all ? ok / all : 1;
}

/** The week in words: its tile's value and the line under it. */
export function weekWords(days: Day[]): [string, string] {
  const ok = days.reduce((n, d) => n + d.ok, 0), all = days.reduce((n, d) => n + d.all, 0);
  if (!all) return ['Not checked yet', 'The watchdog checks it every 15 minutes once Setup turns it on'];
  const missed = days.filter((d) => d.all && d.ok < d.all);
  if (!missed.length) return ['Up all week', 'Every check passed, every 15 minutes'];
  const share = Math.floor((ok / all) * 1000) / 10;
  return [`Up ${share}%`, `Missed checks on ${missed.map((d) => d.weekday).join(', ')}`];
}

function Week({ days }: { days: Day[] }) {
  const [, line] = weekWords(days);
  const said = days.map((d) => `${d.name}: ${!d.all ? 'not checked' : d.ok === d.all ? 'up' : `${d.ok} of ${d.all} checks passed`}`).join('; ');
  return (
    <>
      <div class="weekbars" role="img" aria-label={said}>
        {days.map((d) => (
          <span key={d.name} class={'day' + (d.today ? ' today' : '')} title={said.split('; ')[days.indexOf(d)]}>
            <span class={'bar ' + dayTone(d)} />{d.letter}
          </span>
        ))}
      </div>
      <span>{line}</span>
    </>
  );
}

/** A log's lines, a warning or an error tinted. */
function LogLines({ text }: { text: string }) {
  const lines = text.replace(/\s+$/, '').split('\n');
  return (
    <pre class="applog selectable" role="log" tabIndex={0} aria-label="Its log">
      {lines.map((l, i) => {
        const tone = /\b(ERROR|FATAL|PANIC|CRIT(ICAL)?)\b|level=(error|fatal)/i.test(l) ? 'bad' : /\bWARN(ING)?\b|level=warn/i.test(l) ? 'warn' : '';
        return <span key={i} class={tone ? 'line ' + tone : 'line'}>{l + '\n'}</span>;
      })}
    </pre>
  );
}

/** The log card: the end of its log, more of it, and Explain this. */
function Log({ explainer, machine, dozzle, on }: { explainer: string; machine: string; dozzle: string; on: AppPageActions }) {
  const [lines, setLines] = useState(200);
  const [text, setText] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState('');
  const read = (n: number) => {
    setLines(n);
    on.logs(n).then((t) => setText(t.trim() ? t : '(the log is empty)'), (e) => setText(String(e?.message || e)));
  };
  // The page is drawn afresh for each app (see mountAppPage), so this runs once per app.
  useEffect(() => { read(200); }, []);
  const ask = async () => {
    setAsking(true);
    setProblem('');
    try { setAnswer(await on.explain()); } catch (e: any) { setProblem(String(e?.message || e)); } finally { setAsking(false); }
  };
  return (
    <Card kind="alerts pagecard" id="appLog">
      <CardHead title="Log">
        <span class="actions">
          {lines < 2000 && <ActionLink onClick={() => read(2000)}>Show more of it</ActionLink>}
          {dozzle && <ActionLink title="Follow every log live in Dozzle" onClick={() => on.open(dozzle)}>Dozzle</ActionLink>}
          <button class="iconbtn" title="Read it again" aria-label="Read it again" onClick={() => read(lines)}><Icon name="restart" /></button>
          {explainer && <button class="small tint" disabled={asking} onClick={ask}>{asking ? 'Reading the log…' : 'Explain this'}</button>}
        </span>
      </CardHead>
      {text === null ? <p class="muted">Reading its log…</p> : <LogLines text={text} />}
      {(answer || problem) && !asking && (
        <div class="explained" role="status">
          {answer && <p class="answer">{answer}</p>}
          {problem && <p class="muted">{problem}</p>}
          <div class="row">
            <span class="muted"><Icon name="lock" /> Explained on {machine} by {explainer.replace(/:latest$/, '')}; the log never left it</span>
            <span class="actions"><ActionLink onClick={ask}>Ask again</ActionLink><ActionLink onClick={() => { setAnswer(''); setProblem(''); }}>Hide</ActionLink></span>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Copy, saying it was copied for a moment. */
function CopyButton({ text, copy }: { text: string; copy: (t: string) => Promise<string> }) {
  const [said, setSaid] = useState('');
  return (
    <button class="small" onClick={() => copy(text).then((s) => { setSaid(s); setTimeout(() => setSaid(''), 2500); }, () => {})}>
      {said ? <><Icon name="check" />Copied</> : 'Copy'}
    </button>
  );
}

/** The app's own icon in a tile, or its first letter when it has none
 * (or the picture cannot be drawn). A favicon of 24 pixels or less is
 * drawn larger with sharp pixels rather than blurred; a home screen icon
 * (a picture of 120 pixels or more) fills the tile, as on a phone. */
function AppMark({ name, icon }: { name: string; icon: string }) {
  const [broken, setBroken] = useState('');
  // How the picture is drawn, for the icon it was measured on.
  const [drawn, setDrawn] = useState({ of: '', size: '' });
  if (!icon || broken === icon) return <span class="appmark" aria-hidden="true">{name.slice(0, 1)}</span>;
  const picture = /^data:image\/(png|jpeg|webp)/.test(icon), size = drawn.of === icon ? drawn.size : '';
  const measure = (w: number) => setDrawn({ of: icon, size: w > 0 && w <= 24 && !icon.startsWith('data:image/svg') ? 'small' : picture && w >= 120 ? 'fill' : '' });
  return (
    <span class={'appmark icon' + (size === 'fill' ? ' fill' : '')} aria-hidden="true">
      <img src={icon} alt="" class={size === 'small' ? 'small' : ''} onError={() => setBroken(icon)}
        onLoad={(e) => measure((e.currentTarget as HTMLImageElement).naturalWidth)} />
    </span>
  );
}

function Header({ p }: { p: AppPageProps }) {
  const { a, entry, pending, busy, on } = p;
  const [tone, words] = pending && !pending.failed ? ['warn', doing[pending.action] || 'Working…'] : p.state;
  const up = a.state === 'running' && !pending ? uptime(a.since) : '';
  const url = a.address ? 'https://' + a.address : a.url || '';
  const run = (action: string, label: string, title: string, danger = false) => (
    <button class={'btn change' + (danger ? ' danger' : '')} title={title} disabled={busy} onClick={() => on.act(action)}>{label}</button>
  );
  const container = entry?.kind !== 'native' && a.state !== 'missing' && a.state !== 'elsewhere';
  return (
    <div class="pagehead">
      <div class="who">
        <AppMark name={a.name} icon={p.icon} />
        <div>
          <div class="titlerow">
            <h1>{a.name}</h1>
            <span class={'pill ' + tone}><span class={'dot ' + tone} />{words}{up && ` · ${up}`}</span>
          </div>
          {entry?.description && <p class="lead">{entry.description}</p>}
          {pending?.failed && <p class="rowerr" role="status">Could not {pending.action === 'rollback' ? 'roll back' : pending.action}: {pending.failed}</p>}
        </div>
      </div>
      <div class="toolbar">
        {container && (a.state === 'running'
          ? <span class="btngroup" role="group" aria-label="Run">{run('restart', 'Restart', 'Restart it')}{run('stop', 'Stop', 'Stop it; its data is kept')}</span>
          : run('start', 'Start', 'Start it'))}
        {a.state === 'running' && a.address && !p.companion && <button class="btn" disabled={busy} onClick={on.phone}><Icon name="phone" />Open on a phone</button>}
        {a.state === 'running' && url && <button class="primary small" onClick={() => on.open(url)}>Open</button>}
      </div>
    </div>
  );
}

function Facts({ p }: { p: AppPageProps }) {
  const { a, entry, usage, disk, days, backup: o, on } = p;
  const url = a.address ? 'https://' + a.address : a.url || '';
  const reach = entry?.public ? 'At home, and on the internet through the Cloudflare Tunnel'
    : a.address ? 'At home and on your tailnet, not on the internet' : 'On this machine only';
  const [weekValue] = weekWords(days);
  const late = o && !never(o.lastRun) && Date.now() - new Date(o.lastRun).getTime() > (o.staleAfterHours || 30) * 36e5;
  const tested = o && !never(o.restoreTest?.lastTest) ? `Restore test passed ${new Date(o.restoreTest.lastTest).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'No restore test yet';
  return (
    <div class="tiles facts">
      <Tile label="Address" value={url ? <a href={url} onClick={(e) => { e.preventDefault(); on.open(url); }}>{url.replace(/^https?:\/\//, '')}</a> : <span class="muted">None</span>}
        sub={<>{url ? reach : 'It has no web page'}{url && <CopyButton text={url} copy={on.copy} />}</>} />
      <Tile label="Uses now" value={a.state !== 'running' ? <span class="muted">Nothing</span> : usage ? <>{memory(usage.mem)}<small> of memory</small></> : <span class="muted">{usage === null ? 'Not measured' : '…'}</span>}
        sub={a.state !== 'running' ? 'It is not running' : <>{usage ? `${usage.cpu < 10 ? usage.cpu.toFixed(1) : Math.round(usage.cpu)}% of a processor` : usage === null ? 'The container runtime did not say' : 'Reading what it uses…'}{!!disk && <span>· {bytes(disk)} on disk</span>}</>} />
      <Tile label="This week" value={weekValue} tone={weekShare(days) < 0.99 ? 'warn' : ''} sub={<Week days={days} />} />
      <Tile label="Last backup" tone={late ? 'warn' : ''}
        value={!o ? <span class="muted">…</span> : never(o.lastRun) ? <span class="muted">Not yet</span> : <>{when(o.lastRun)}{!late && <span class="ok"> <Icon name="check" /></span>}</>}
        sub={<>{o ? tested : ''}<ActionLink onClick={on.openBackups}>Backups ›</ActionLink></>} />
    </div>
  );
}

function Updates({ p }: { p: AppPageProps }) {
  const { a, busy, on } = p;
  const rows: ComponentChildren[] = [];
  if (a.updatedAt) {
    rows.push(<Row key="now" dot="ok" title="The version it runs now" sub={`Updated ${ago(a.updatedAt)}; the one before is kept for a week`}
      end={<button class="small change" disabled={busy} title="Go back to the version it ran before, and hold its updates" onClick={() => on.act('rollback')}>Roll back</button>} />);
  }
  if (a.held) rows.push(<Row key="held" dot="warn" title="Its updates are held" sub={`After a rollback, the nightly update leaves it out; homelab updates release ${a.id} puts it back`} />);
  return (
    <Card kind="alerts pagecard" id="appUpdates">
      <CardHead title="Updates">
        {a.state === 'running' && <button class="small change" disabled={busy} title="Shows what it brings first: its newer releases' notes" onClick={on.update}>Check for an update</button>}
      </CardHead>
      {rows.length ? <Rows>{rows}</Rows> : <Empty>No update since the homelab last started it. The nightly update dumps its database first, then updates it.</Empty>}
    </Card>
  );
}

function People({ p }: { p: AppPageProps }) {
  const { entry, people, on } = p;
  if (!people && !entry?.login?.length) return null;
  return (
    <Card kind="alerts pagecard" id="appPeople">
      <CardHead title={people ? 'Who uses it' : 'Signing in'}>
        {!!entry?.login?.length && <button class="small" onClick={() => on.signIn(entry.login!)}><Icon name="key" />Sign-in details</button>}
      </CardHead>
      {people && (people.length
        ? <Rows>{people.map((x) => <Row key={x.username} title={<><span class="initial" aria-hidden="true">{(x.name || x.username).slice(0, 1)}</span>{x.name || x.username}</>} sub={x.email} />)}</Rows>
        : <Empty>Nobody in the household uses it yet.</Empty>)}
      {people && <p class="muted foot"><ActionLink onClick={on.openPeople}>Add someone in Settings › People</ActionLink></p>}
    </Card>
  );
}

/** One of its settings as a switch, with what it means beneath. */
function Switch({ label, sub, on, disabled, set }: { label: string; sub: string; on: boolean; disabled: boolean; set: (on: boolean) => void }) {
  return (
    <Row title={label} sub={sub}
      end={<>
        <input type="checkbox" class="switch change" role="switch" aria-label={label} checked={on} disabled={disabled} onChange={(e) => set(e.currentTarget.checked)} />
        {/* A phone that may only look sees the setting, not the switch. */}
        <span class="switchstate muted">{on ? 'On' : 'Off'}</span>
      </>} />
  );
}

function Settings({ p }: { p: AppPageProps }) {
  const { a, entry, busy, backup: o, switching, on } = p;
  const container = entry?.kind !== 'native' && a.state !== 'missing' && a.state !== 'elsewhere';
  const updates = switching.updates ?? !a.held, alerts = switching.alerts ?? !a.quiet;
  // What the nightly backup keeps of it: its database's copy (its own, or
  // the database it uses), and its files in the homelab folder.
  const ids = [a.id, ...(entry?.dependsOn || [])];
  const copy = o?.copies?.find((c) => ids.includes(c.id) && !c.volume && !never(c.newest));
  const kept = container ? (copy ? `Its files, and its database's copy from ${when(copy.newest)}` : 'Its files in the homelab folder, every night') : 'It runs on its own, outside the homelab; its own app keeps its data';
  return (
    <Card kind="alerts pagecard" id="appSettings">
      <CardHead title="Settings">{null}</CardHead>
      <Rows>
        {container && <Switch label="Nightly updates" disabled={busy || 'updates' in switching} on={updates} set={(v) => on.setting('updates', v)}
          sub={updates ? 'Every night, with a backup of its data first' : 'Held: the nightly update leaves it out'} />}
        <Switch label="Tell me if it stops" disabled={busy || 'alerts' in switching} on={alerts} set={(v) => on.setting('alerts', v)}
          sub={alerts ? `On your phone through ntfy, and on ${p.machine}` : 'Still checked and shown on Status, without an alert'} />
        <Row title="In the nightly backup" sub={kept} end={<ActionLink onClick={on.openBackups}>Backups ›</ActionLink>} />
      </Rows>
    </Card>
  );
}

function More({ p }: { p: AppPageProps }) {
  const container = p.entry?.kind !== 'native' && p.a.state !== 'missing' && p.a.state !== 'elsewhere';
  return (
    <Card kind="alerts pagecard" id="appMore">
      <CardHead title="More">{null}</CardHead>
      <div class="actions">
        <button class="small change" disabled={p.busy} title="Dumps every database and copies the settings now, as the nightly backup does" onClick={p.on.backupNow}>Back up now</button>
        <button class="small" onClick={p.on.openBackups}>Open Backups</button>
      </div>
      {container && !p.companion && (
        <div class="remove">
          <button class="small danger change" disabled={p.busy} title="Backs it up first; its container goes, its data stays in the homelab folder" onClick={p.on.remove}>Remove {p.a.name}…</button>
          <span class="muted">A backup first; its data stays, so Choose stacks can bring it back.</span>
        </div>
      )}
    </Card>
  );
}

export function AppPage(p: AppPageProps) {
  return (
    <div class="apppage">
      <ActionLink cls="back" onClick={p.on.back}>‹ Status</ActionLink>
      <Header p={p} />
      <Facts p={p} />
      <div class="pagecols">
        <div class="pagecol">
          {p.entry?.kind !== 'native' && p.a.state !== 'missing' && p.a.state !== 'elsewhere' && <Log explainer={p.explainer} machine={p.machine} dozzle={p.dozzle} on={p.on} />}
          <Updates p={p} />
        </div>
        <div class="pagecol">
          <Settings p={p} />
          <People p={p} />
          <More p={p} />
        </div>
      </div>
    </div>
  );
}

/** Draws the page into el, updating what changed since the last time. Each
 * app gets a page of its own (the key), so nothing one app's page holds (its
 * log, an answer, a Copied) is ever drawn on another's, not even for a frame,
 * and an answer that comes back after the page moved on is dropped. */
export function mountAppPage(el: Element, props: AppPageProps | null) { render(props ? <AppPage key={props.a.id} {...props} /> : null, el); }
