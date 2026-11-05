// Status's app list: every app grouped by category (what needs a look
// first, in a group of its own), each folding into its heading, with the
// app's state, address, and buttons. Preact updates only what changed, so
// a live change leaves the focus and an open tooltip where they were.
// Which categories are open is the list's own: a click folds or opens one
// without app.ts or the backend. Typing on Status narrows it to the apps
// whose name has what is typed, as Finder does (Filter, below).
import { render, type JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { Icon } from '../Icon';
import { Address } from '../parts/Address';
import { Hover } from '../parts/Hover';
import { awaitingJobs } from './Tiles';
import { formatMem } from './memory';
import { stopChoices, stoppedWords } from './stopFor';
import { RowMenu, type RowMenuActions } from './RowMenu';
import { changedSince, type Seen } from './changed';

export interface Group {
  label: string;
  apps: api.AppStatus[];
  /** What needs a look: its count in red, never folded by default. */
  alert?: boolean;
  /** The apps pinned to the top: open by default, as the point of them is a glance. */
  pinned?: boolean;
}

/** What the rows do; app.ts runs each. */
export interface AppListActions {
  /** start, stop, restart, update, or rollback (Start from a row; the rest from the page). */
  act: (a: api.AppStatus, action: string) => void;
  openNative: (a: api.AppStatus) => Promise<void>;
  install: (a: api.AppStatus) => void;
  adopt: (a: api.AppStatus) => void;
  open: (url: string) => void;
  /** Its project's releases newer than what it runs (GitHub), for "updates held" on hover. */
  releaseNotes: (id: string) => Promise<releases.Preview>;
  /** Opens the app's page. */
  page: (a: api.AppStatus) => void;
  /** Starts each app in turn; reports which is at hand. */
  startAll: (apps: api.AppStatus[], progress: (i: number) => void) => Promise<void>;
  /** Starts, stops, or restarts each app of a group in turn (its heading's menu); reports which is at hand. A stop with until is for a while: they start again then. */
  groupAct: (apps: api.AppStatus[], action: 'start' | 'stop' | 'restart', progress: (i: number) => void, until?: string) => Promise<void>;
  /** What a row's own menu does (a right-click, Shift+F10, or the context-menu key). */
  menu: RowMenuActions;
  /** The output of its last command (Start, Stop, Restart), in a sheet: after a failure. */
  details: (a: api.AppStatus) => void;
}

/** A row's action the runtime has not confirmed yet, or why it failed. */
export interface Pending {
  /** start, stop, restart, update, or rollback. */
  action: string;
  /** Why it failed: the row is back as it was, with this under it. */
  failed?: string;
  /** What it is doing within the action, in place of "Starting…" ("Downloading the app…"). */
  note?: string;
  /** Its command's output is kept: Details shows it (after a failure). */
  log?: boolean;
}

export interface AppListProps {
  groups: Group[];
  /** Each app's action since its click, by app ID. */
  pending: Record<string, Pending>;
  catalog: api.Catalog | null;
  /** Each app's share of the watchdog's passing checks this week, 0 to 1. */
  weekUp: Record<string, number>;
  /** Each app's times down this week, oldest first (the watchdog's). */
  outages?: Record<string, health.Outage[]>;
  /** Each app as Status last showed it before this visit (changed.ts): a row that changed since has a dot. */
  seen?: Seen | null;
  batteryPaused: Set<string>;
  /** The apps stopped on purpose, and until when: nothing starts them by itself. */
  held: Record<string, stopped.Stop>;
  /** An app's command runs: every row's buttons wait. */
  busy: boolean;
  /** The phone companion: no Start all, and no menu on a group's heading. */
  companion: boolean;
  /** What each app holds in memory now, in bytes by app ID (its helpers with it); none until Status has sampled it. */
  memory?: Record<string, number>;
  os: 'mac' | 'windows' | 'linux';
  on: AppListActions;
}

/** One dot class and a few words for an app's state and health. */
export function stateOf(a: api.AppStatus, batteryPaused: Set<string>, held: Record<string, stopped.Stop> = {}): [string, string] {
  // Stopped on purpose is no trouble: a plain dot.
  if (a.state === 'stopped' && held[a.id]) return ['', stoppedWords(held[a.id])];
  if (a.state !== 'running' && batteryPaused.has(a.id)) return ['warn', 'Paused on battery'];
  if (a.state === 'stopped' && a.waitingFor) return ['warn', `Waiting for the ${a.waitingFor.replace(/^\/Volumes\//, '')} drive`];
  if (a.state === 'running') {
    if (a.health === 'unhealthy') return ['bad', 'Unhealthy'];
    if (a.health === 'restarting') return ['bad', 'Restarting'];
    if (a.health === 'starting') return ['warn', 'Starting'];
    if (a.notAnswering) return ['bad', `Not answering: ${a.notAnswering}`];
    return ['ok', a.health === 'native' ? 'Running (native app)' : 'Running'];
  }
  // The phone companion is homelab serve, which the scheduled jobs run.
  if (a.state === 'not running' && a.id === 'homelab-companion') return ['', 'Starts with the scheduled jobs (Setup)'];
  const words: Record<string, [string, string]> = { stopped: ['warn', 'Stopped'], missing: ['bad', 'Not running'], elsewhere: ['warn', 'Runs elsewhere'], 'not running': ['warn', 'Not running'] };
  return words[a.state] || ['', a.state];
}

// What a row says the moment its button is clicked, and when that failed.
const doing: Record<string, string> = { start: 'Starting…', stop: 'Stopping…', restart: 'Restarting…', update: 'Updating…', rollback: 'Rolling back…' };
const verb: Record<string, string> = { start: 'start', stop: 'stop', restart: 'restart', update: 'update', rollback: 'roll back' };

/** A link that opens in the browser. */
/** The modifier key's name as each system says it: ⌥ (Option) on a Mac, Alt elsewhere. */
const alt = (os: string) => (os === 'mac' ? '⌥' : 'Alt-');
const shift = (os: string) => (os === 'mac' ? '⇧' : 'Shift-');

/** A row's address: a click opens it; ⌥-click (Alt-click) copies it, and says so under the row. */
function Link({ url, text, open, copy, os }: { url: string; text: string; open: (url: string) => void; copy: (url: string) => void; os: string }) {
  return <ActionLink title={`${alt(os)}click copies it`} onClick={(e) => (e?.altKey ? copy(url) : open(url))}><Address text={text} /></ActionLink>;
}

const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const weekday = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });
/** How long, in a few words: "45 minutes", "2 hours", "1 day". */
export function lasted(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000)), hours = Math.round(mins / 60);
  return mins < 60 ? (mins === 1 ? 'a minute' : `${mins} minutes`) : hours < 48 ? (hours === 1 ? 'an hour' : `${hours} hours`) : `${Math.round(hours / 24)} days`;
}

