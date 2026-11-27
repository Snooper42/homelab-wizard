import { AppMark } from '../parts/AppMark';
import { Crumbs } from '../parts/Crumbs';
import { render, type ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { ago, bytes, clockText, dayText, never } from '../format';
import { Icon } from '../Icon';
import { GearButton } from '../status/AppList';
import { Address } from '../parts/Address';
import { Card, CardHead } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { MenuButton } from '../parts/MenuButton';
import { Row, Rows } from '../parts/Row';
import { Sheet } from '../parts/Sheet';
import { Tile } from '../status/Tiles';
import { lasted, type Pending } from '../status/AppList';
import { stopChoices } from '../status/stopFor';
import { attackDetail, attackFrom, attackWords } from '../status/attack';

/** What the page does; screens/apppage.ts runs each. */
export interface AppPageActions {
  back: () => void;
  /** The Status page it was opened from (a category, Analytics, All apps), between Status and the app: none from the overview. */
  from?: { label: string; go: () => void } | null;
  /** Status' overview. */
  overview?: () => void;
  /** start, stop, restart, or rollback. */
  act: (action: string) => void;
  /** The output of its last command, in a sheet (after a failure). */
  details: () => void;
  /** Stop for a while: it starts again by itself at until. */
  stopFor: (until: string) => void;
  /** Update: what it brings first, then Update. */
  update: () => void;
  open: (url: string) => void;
  phone: () => void;
  /** Its sign-in details (the ⚙): address, logins, keys, what opens the backups, each to copy. */
  signIn: () => void;
  /** Copies text and says what was copied. */
  copy: (text: string) => Promise<string>;
  /** The end of its log: its last lines. */
  logs: (lines: number) => Promise<string>;
  /** What was done to it (internal/history), newest first. */
  done: () => Promise<history.Entry[]>;
  /** What was done to any app, or anything else, matching search. */
  allDone: (search: string) => Promise<history.Entry[]>;
  /** What the Ollama on this machine says of its log. */
  explain: () => Promise<string>;
  backupNow: () => void;
  openBackups: () => void;
  /** Turns one of its settings on or off: "updates", "sundays", "alerts",
   * or "away" (a public app reached away from home through the tunnel, or
   * home only). */
  setting: (setting: string, on: boolean) => void;
  /** Remove: a backup of it first, then its container goes; its data stays. */
  remove: () => void;
  openPeople: () => void;
  /** Connect apps (qBittorrent's page, when it ties qBittorrent to the VPN's tunnel), then asks again. */
  connect: () => void;
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
  /** Its passwords and keys not ticked Saved yet: a dot on its ⚙. */
  unkept?: number;
  entry?: api.App;
  /** The dot's class and the words for its state (AppList's stateOf). */
  state: [string, string];
  /** Why it isn't running and what to do (stopFor's stoppedNext): empty while it runs. */
  next?: [string, string];
  /** Its action since the click, until the runtime confirms it. */
  pending?: Pending;
  /** An app's command runs: the buttons wait. */
  busy: boolean;
  /** docker stats for it, while it runs: undefined until read, null when stats did not list it. */
  usage?: docker.Stat | null;
  /** What it keeps on disk, as the nightly backup last measured it. */
  disk?: number;
  days: Day[];
  /** The watchdog's outages of it this week (none from an older agent). */
  outages?: health.Outage[];
  /** The watchdog has run: its checks are on. */
  watching?: boolean;
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
  /** The web page (homelab serve): its Dozzle is kept to the computer. */
  companion: boolean;
  /** The proxy's and CrowdSec's pages: what CrowdSec stopped ('reading' until it answers, null when it could not be read). Left out on other apps' pages. */
  stopped?: crowdsec.Protection | null | 'reading';
  /** qBittorrent's page, on this computer: whether its downloads leave only through the VPN ('reading' until it answers, null when it could not be read). Left out elsewhere. */
  privacy?: wiring.Privacy | null | 'reading';
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
  const clock = clockText(d);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 864e5);
  if (days === 0) return `Today, ${clock}`;
  if (days === 1) return `Yesterday, ${clock}`;
  return dayText(d, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** The tone of a day's bar: every check passed, some, none, or none run. */
export const dayTone = (d: Day) => (!d.all ? '' : d.ok === d.all ? 'ok' : d.ok ? 'warn' : 'bad');

/** The share of the week's checks it passed, 0 to 1 (1 with none run). */
export function weekShare(days: Day[]): number {
  const ok = days.reduce((n, d) => n + d.ok, 0), all = days.reduce((n, d) => n + d.all, 0);
  return all ? ok / all : 1;
}

/** The week's last time down in words: "Last down Tue at 3:10 AM for 45
 * minutes: HTTP 502", or "Down since Tue at 3:10 AM: HTTP 502" while it is,
 * and "· 2 outages" when it was down more than once. */
export function lastDown(outages: health.Outage[], weekFrom: number, now = Date.now()): string {
  const shown = outages.filter((o) => (o.to ? new Date(o.to).getTime() : now) > weekFrom);
  if (!shown.length) return '';
  const o = shown.reduce((a, b) => (new Date(b.from) > new Date(a.from) ? b : a));
  const from = new Date(o.from), at = `${dayText(from, { weekday: 'short' })} at ${clockText(from)}`;
  const line = o.to ? `Last down ${at} for ${lasted(new Date(o.to).getTime() - from.getTime())}: ${o.problem}` : `Down since ${at}: ${o.problem}`;
  return shown.length > 1 ? `${line} · ${shown.length} outages` : line;
}

/** The week in words: its tile's value and the line under it. With the
 * watchdog's outages (none from an older agent), the last time it was down
 * and why; without, how many checks it didn't answer, and when. */
export function weekWords(days: Day[], outages?: health.Outage[], now = Date.now(), seen: { watching?: boolean; stopped?: boolean } = {}): [string, string] {
  const ok = days.reduce((n, d) => n + d.ok, 0), all = days.reduce((n, d) => n + d.all, 0);
  if (!all) {
    // Not "once Setup turns it on" while the watchdog runs: Status's header says checks are on.
    if (seen.watching && seen.stopped) return ['Not checked', "The watchdog doesn't check it while it's stopped"];
    if (seen.watching) return ['Not checked yet', 'The watchdog checks it every 15 minutes, from its next run'];
    return ['Not checked yet', 'The watchdog checks it every 15 minutes once Setup turns it on'];
  }
  const missed = days.filter((d) => d.all && d.ok < d.all);
  if (!missed.length) return ['Up all week', 'Every check passed, every 15 minutes'];
  const share = Math.floor((ok / all) * 1000) / 10;
  const first = new Date(now);
  const weekFrom = new Date(first.getFullYear(), first.getMonth(), first.getDate() - 6).getTime();
  if (outages) return [`Up ${share}%`, lastDown(outages, weekFrom, now) || 'Each check it missed passed the next time'];
  const n = missed.reduce((k, d) => k + d.all - d.ok, 0);
  return [`Up ${share}%`, `It didn't answer ${n} of its checks on ${missed.map((d) => d.weekday).join(', ')}`];
}

function Week({ days, outages, seen }: { days: Day[]; outages?: health.Outage[]; seen: { watching?: boolean; stopped?: boolean } }) {
  const [, line] = weekWords(days, outages, Date.now(), seen);
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
            <span class="muted"><Icon name="lock" /> On {machine} · {explainer.replace(/:latest$/, '')}</span>
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

function Header({ p }: { p: AppPageProps }) {
  const { a, entry, pending, busy, on } = p;
  const [tone, words] = pending && !pending.failed ? ['warn', pending.note || doing[pending.action] || 'Working…'] : p.state;
  const up = a.state === 'running' && !pending ? uptime(a.since) : '';
  const url = a.address ? 'https://' + a.address : a.url || '';
  const run = (action: string, label: string, title: string, danger = false) => (
    <button class={'btn change' + (danger ? ' danger' : '')} title={title} disabled={busy} onClick={() => on.act(action)}>{label}</button>
  );
  const container = entry?.kind !== 'native' && a.state !== 'missing' && a.state !== 'elsewhere';
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 5000);
    return () => clearTimeout(t);
  }, [sure]);
  const stop = (
    <button class={'btn change' + (sure ? ' danger confirm' : '')} title="Stop it; its data is kept, and nothing starts it again by itself until you do" disabled={busy}
      onBlur={() => setSure(false)} onClick={() => { if (!sure) { setSure(true); return; } setSure(false); on.act('stop'); }}>
      {sure ? 'Click again to stop' : 'Stop'}
    </button>
  );
  return (
    <div class="pagehead">
      <div class="who">
        <AppMark id={a.id} name={a.name} icon={p.icon} />
        <div>
          <div class="titlerow">
            <h1>{a.name}</h1>
            <span class={'pill ' + tone}><span class={'dot ' + tone} />{words}{up && ` · ${up}`}</span>
          </div>
          {entry?.description && <p class="lead">{entry.description}</p>}
          {p.next?.[0] && !pending && (
            <p class="stopnext" role="note">{p.next[0]}{p.next[1] && <span class="change"> {p.next[1]}</span>}
              {p.next[1] && <span class="lookonly"> Start it from the computer: this phone can only look.</span>}</p>
          )}
          {pending?.failed && <p class="rowerr" role="status">Could not {pending.action === 'rollback' ? 'roll back' : pending.action}: {pending.failed}{pending.log && <> <button type="button" class="linkbtn" onClick={on.details}>Details</button></>}</p>}
        </div>
      </div>
      <div class="toolbar">
        {container && (a.state === 'running'
          ? <>
            <span class="btngroup" role="group" aria-label="Run">{run('restart', 'Restart', 'Restart it')}{stop}</span>
            <MenuButton label="Stop for a while" title="Stop it now, and it starts again by itself later" menuLabel={`Stop ${a.name} for a while`} disabled={busy}
              cls="btn change" items={stopChoices().map((c) => ({ label: c.label, onClick: () => on.stopFor(c.until) }))} foot="It starts again by itself then." />
          </>
          : run('start', 'Start', 'Start it'))}
        {a.state === 'running' && a.address && <button class="btn openphone" disabled={busy} onClick={on.phone}><Icon name="phone" />Open on a phone</button>}
        {a.state === 'running' && url && <button class="primary small" onClick={() => on.open(url)}>Open</button>}
        <GearButton name={a.name} unsaved={p.unkept || 0} open={on.signIn} />
      </div>
    </div>
  );
}

