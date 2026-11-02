// Status's app list: every app grouped by category (what needs a look
// first, in a group of its own), each folding into its heading, with the
// app's state, address, and buttons. Preact updates only what changed, so
// a live change leaves the focus and an open tooltip where they were.
// Which categories are open is the list's own: a click folds or opens one
// without app.ts or the backend.
import { render, type JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { Icon } from '../Icon';
import { Address } from '../parts/Address';
import { awaitingJobs } from './Tiles';
import { formatMem } from './memory';

export interface Group {
  label: string;
  apps: api.AppStatus[];
  /** What needs a look: its count in red, never folded by default. */
  alert?: boolean;
}

/** What the rows do; app.ts runs each. */
export interface AppListActions {
  /** start, stop, restart, update, or rollback (Start from a row; the rest from the page). */
  act: (a: api.AppStatus, action: string) => void;
  openNative: (a: api.AppStatus) => Promise<void>;
  install: (a: api.AppStatus) => void;
  adopt: (a: api.AppStatus) => void;
  open: (url: string) => void;
  /** Opens the app's page. */
  page: (a: api.AppStatus) => void;
  /** Starts each app in turn; reports which is at hand. */
  startAll: (apps: api.AppStatus[], progress: (i: number) => void) => Promise<void>;
  /** Starts, stops, or restarts each app of a group in turn (its heading's menu); reports which is at hand. */
  groupAct: (apps: api.AppStatus[], action: 'start' | 'stop' | 'restart', progress: (i: number) => void) => Promise<void>;
}

/** A row's action the runtime has not confirmed yet, or why it failed. */
export interface Pending {
  /** start, stop, restart, update, or rollback. */
  action: string;
  /** Why it failed: the row is back as it was, with this under it. */
  failed?: string;
}

export interface AppListProps {
  groups: Group[];
  /** Each app's action since its click, by app ID. */
  pending: Record<string, Pending>;
  catalog: api.Catalog | null;
  /** Each app's share of the watchdog's passing checks this week, 0 to 1. */
  weekUp: Record<string, number>;
  batteryPaused: Set<string>;
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
export function stateOf(a: api.AppStatus, batteryPaused: Set<string>): [string, string] {
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
function Link({ url, text, open }: { url: string; text: string; open: (url: string) => void }) {
  return <ActionLink onClick={() => open(url)}><Address text={text} /></ActionLink>;
}

/** How long a running app has been up, and badges for what to know about it. */
function Uptime({ a, week }: { a: api.AppStatus; week?: number }) {
  if (a.state !== 'running' || !a.since) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(a.since).getTime()) / 60000)), hours = Math.round(mins / 60);
  const up = mins < 60 ? (mins <= 1 ? 'up a minute' : `up ${mins} minutes`) : hours < 48 ? (hours === 1 ? 'up an hour' : `up ${hours} hours`) : `up ${Math.round(hours / 24)} days`;
  return (
    <>
      <span class="local">{up}</span>
      {!!a.restarts && <span class="badge warn" title="Docker restarted it after it stopped on its own; its log says why">restarted {a.restarts}×</span>}
      {a.held && <span class="badge" title={`Left out of nightly updates after a rollback; homelab updates release ${a.id} puts it back`}>updates held</span>}
      {a.settingsChanged && <span class="badge warn" title="Its settings (.env or its compose file) changed since it started, so it still runs the old ones; Fix it recreates it with the new ones">settings changed</span>}
      {week !== undefined && week < 0.99 && <span class="badge warn" title="The share of the watchdog’s checks (every 15 minutes) it passed in the last 7 days">{Math.floor(week * 1000) / 10}% up this week</span>}
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
  return url ? <button class="small rowmain" title={`Open ${a.name}`} onClick={() => on.open(url)}>Open</button> : null;
}

function Row({ a, p }: { a: api.AppStatus; p: AppListProps }) {
  const pend = p.pending[a.id];
  // Clicked and not confirmed yet: what it is doing, at once.
  const [cls, words] = pend && !pend.failed ? ['warn', doing[pend.action] || 'Working…'] : stateOf(a, p.batteryPaused);
  const entry = p.catalog?.apps.find((c) => c.id === a.id);
  return (
    // A click anywhere on the row (not on its links and buttons), or Return
    // on it, opens the app's page.
    <tr aria-busy={pend && !pend.failed ? true : undefined} class={a.state !== 'missing' ? 'topage' : undefined}
      onClick={a.state !== 'missing' ? (e) => { if (!(e.target as Element).closest('a, button')) p.on.page(a); } : undefined}>
      <td><strong>{a.name}</strong></td>
      <td class="state">
        <span class={'dot ' + cls} />{words}
        {pend && !pend.failed ? null : a.state === 'elsewhere'
          ? <><span class="local">container {a.container}</span><button class="small" onClick={() => p.on.adopt(a)}>Move in</button></>
          : <Uptime a={a} week={p.weekUp[a.id]} />}
        {pend?.failed && <span class="rowerr" role="status">Could not {verb[pend.action] || pend.action}: {pend.failed}</span>}
      </td>
      {/* One address: the app's own name when it has one (its address on this machine is in the tooltip), else the local one. */}
      <td title={a.address && a.url ? 'On this machine: ' + a.url : ''}>
        {a.address ? <Link url={'https://' + a.address} text={a.address} open={p.on.open} />
          : a.url ? <Link url={a.url} text={a.url.replace(/^http:\/\//, '')} open={p.on.open} />
          : <span class="muted">—</span>}
      </td>
      <td class="rowActions"><Actions a={a} entry={entry} busy={p.busy} os={p.os} on={p.on} />{a.state !== 'missing' && <button class="iconbtn topage" title={`${a.name}: its page`} aria-label={`${a.name}: its page`} onClick={() => p.on.page(a)}><Icon name="chevron" /></button>}</td>
    </tr>
  );
}

/** Start them: every stopped container app of a group, one after another. */
function StartAll({ g, p }: { g: Group; p: AppListProps }) {
  const [at, setAt] = useState(-1);
  const stopped = g.apps.filter((a) => a.state === 'stopped' && !a.waitingFor && !p.batteryPaused.has(a.id) && p.catalog?.apps.find((c) => c.id === a.id)?.kind !== 'native');
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
  const [doing, setDoing] = useState<{ action: string; at: number; of: number } | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const mem = p.memory;
  const used = mem ? g.apps.reduce((t, a) => t + (mem[a.id] || 0), 0) : 0;
  const containers = g.apps.filter((a) => !isNative(p, a));
  const running = containers.filter((a) => a.state === 'running');
  const stopped = containers.filter((a) => a.state === 'stopped' && !a.waitingFor && !p.batteryPaused.has(a.id));
  const items = () => [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not([disabled])') || [])];
  const close = (refocus?: boolean) => { setOpen(false); setSure(false); if (refocus) btn.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    document.addEventListener('click', outside);
    return () => document.removeEventListener('click', outside);
  }, [open]);
  if (p.companion || g.alert) return <span class="n">{count}</span>;
  const run = (action: 'start' | 'stop' | 'restart', apps: api.AppStatus[]) => {
    if (action === 'stop' && !sure) { setSure(true); return; }
    close(true);
    setDoing({ action, at: 0, of: apps.length });
    p.on.groupAct(apps, action, (i) => setDoing({ action, at: i, of: apps.length })).finally(() => setDoing(null));
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
      {open && (
        <div class="menu groupmenulist" role="menu" aria-label={`${g.label}: all its apps`}>
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
          {running.length > 0 && <p class="menufoot muted">Stopping what you don’t use gives its memory back. Start it again any time.</p>}
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
    <tr class={'grouphead fold' + (g.alert ? ' bad' : '') + (open ? ' open' : '')} onClick={toggle}>
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

/** Whether each group is unfolded: until the user picks, one where everything runs is folded, and what needs a look stays open. */
function openGroups(groups: Group[], f: Fold): Record<string, boolean> {
  const fine = (g: Group) => !g.alert && g.apps.every((a) => a.state === 'running' || awaitingJobs(a));
  return Object.fromEntries(groups.map((g) => [g.label, f.all || (g.label in f.picked ? f.picked[g.label] : !fine(g))]));
}

export function AppList(p: AppListProps) {
  const f = useFold();
  const open = openGroups(p.groups, f);
  // Folding one after Show every app keeps the others as they are shown.
  const toggle = (label: string) => setFold({ all: false, picked: { ...(f.all ? open : f.picked), [label]: !open[label] } });
  return (
    <>
      {p.groups.flatMap((g) => [<GroupHead key={'g:' + g.label} g={g} open={open[g.label]} toggle={() => toggle(g.label)} p={p} />,
        ...(open[g.label] ? g.apps.map((a) => <Row key={a.id} a={a} p={p} />) : [])])}
    </>
  );
}

/** Show every app, or fold them again. */
export function ShowAll() {
  const f = useFold();
  return <button id="statusAll" class="linkbtn" onClick={() => setFold({ all: !f.all, picked: {} })}>{f.all ? 'Fold them again' : 'Show every app'}</button>;
}

/** Renders the list into the table body el. */
export function mountAppList(el: Element, props: AppListProps) { render(<AppList {...props} />, el); }

/** Renders Show every app into el. */
export function mountShowAll(el: Element) { render(<ShowAll />, el); }

/** Empties el, so the next mount starts afresh. */
export function clearAppList(el: Element) { render(null, el); }