/** One outage in words: "Tue 3:15 AM, 45 minutes: nothing answers on its port". */
export function outageWords(o: health.Outage, now = Date.now()): string {
  const from = new Date(o.from), to = o.to ? new Date(o.to).getTime() : 0;
  return `${weekday(from)} ${clock(from)}, ${to ? lasted(to - from.getTime()) : `down for ${lasted(now - from.getTime())} now`}: ${o.problem}`;
}

/** The week's outages, for "94% up this week": a strip of the 7 days with each time it was down, and why. */
export function WeekOutages({ outages = [], now = Date.now() }: { outages?: health.Outage[]; now?: number }) {
  const end = new Date(now), first = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  const t0 = first.getTime(), span = now - t0;
  const days = Array.from({ length: 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const shown = outages.filter((o) => (o.to ? new Date(o.to).getTime() : now) > t0);
  return (
    <>
      <span class="outstrip" aria-hidden="true">
        {days.map((d, i) => <span key={i} class="outday" style={{ left: `${((d.getTime() - t0) / span) * 100}%` }}>{weekday(d).slice(0, 1)}</span>)}
        {shown.map((o, i) => {
          const from = Math.max(t0, new Date(o.from).getTime()), to = o.to ? new Date(o.to).getTime() : now;
          return <span key={i} class={'out' + (o.to ? '' : ' now')} style={{ left: `${((from - t0) / span) * 100}%`, width: `max(3px, ${((to - from) / span) * 100}%)` }} />;
        })}
      </span>
      {shown.length
        ? <span class="outlist">{shown.map((o, i) => <span key={i} class="outline">{outageWords(o, now)}</span>)}</span>
        : <span class="outline">No outage: each check it missed passed the next time</span>}
      <span class="outfoot">The watchdog checks it every 15 minutes</span>
    </>
  );
}

/** The first lines of a release's notes, as plain words: no headings' #, no list marks, no links' addresses. */
export function firstLines(notes = '', n = 2): string[] {
  return notes.split('\n').map((l) => l.replace(/^\s*(#+|[-*+]|\d+\.)\s+/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim())
    .filter((l) => l && !/^(what'?s changed|changelog|release notes?)$/i.test(l)).slice(0, n);
}

/** Each app's newest release, once read, for this run of the app. */
const newest: Record<string, Promise<releases.Preview>> = {};

/** "updates held" on hover: why, how to put it back, and what its newest release says, read when the card opens. */
function HeldNotes({ a, load }: { a: api.AppStatus; load: (id: string) => Promise<releases.Preview> }) {
  const [p, setP] = useState<releases.Preview | null>(null);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let live = true;
    (newest[a.id] ||= load(a.id)).then((v) => live && setP(v), (e) => { delete newest[a.id]; if (live) setProblem(String(e?.message || e)); });
    return () => { live = false; };
  }, [a.id]);
  const r = p?.releases?.[0];
  const when = r && new Date(r.when);
  return (
    <>
      <span class="outline">Left out of the nightly updates after a rollback, so it stays on what works. Nightly updates on its page puts it back.</span>
      {problem ? <span class="outline muted">Could not read its releases: {problem}</span>
        : !p ? <span class="outline muted">Reading its newest release…</span>
        : !r ? <span class="outline muted">Its project has published no releases{p.repo ? '' : ' that its image names'}.</span>
        : <>
          <span class="outline"><strong>Newest: {r.name && r.name !== r.tag ? `${r.tag}, ${r.name}` : r.tag}</strong>{when && !isNaN(when.getTime()) ? ` · ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}{p.running ? ` (it runs ${p.running})` : ''}</span>
          {firstLines(r.notes).map((l, i) => <span key={i} class="outline muted">{l}</span>)}
        </>}
    </>
  );
}

/** Why an app last started, for "up 9 minutes" on hover (AppStatus.startedBy). */
export const startedWords: Record<string, string> = {
  you: 'You started it',
  updated: 'You updated it, so it started on its new version',
  nightly: 'The nightly update moved it to its new version',
  update: 'It was updated, and started on its new version',
  fix: 'Fix it restarted it',
  watchdog: 'The watchdog restarted it: it was unwell on two checks in a row',
  battery: 'It started again when the power came back (the battery saver had paused it)',
  drive: 'It started once its drive was plugged in again',
  timer: 'It started again at the time you set when you stopped it',
  docker: 'Docker started it again after it stopped on its own; its log says why',
};

/** How long a running app has been up, and badges for what to know about it. */
function Uptime({ a, week, outages, load }: { a: api.AppStatus; week?: number; outages?: health.Outage[]; load: (id: string) => Promise<releases.Preview> }) {
  if (a.state !== 'running' || !a.since) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(a.since).getTime()) / 60000)), hours = Math.round(mins / 60);
  const up = mins < 60 ? (mins <= 1 ? 'up a minute' : `up ${mins} minutes`) : hours < 48 ? (hours === 1 ? 'up an hour' : `up ${hours} hours`) : `up ${Math.round(hours / 24)} days`;
  return (
    <>
      {a.startedBy && startedWords[a.startedBy]
        ? <Hover cls="local" label={up} tip={<><span class="outline">{startedWords[a.startedBy]}</span><span class="outfoot">{weekday(new Date(a.since))} {clock(new Date(a.since))}</span></>} />
        : <span class="local">{up}</span>}
      {!!a.restarts && <span class="badge warn" title="Docker restarted it after it stopped on its own; its log says why">restarted {a.restarts}×</span>}
      {a.held && <Hover cls="badge" wide lazy label="updates held" tip={<HeldNotes a={a} load={load} />} />}
      {a.settingsChanged && <span class="badge warn" title="Its settings (.env or its compose file) changed since it started, so it still runs the old ones; Fix it recreates it with the new ones">settings changed</span>}
      {week !== undefined && week < 0.99 && <Hover cls="badge warn" wide label={`${Math.floor(week * 1000) / 10}% up this week`} tip={<WeekOutages outages={outages} />} />}
    </>
  );
}

/** Open (on a Mac) or start an installed app the homelab does not run itself. */
function NativeButton({ a, title, label, open }: { a: api.AppStatus; title: string; label: string; open: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <button class="small" title={title} disabled={busy} onClick={() => { setBusy(true); open().catch(() => setBusy(false)); }}>{label}</button>;
}

/** The one thing done most with an app: Open it, or Start it when it is
 * stopped. Everything else is on its page. */
function Actions({ a, entry, busy, os, on }: { a: api.AppStatus; entry?: api.App; busy: boolean; os: string; on: AppListActions }) {
  if (entry?.kind === 'native') {
    const title = os === 'mac' ? `Open ${a.name}; it then keeps running in the menu bar`
      : os === 'windows' ? `Start ${a.name} (Windows asks for approval)` : `Start ${a.name}'s service (asks for your password)`;
    return entry.macApp && a.state !== 'running' ? <NativeButton a={a} title={title} label={os === 'mac' ? 'Open' : 'Start'} open={() => on.openNative(a)} /> : null;
  }
  if (a.state === 'elsewhere') return null;
  if (a.state === 'missing') return <button class="small" onClick={() => on.install(a)}>Install</button>;
  if (a.state !== 'running') return <button class="small rowmain change" title={`Start ${a.name}`} disabled={busy} onClick={() => on.act(a, 'start')}>Start</button>;
  const url = a.address ? 'https://' + a.address : a.url;
  // ⇧-click (Shift-click): its address on this machine instead of the domain, for when the domain does not answer.
  const local = a.address && a.url ? a.url : '';
  return url ? <button class="small rowmain" title={local ? `Open ${a.name} (${shift(os)}click: on this machine, ${local.replace(/^http:\/\//, '')})` : `Open ${a.name}`} onClick={(e) => on.open(local && e.shiftKey ? local : url)}>Open</button> : null;
}

/** Where a row's menu is open, and which row: one at a time. */
interface MenuAt { id: string; x: number; y: number; from: Element | null }

function Row({ a, p, menu, setMenu, said, say }: { a: api.AppStatus; p: AppListProps; menu: MenuAt | null; setMenu: (m: MenuAt | null) => void; said?: string; say: (id: string, words: string) => void }) {
  const pend = p.pending[a.id];
  // Its menu: none on the phone or a wall screen, nor for an app not installed or run elsewhere.
  const menuable = !p.companion && a.state !== 'missing' && a.state !== 'elsewhere';
  const openMenu = (x: number, y: number) => setMenu({ id: a.id, x, y, from: document.activeElement });
  // ⌥-click on its address: copied, as the menu's Copy address does.
  const copy = (url: string) => { p.on.menu.copy(url).then(() => say(a.id, 'Address copied'), () => say(a.id, 'Could not copy the address')); };
  const close = (refocus?: boolean) => {
    const from = menu?.from as HTMLElement | null;
    setMenu(null);
    if (refocus && from?.isConnected && from !== document.body) from.focus();
  };
  // Clicked and not confirmed yet: what it is doing, at once.
  const [cls, words] = pend && !pend.failed ? ['warn', pend.note || doing[pend.action] || 'Working…'] : stateOf(a, p.batteryPaused, p.held);
  const entry = p.catalog?.apps.find((c) => c.id === a.id);
  const changed = changedSince(a, p.seen ?? null);
  return (
    // A click anywhere on the row (not on its links and buttons), or Return
    // on it, opens the app's page.
    <tr aria-busy={pend && !pend.failed ? true : undefined} class={(a.state !== 'missing' ? 'topage' : '') + (menu?.id === a.id ? ' menued' : '') || undefined}
      onClick={a.state !== 'missing' ? (e) => { if (!(e.target as Element).closest('a, button, .rowmenu, .hovers')) p.on.page(a); } : undefined}
      onContextMenu={menuable ? (e) => { if ((e.target as Element).closest('.rowmenu')) return; e.preventDefault(); openMenu(e.clientX, e.clientY); } : undefined}
      onKeyDown={menuable ? (e) => {
        // Shift+F10 and the context-menu key: under the app's name.
        if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) || (e.target as Element).closest('.rowmenu')) return;
        e.preventDefault();
        const r = (e.currentTarget as HTMLElement).querySelector('strong')!.getBoundingClientRect();
        openMenu(r.left, r.bottom + 4);
      } : undefined}>
      <td><strong>{a.name}</strong>{changed && <span class="changedot" role="img" aria-label={changed} title={changed} />}</td>
      <td class="state">
        <span class={'dot ' + cls} />{words}
        {pend && !pend.failed ? null : a.state === 'elsewhere'
          ? <><span class="local">container {a.container}</span><button class="small" onClick={() => p.on.adopt(a)}>Move in</button></>
          : <Uptime a={a} week={p.weekUp[a.id]} outages={p.outages?.[a.id]} load={p.on.releaseNotes} />}
        {pend?.failed && <span class="rowerr" role="status">Could not {verb[pend.action] || pend.action}: {pend.failed}{pend.log && <> <button type="button" class="linkbtn" onClick={() => p.on.details(a)}>Details</button></>}</span>}
        {said && <span class="rowsaid" role="status">{said}</span>}
      </td>
      {/* One address: the app's own name when it has one (its address on this machine is in the tooltip), else the local one. */}
      <td title={a.address && a.url ? 'On this machine: ' + a.url : ''}>
        {a.address ? <Link url={'https://' + a.address} text={a.address} open={p.on.open} copy={copy} os={p.os} />
          : a.url ? <Link url={a.url} text={a.url.replace(/^http:\/\//, '')} open={p.on.open} copy={copy} os={p.os} />
          : <span class="muted">—</span>}
      </td>
      <td class="rowActions"><Actions a={a} entry={entry} busy={p.busy} os={p.os} on={p.on} />{a.state !== 'missing' && <button class="iconbtn topage" title={`${a.name}: its page`} aria-label={`${a.name}: its page`} onClick={() => p.on.page(a)}><Icon name="chevron" /></button>}
        {menu?.id === a.id && <RowMenu a={a} x={menu.x} y={menu.y} native={entry?.kind === 'native'} busy={p.busy} companion={p.companion} on={p.on.menu} close={close} said={(w) => say(a.id, w)} />}</td>
    </tr>
  );
}

/** The stopped apps Start them starts: not one waiting for its drive, paused
 * on battery, or stopped on purpose (its row has its own Start). */
const startable = (p: AppListProps, a: api.AppStatus) => a.state === 'stopped' && !a.waitingFor && !p.batteryPaused.has(a.id) && !p.held[a.id];

/** Start them: every stopped container app of a group, one after another. */
function StartAll({ g, p }: { g: Group; p: AppListProps }) {
  const [at, setAt] = useState(-1);
  const stopped = g.apps.filter((a) => startable(p, a) && p.catalog?.apps.find((c) => c.id === a.id)?.kind !== 'native');
  if (!stopped.length || p.companion) return null;
  const go = (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // not the heading's fold
    setAt(0);
    p.on.startAll(stopped, setAt).finally(() => setAt(-1));
  };
  return (
    <button class="small startall" title={'Start ' + stopped.map((a) => a.name).join(', ')} disabled={at >= 0} onClick={go}>
      {at >= 0 ? `Starting ${at + 1} of ${stopped.length}…` : stopped.length === 1 ? 'Start it' : `Start the ${stopped.length} stopped`}
    </button>
  );
}

const isNative = (p: AppListProps, a: api.AppStatus) => p.catalog?.apps.find((c) => c.id === a.id)?.kind === 'native';

/**
 * A group's count, which opens its menu: what the group holds in memory
 * now, each running app's share biggest first, and Start, Restart, or Stop
 * for the whole group. Stopping asks for a second click, as it takes the
 * apps away from everyone. The menu works as More… does: the arrow keys
 * move through it, Escape closes it back on the count, and a click
 * elsewhere closes it. On the phone the count is plain text.
 */
function GroupMenu({ g, p, count }: { g: Group; p: AppListProps; count: string }) {
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState(false);
  // Stop for a while: the menu shows the times to choose from instead.
  const [later, setLater] = useState(false);
  const [doing, setDoing] = useState<{ action: string; at: number; of: number } | null>(null);
  const [up, setUp] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const mem = p.memory;
  const used = mem ? g.apps.reduce((t, a) => t + (mem[a.id] || 0), 0) : 0;
  const containers = g.apps.filter((a) => !isNative(p, a));
  const running = containers.filter((a) => a.state === 'running');
  const stopped = containers.filter((a) => startable(p, a));
  const held = containers.filter((a) => a.state === 'stopped' && p.held[a.id]);
  const items = () => [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') || [])];
  const close = (refocus?: boolean) => { setOpen(false); setSure(false); setLater(false); if (refocus) btn.current?.focus(); };
  // The times in place of the menu, or the menu back: the focus moves with it.
  const showLater = (on: boolean) => {
    setLater(on);
    setSure(false);
    requestAnimationFrame(() => (on ? items()[0] : wrap.current?.querySelector<HTMLButtonElement>('.stoplater'))?.focus());
  };
  // A press anywhere else closes it, another group's count included: read
  // as the press begins (capture), since each count keeps its own click
  // from the heading's fold, and so from a listener on the document.
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', outside, true);
    return () => document.removeEventListener('mousedown', outside, true);
  }, [open]);
  // Opened near the bottom of what scrolls, it opens upward when there is
  // room above (both measured on the page, so the text size cannot skew it).
  useLayoutEffect(() => {
    if (!open) { setUp(false); return; }
    const menu = list.current, box = wrap.current?.closest('main'), at = btn.current;
    if (!menu || !box || !at) return;
    const m = menu.getBoundingClientRect(), b = box.getBoundingClientRect(), a = at.getBoundingClientRect();
    setUp(m.bottom > b.bottom && a.top - b.top > m.height);
  }, [open]);
  if (p.companion || g.alert) return <span class="n">{count}</span>;
  // Stop asks for a second click; Stop for a while has had it (the time).
  const run = (action: 'start' | 'stop' | 'restart', apps: api.AppStatus[], until?: string) => {
    if (action === 'stop' && !sure && !until) { setSure(true); return; }
    close(true);
    setDoing({ action, at: 0, of: apps.length });
    p.on.groupAct(apps, action, (i) => setDoing({ action, at: i, of: apps.length }), until).finally(() => setDoing(null));
  };
  const verb = { start: 'Starting', stop: 'Stopping', restart: 'Restarting' } as Record<string, string>;
  const label = doing ? `${verb[doing.action]} ${doing.at + 1} of ${doing.of}…` : count + (used ? ` · ${formatMem(used)}` : '');
  const byMem = running.filter((a) => mem?.[a.id]).sort((a, b) => (mem![b.id] || 0) - (mem![a.id] || 0));
  return (
    <span class="groupmenu" ref={wrap} onClick={(e) => e.stopPropagation() /* not the heading's fold */}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
        const all = items(), at = all.indexOf(document.activeElement as HTMLButtonElement);
        const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[e.key];
        if (to === undefined || !all.length) return;
        e.preventDefault();
        all[(to + all.length) % all.length].focus();
      }}
      onFocusOut={() => setTimeout(() => { if (open && document.hasFocus() && !wrap.current?.contains(document.activeElement)) close(); })}>
      <button type="button" ref={btn} class="n groupcount" aria-haspopup="menu" aria-expanded={open} disabled={!!doing}
        title={`${g.label}: start, stop, or restart them all, and what they hold in memory`}
        onClick={(e) => {
          if (open) { close(); return; }
          setOpen(true);
          // From the keyboard (no pointer), the first item takes the focus.
          if (e.detail === 0) requestAnimationFrame(() => items()[0]?.focus());
        }}
        onKeyDown={(e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); requestAnimationFrame(() => { const all = items(); all[e.key === 'ArrowDown' ? 0 : all.length - 1]?.focus(); }); } }}>
        {label}<span class="drop" aria-hidden="true">▾</span>
      </button>
      {open && later && (
        <div ref={list} class={'menu groupmenulist' + (up ? ' up' : '')} role="menu" aria-label={`${g.label}: stop for a while`}>
          <p class="menuhead">{running.length === 1 ? `Stop ${running[0].name} for a while` : `Stop the ${running.length} running for a while`}</p>
          {stopChoices().map((c) => <button key={c.until} type="button" role="menuitem" disabled={p.busy} onClick={() => run('stop', running, c.until)}>{c.label}</button>)}
          <button type="button" role="menuitem" class="menuback" onClick={() => showLater(false)}>‹ Back</button>
          <p class="menufoot muted">{running.length === 1 ? 'It starts again by itself then.' : 'They start again by themselves then.'}</p>
        </div>
      )}
      {open && !later && (
        <div ref={list} class={'menu groupmenulist' + (up ? ' up' : '')} role="menu" aria-label={`${g.label}: all its apps`}>
          <p class="menuhead">{mem ? (used ? `${formatMem(used)} in memory now` : 'Nothing in memory now') : 'Memory: measuring…'}</p>
          {byMem.length > 0 && (
            <ul class="memlist" aria-label="Memory by app">
              {byMem.slice(0, 8).map((a) => <li key={a.id}><span>{a.name}</span><span class="muted">{formatMem(mem![a.id])}</span></li>)}
            </ul>
          )}
          {stopped.length > 0 && <button type="button" role="menuitem" disabled={p.busy} onClick={() => run('start', stopped)}>{stopped.length === 1 ? `Start ${stopped[0].name}` : `Start the ${stopped.length} stopped`}</button>}
          {running.length > 0 && <button type="button" role="menuitem" disabled={p.busy} onClick={() => run('restart', running)}>{running.length === 1 ? `Restart ${running[0].name}` : `Restart the ${running.length} running`}</button>}
          {running.length > 0 && (
            <button type="button" role="menuitem" class={sure ? 'danger' : ''} disabled={p.busy} onClick={() => run('stop', running)}>
              {sure ? `Click again to stop ${running.length === 1 ? running[0].name : `all ${running.length}`}` : running.length === 1 ? `Stop ${running[0].name}` : `Stop the ${running.length} running`}
            </button>
          )}
          {running.length > 0 && <button type="button" role="menuitem" class="stoplater" aria-haspopup="menu" disabled={p.busy} onClick={() => showLater(true)}>Stop for a while ›</button>}
          {running.length > 0 && <p class="menufoot muted">Stopping what you don’t use gives its memory back. Nothing starts it again by itself until you do.</p>}
          {held.length > 0 && <p class="menufoot muted heldnote">Stopped by you: {held.map((a) => a.name).join(', ')}. {held.length === 1 ? 'Start it' : 'Start each'} from its row.</p>}
        </div>
      )}
    </span>
  );
}

function GroupHead({ g, open, toggle, p }: { g: Group; open: boolean; toggle: () => void; p: AppListProps }) {
  const running = g.apps.filter((a) => a.state === 'running').length;
  const counted = g.apps.filter((a) => !awaitingJobs(a)).length;
  // The whole row folds on a click; its heading is the button a keyboard
  // and a screen reader use, since a table row cannot say it is expanded.
  return (
    // A right-click on the heading, Shift+F10, or the context-menu key opens the group's menu, as a click on its count does.
    <tr class={'grouphead fold' + (g.alert ? ' bad' : '') + (open ? ' open' : '')} onClick={toggle}
      onContextMenu={(e) => { const c = (e.currentTarget as Element).querySelector<HTMLButtonElement>('button.groupcount'); if (!c || (e.target as Element).closest('.groupmenulist')) return; e.preventDefault(); if (c.getAttribute('aria-expanded') !== 'true') c.click(); }}
      onKeyDown={(e) => {
        if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) || (e.target as Element).closest('.groupmenulist')) return;
        const c = (e.currentTarget as Element).querySelector<HTMLButtonElement>('button.groupcount');
        if (!c) return;
        e.preventDefault();
        if (c.getAttribute('aria-expanded') !== 'true') c.click();
      }}>
      <th colSpan={4}>
        <button type="button" class="foldbtn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggle(); }}>
          <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>{g.label}
        </button>
        {/* A wall screen hides every button, this one too: its name as plain text there. */}
        <span class="kiosklabel">{g.label}</span>
        <GroupMenu g={g} p={p} count={g.alert ? String(g.apps.length) : running >= counted ? `${running} running ✓` : `${running} of ${counted} running`} />
        <StartAll g={g} p={p} />
        {!open && <span class="names">{g.apps.map((a) => a.name).join(' · ')}</span>}
      </th>
    </tr>
  );
}