function Facts({ p }: { p: AppPageProps }) {
  const { a, entry, usage, disk, days, backup: o, on } = p;
  const url = a.address ? 'https://' + a.address : a.url || '';
  const reach = entry?.public ? 'At home, and on the internet through the Cloudflare Tunnel'
    : a.address ? 'Your own private network, not on the internet' : 'On this machine only';
  const seen = { watching: p.watching, stopped: a.state === 'stopped' };
  const [weekValue] = weekWords(days, p.outages, Date.now(), seen);
  const late = o && !never(o.lastRun) && Date.now() - new Date(o.lastRun).getTime() > (o.staleAfterHours || 30) * 36e5;
  const tested = o && !never(o.restoreTest?.lastTest) ? `Restore test passed ${dayText(new Date(o.restoreTest.lastTest), { day: 'numeric', month: 'short' })}` : 'No restore test yet';
  return (
    <div class="tiles facts">
      <Tile label="Address" value={url ? <a href={url} onClick={(e) => { e.preventDefault(); on.open(url); }}><Address text={url.replace(/^https?:\/\//, '')} /></a> : <span class="muted">None</span>}
        sub={<>{url ? reach : 'It has no web page'}{url && <CopyButton text={url} copy={on.copy} />}</>} />
      <Tile label="Uses now" value={a.state !== 'running' ? <span class="muted">Nothing</span> : usage ? <>{memory(usage.mem)}<small> of memory</small></> : <span class="muted">{usage === null ? 'Not measured' : '…'}</span>}
        sub={a.state !== 'running' ? 'It is not running' : <>{usage ? `${usage.cpu < 10 ? usage.cpu.toFixed(1) : Math.round(usage.cpu)}% of a processor` : usage === null ? 'The container runtime did not say' : 'Reading what it uses…'}{!!disk && <span>· {bytes(disk)} on disk</span>}</>} />
      <Tile label="This week" value={weekValue} tone={weekShare(days) < 0.99 ? 'warn' : ''} sub={<Week days={days} outages={p.outages} seen={seen} />} />
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
    rows.push(<Row key="now" dot="ok" title="The version it runs now" sub={`Updated ${ago(a.updatedAt)}`}
      end={<button class="small change" disabled={busy} title="Go back to the version it ran before, and hold its updates" onClick={() => on.act('rollback')}>Roll back</button>} />);
  }
  if (a.held) rows.push(<Row key="held" dot="warn" title="Its updates are held" />);
  return (
    <Card kind="alerts pagecard" id="appUpdates">
      <CardHead title="Updates">
        {a.state === 'running' && <button class="small change" disabled={busy} title="Shows what it brings first: its newer releases' notes" onClick={on.update}>Check for an update</button>}
      </CardHead>
      {rows.length ? <Rows>{rows}</Rows> : <Empty>No update since it last started.</Empty>}
    </Card>
  );
}

/** An entry's line under its title: when, and who did it. */
export function doneSub(e: history.Entry): string {
  const when = ago(e.at);
  return `${when.charAt(0).toUpperCase()}${when.slice(1)}, by ${e.who}`;
}

/** What was done to this app (internal/history): its newest few, and
 * everything that was done, searchable, in a sheet. */
function Done({ on }: { on: AppPageActions }) {
  const [rows, setRows] = useState<history.Entry[] | null>(null);
  const [problem, setProblem] = useState('');
  const [all, setAll] = useState<history.Entry[] | null>(null);
  const [q, setQ] = useState('');
  // The page is drawn afresh for each app (see mountAppPage), so this runs once per app.
  useEffect(() => { on.done().then(setRows, (e) => setProblem(String(e?.message || e))); }, []);
  useEffect(() => {
    if (all === null) return;
    const t = setTimeout(() => on.allDone(q).then(setAll, (e) => setProblem(String(e?.message || e))), 200);
    return () => clearTimeout(t);
  }, [q]);
  const open = () => {
    on.allDone(q).then(setAll, (e) => setProblem(String(e?.message || e)));
    const s = document.getElementById('doneSheet');
    if (s) s.hidden = false;
  };
  const close = () => { const s = document.getElementById('doneSheet'); if (s) s.hidden = true; };
  const shown = (rows || []).slice(0, 6);
  return (
    <Card kind="alerts pagecard" id="appDone">
      <CardHead title="Recently done">
        <button class="small change" onClick={open}>Everything that was done…</button>
      </CardHead>
      {problem ? <Empty>{problem}</Empty>
        : rows === null ? <Empty>Reading…</Empty>
          : shown.length ? <Rows>{shown.map((e) => <Row key={e.id} title={e.text} sub={doneSub(e)} />)}</Rows>
            : <Empty>Nothing yet.</Empty>}
      <Sheet id="doneSheet" titleId="doneTitle">
        <h2 id="doneTitle">Everything that was done</h2>
        <input type="search" class="donesearch" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} placeholder="Search: an app, a phone, restarted…" aria-label="Search what was done" autocomplete="off" spellcheck={false} />
        {all === null ? <Empty>Reading…</Empty>
          : all.length ? <Rows>{all.map((e) => <Row key={e.id} title={e.text} sub={doneSub(e)} />)}</Rows>
            : <Empty>{q.trim() ? `Nothing done matches “${q.trim()}”.` : "Nothing done yet that's kept here."}</Empty>}
        <div class="actions"><button class="small" onClick={close}>Close</button></div>
      </Sheet>
    </Card>
  );
}

/** The proxy's and CrowdSec's pages: every address CrowdSec stopped today, where it came from, and what it tried. */
function Stopped({ stopped }: { stopped: crowdsec.Protection | null | 'reading' }) {
  const reading = stopped === 'reading', s = reading ? null : stopped;
  const today = s?.today || [];
  const more = (s?.todayCount || 0) - today.length;
  const head = s && (s.todayCount === 1 ? '1 today' : `${s.todayCount} today`) + (s.bannedNow ? ` · ${s.bannedNow} banned now` : '');
  const quiet = !s ? '' : s.week ? `Nothing yet today; ${s.week === 1 ? '1' : s.week} this week${s.recent?.[0] ? `, the last ${ago(s.recent[0].when)}` : ''}.` : 'Nothing this week.';
  return (
    <Card kind="alerts pagecard" id="appStopped">
      <CardHead title="What CrowdSec stopped today">{head && <span class="muted">{head}</span>}</CardHead>
      {reading && <Empty>Asking CrowdSec…</Empty>}
      {!s && !reading && <Empty>CrowdSec can't be read: it and the proxy need to be running.</Empty>}
      {s && !s.enforced && (
        <Rows><Row dot="bad" title="Bans aren't reaching the proxy" sub={`${s.bouncer}. Status › Protection › Fix reconnects them.`} /></Rows>
      )}
      {s && (today.length ? (
        <Rows>
          {today.map((a, i) => (
            <Row key={i} dot={a.banned ? 'bad' : ''} title={<span title={attackDetail(a)}>{attackWords(a.scenario)}</span>} sub={attackFrom(a)}
              end={a.banned && <span class="badge" title="A ban on it is still in force">Banned</span>} when={clockText(new Date(a.when))} whenTitle={ago(a.when)} />
          ))}
          {more > 0 && <Row sub={more === 1 ? 'and 1 more today' : `and ${more} more today`} />}
        </Rows>
      ) : <Empty>{quiet}</Empty>)}
    </Card>
  );
}

/** qBittorrent's page: whether its downloads leave only through the VPN, as Setup checks it. */
function Private({ privacy, connect, busy }: { privacy: wiring.Privacy | null | 'reading'; connect: () => void; busy: boolean }) {
  const reading = privacy === 'reading', v = reading ? null : privacy;
  return (
    <Card kind="alerts pagecard" id="appPrivate">
      <CardHead title="Downloads are private">{null}</CardHead>
      {reading && <Empty>Asking qBittorrent and the VPN…</Empty>}
      {!v && !reading && <Empty>Can't check right now.</Empty>}
      {v && (
        <Rows>
          <Row dot={v.private ? 'ok' : 'bad'} title={v.private ? 'Yes: only through the VPN' : 'Not yet'} sub={v.said}
            end={v.fix === 'wire' && <button class="small change" disabled={busy} onClick={connect}>Connect apps</button>} />
          {/* Searching (Prowlarr) too: through the VPN when it lives in Gluetun's network (SEARCH_THROUGH_VPN). */}
          {v.search && <Row dot={/through ProtonVPN/.test(v.search) ? 'ok' : 'warn'} title={/through ProtonVPN/.test(v.search) ? 'Searching: through the VPN too' : 'Searching: from your home connection'} sub={v.search} />}
        </Rows>
      )}
    </Card>
  );
}

function People({ p }: { p: AppPageProps }) {
  const { entry, people, on } = p;
  if (!people && !entry?.login?.length) return null;
  return (
    <Card kind="alerts pagecard" id="appPeople">
      <CardHead title={people ? 'Who uses it' : 'Signing in'}>
        {!!entry?.login?.length && <button class="small" onClick={() => on.signIn()}><Icon name="key" />Sign-in details</button>}
      </CardHead>
      {people && (people.length
        ? <Rows>{people.map((x) => <Row key={x.username} lead={<span class="initial" aria-hidden="true">{(x.name || x.username).slice(0, 1)}</span>} title={x.name || x.username} sub={x.email} />)}</Rows>
        : <Empty>Nobody in the household uses it yet.</Empty>)}
      {people && <p class="muted foot"><ActionLink onClick={on.openPeople}>Add someone in Settings › People</ActionLink></p>}
    </Card>
  );
}

/** One of its settings as a switch, with what it means beneath. */
function Switch({ label, sub, on, disabled, set }: { label: string; sub?: string; on: boolean; disabled: boolean; set: (on: boolean) => void }) {
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
  // Reach shows only for an app that can be published, once the domain has the tunnel.
  const away = switching.away ?? a.reach === 'away';
  // Its update window: Sundays only (homelab updates days sets any days; the switch says those, and off is every night).
  const days = a.updateDays || [], ownDays = switching.sundays ?? days.length > 0;
  const daysText = switching.sundays || !days.length ? 'Sundays' : weekdaysText(days);
  // What the nightly backup keeps of it: its database's copy (its own, or
  // the database it uses), and its files in the homelab folder.
  const ids = [a.id, ...(entry?.dependsOn || [])];
  const copy = o?.copies?.find((c) => ids.includes(c.id) && !c.volume && !never(c.newest));
  const kept = container ? (copy ? when(copy.newest) : undefined) : 'Outside the homelab';
  return (
    <Card kind="alerts pagecard" id="appSettings">
      <CardHead title="Settings">{null}</CardHead>
      <Rows>
        {container && <Switch label="Nightly updates" disabled={busy || 'updates' in switching} on={updates} set={(v) => on.setting('updates', v)}
          sub={!updates ? 'Held' : ownDays ? `On ${daysText} only` : 'Every night'} />}
        {container && updates && <Switch label={`Only on ${daysText}`} disabled={busy || 'sundays' in switching} on={ownDays} set={(v) => on.setting('sundays', v)} />}
        <Switch label="Tell me if it stops" disabled={busy || 'alerts' in switching} on={alerts} set={(v) => on.setting('alerts', v)}
          sub={alerts ? `On your phone and ${p.machine}` : 'Shown on Status, without an alert'} />
        {a.reach && <Switch label="Reach it away from home" disabled={busy || 'away' in switching} on={away} set={(v) => on.setting('away', v)}
          sub={away ? 'Opens anywhere through your Cloudflare tunnel; away from home, Cloudflare can see what passes' : 'Home only: it opens on your home Wi-Fi, and nobody outside can reach it'} />}
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
      {container && (
        <div class="remove">
          <button class="small danger change" disabled={p.busy} title="Backs it up first; its container goes, its data stays in the homelab folder" onClick={p.on.remove}>Remove {p.a.name}…</button>
          <span class="muted">A backup first; its data stays, so Choose apps can bring it back.</span>
        </div>
      )}
    </Card>
  );
}

export function AppPage(p: AppPageProps) {
  return (
    <div class="apppage">
      <Crumbs trail={p.on.from ? [{ label: 'Status', go: p.on.overview || p.on.back }, p.on.from] : [{ label: 'Status', go: p.on.back }]} here={p.a.name} />
      <Header p={p} />
      <Facts p={p} />
      <div class="pagecols">
        <div class="pagecol">
          {p.entry?.kind !== 'native' && p.a.state !== 'missing' && p.a.state !== 'elsewhere' && <Log explainer={p.explainer} machine={p.machine} dozzle={p.dozzle} on={p.on} />}
          {p.stopped !== undefined && <Stopped stopped={p.stopped} />}
          {p.privacy !== undefined && <Private privacy={p.privacy} connect={p.on.connect} busy={p.busy} />}
          <Updates p={p} />
          <Done on={p.on} />
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

export function mountAppPage(el: Element, props: AppPageProps | null) { render(props ? <AppPage key={props.a.id} {...props} /> : null, el); }

const dayWords: Record<string, string> = { mon: 'Mondays', tue: 'Tuesdays', wed: 'Wednesdays', thu: 'Thursdays', fri: 'Fridays', sat: 'Saturdays', sun: 'Sundays' };
/** "Sundays", "Saturdays and Sundays", as the CLI says them. */
export function weekdaysText(days: string[]): string {
  const w = days.map((d) => dayWords[d] || d);
  return w.length < 2 ? w.join('') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
}