// Which categories are open, kept between visits and restarts: each one
// the user opened or closed; the rest open when something in them is not
// running. all: Show every app was picked. Shared by the list and its
// Show every app button.
interface Fold { all: boolean; picked: Record<string, boolean> }
const foldKey = 'homelab.statusOpen';
let fold: Fold = { all: false, picked: {} };
try {
  const v = localStorage.getItem(foldKey);
  if (v === 'all') fold = { all: true, picked: {} };
  else if (v) {
    const kept = JSON.parse(v);
    fold = { all: false, picked: Array.isArray(kept) ? Object.fromEntries(kept.map((l: string) => [l, true])) : kept };
  }
} catch { /* private window: the defaults */ }
const folded: ((f: Fold) => void)[] = [];
function setFold(f: Fold) {
  fold = f;
  try { localStorage.setItem(foldKey, f.all ? 'all' : JSON.stringify(f.picked)); } catch { /* not kept */ }
  folded.forEach((fn) => fn(f));
}
function useFold(): Fold {
  const [f, set] = useState(fold);
  useEffect(() => {
    folded.push(set);
    set(fold);
    return () => { folded.splice(folded.indexOf(set), 1); };
  }, []);
  return f;
}

// Type to filter: a letter typed anywhere on Status (not in a field, a
// menu, or a sheet) opens a filter box beside Show every app with it, and
// the list keeps only the apps whose name (or ID) has what is typed, each
// group open. Return opens the first one's page; Escape clears it and the
// whole list comes back. Shared by the list and the box.
interface Filter { text: string; on: boolean }
let filter: Filter = { text: '', on: false };
const filters: ((f: Filter) => void)[] = [];
/** Where the focus was when typing started: it goes back there on Escape. */
let before: HTMLElement | null = null;
/** The box takes the focus once it is drawn (typing began outside it). */
let focusBox = false;
export function setFilter(f: Filter) {
  filter = f;
  filters.forEach((fn) => fn(f));
}
function useFilter(): Filter {
  const [f, set] = useState(filter);
  useEffect(() => {
    filters.push(set);
    set(filter);
    return () => { filters.splice(filters.indexOf(set), 1); };
  }, []);
  return f;
}

/** Without case or accents: "é" matches "E". */
const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Whether an app is one the filter keeps: what is typed in its name or ID. */
export function matches(a: api.AppStatus, text: string): boolean {
  const q = plain(text.trim());
  return !q || plain(a.name).includes(q) || plain(a.id).includes(q);
}

// What the box says and does from the list: how many apps it keeps, and
// opening the first one's page.
let found = { n: 0, of: 0, first: null as (() => void) | null };
const founds: ((f: typeof found) => void)[] = [];
function setFound(f: typeof found) {
  if (f.n === found.n && f.of === found.of && f.first === found.first) return;
  found = f;
  founds.forEach((fn) => fn(f));
}

/** Clears the filter, and the focus goes back where it was before typing (or the box's place in the page). */
function clearFilter() {
  setFilter({ text: '', on: false });
  const back = before;
  before = null;
  requestAnimationFrame(() => { if (back?.isConnected && back.checkVisibility()) back.focus(); else document.getElementById('statusAll')?.focus(); });
}

// A letter typed on Status starts the filter (or adds to it); Escape on
// Status clears it while no menu is open.
document.addEventListener('keydown', (e) => {
  const status = document.getElementById('status');
  if (!status?.classList.contains('active') || e.defaultPrevented) return;
  const html = document.documentElement.classList;
  if (html.contains('sheet-open') || html.contains('kiosk') || !document.querySelector('#statusRows tr')) return;
  const t = e.target as Element;
  if (status.querySelector('.menu:not([hidden])')) return;
  if (e.key === 'Escape' && filter.on && !t.closest?.('.filterbox')) { clearFilter(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || e.key === ' ') return;
  if (t.closest?.('input, textarea, select, [contenteditable], [role=menu], dialog, .sheet')) return;
  e.preventDefault();
  if (!filter.on) before = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  focusBox = true;
  setFilter({ text: filter.text + e.key, on: true });
});

/** The filter box: shown once typing starts, with what is typed and how many apps it keeps (the field's own clear button empties it). */
export function FilterBox() {
  const f = useFilter();
  const [n, setN] = useState(found);
  useEffect(() => {
    founds.push(setN);
    setN(found);
    return () => { founds.splice(founds.indexOf(setN), 1); };
  }, []);
  const box = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (!focusBox || !box.current) return;
    focusBox = false;
    const el = box.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  });
  if (!f.on) return null;
  const said = !f.text.trim() ? '' : n.n ? `${n.n} of ${n.of} ${n.of === 1 ? 'app' : 'apps'}` : 'No app has that name';
  return (
    <span class="filterbox">
      <input ref={box} type="search" aria-label="Filter apps by name" placeholder="Filter apps" value={f.text} autocomplete="off" spellcheck={false}
        onInput={(e) => setFilter({ text: (e.target as HTMLInputElement).value, on: true })}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); clearFilter(); }
          if (e.key === 'Enter' && n.first) { e.preventDefault(); n.first(); }
        }}
        onBlur={(e) => { if (!(e.target as HTMLInputElement).value.trim()) setFilter({ text: '', on: false }); }} />
      <span class="muted filtercount" role="status">{said}</span>
    </span>
  );
}

/** Whether each group is unfolded: until the user picks, one where everything runs is folded, and what needs a look stays open. */
function openGroups(groups: Group[], f: Fold, held: Record<string, stopped.Stop>): Record<string, boolean> {
  const fine = (g: Group) => !g.alert && !g.pinned && g.apps.every((a) => a.state === 'running' || awaitingJobs(a) || (a.state === 'stopped' && held[a.id]));
  return Object.fromEntries(groups.map((g) => [g.label, f.all || (g.label in f.picked ? f.picked[g.label] : !fine(g))]));
}

export function AppList(p: AppListProps) {
  const f = useFold();
  const [menu, setMenu] = useState<MenuAt | null>(null);
  // A few words under a row after its menu did something (Address copied), for a few seconds.
  const [said, setSaid] = useState<{ id: string; words: string } | null>(null);
  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(null), 3000); return () => clearTimeout(t); }, [said]);
  const say = (id: string, words: string) => setSaid({ id, words });
  const q = useFilter().text;
  const open = openGroups(p.groups, f, p.held);
  // Folding one after Show every app keeps the others as they are shown.
  const toggle = (label: string) => setFold({ all: false, picked: { ...(f.all ? open : f.picked), [label]: !open[label] } });
  // Filtered: each group with an app kept, open, with only those; its heading's count and menu still the whole group's.
  // An app in Needs a look is in no other group, so none shows twice.
  const kept = q.trim() ? p.groups.map((g) => ({ g, apps: g.apps.filter((a) => matches(a, q)) })).filter((x) => x.apps.length) : null;
  const all = p.groups.reduce((t, g) => t + g.apps.length, 0);
  const first = kept?.[0]?.apps.find((a) => a.state !== 'missing');
  const openFirst = useRef<() => void>(() => {});
  openFirst.current = () => { if (first) p.on.page(first); };
  const opener = useRef(() => openFirst.current());
  useEffect(() => setFound({ n: kept ? kept.reduce((t, x) => t + x.apps.length, 0) : all, of: all, first: first ? opener.current : null }));
  if (kept && !kept.length) {
    return <tr class="nomatch"><td colSpan={4}>No app’s name has “{q.trim()}”. <button type="button" class="linkbtn" onClick={clearFilter}>Show every app</button></td></tr>;
  }
  const row = (a: api.AppStatus) => <Row key={a.id} a={a} p={p} menu={menu} setMenu={setMenu} said={said?.id === a.id ? said.words : undefined} say={say} />;
  return (
    <>
      {kept ? kept.flatMap(({ g, apps }) => [<GroupHead key={'g:' + g.label} g={g} open toggle={() => {}} p={p} />, ...apps.map(row)])
        : p.groups.flatMap((g) => [<GroupHead key={'g:' + g.label} g={g} open={open[g.label]} toggle={() => toggle(g.label)} p={p} />,
          ...(open[g.label] ? g.apps.map(row) : [])])}
    </>
  );
}

/** Show every app, or fold them again; while the list is filtered, the filter box in its place. */
export function ShowAll() {
  const f = useFold();
  const on = useFilter().on;
  return <>{on ? <FilterBox /> : <button id="statusAll" class="linkbtn" onClick={() => setFold({ all: !f.all, picked: {} })}>{f.all ? 'Fold them again' : 'Show every app'}</button>}</>;
}

/** Renders the list into the table body el. */
export function mountAppList(el: Element, props: AppListProps) { render(<AppList {...props} />, el); }

/** Renders Show every app into el. */
export function mountShowAll(el: Element) { render(<ShowAll />, el); }

/** Empties el, so the next mount starts afresh. */
export function clearAppList(el: Element) { render(null, el); }
