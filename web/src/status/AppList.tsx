// Status's app list: every app grouped by category (what needs a look
// first, in a group of its own), each folding into its heading, with the
// app's state, address, and buttons. Preact updates only what changed, so
// a live change leaves the focus and an open tooltip where they were.
import { render, type JSX } from 'preact';
import { useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { ago } from '../format';
import { Icon } from '../Icon';

export interface Group {
  label: string;
  apps: api.AppStatus[];
  /** What needs a look: its count in red, never folded by default. */
  alert?: boolean;
}

/** What the rows do; app.ts runs each. */
export interface AppListActions {
  /** start, stop, restart, update, or rollback. */
  act: (a: api.AppStatus, action: string) => void;
  logs: (a: api.AppStatus) => void;
  phone: (a: api.AppStatus) => void;
  signIn: (a: api.AppStatus, keys: string[]) => void;
  openNative: (a: api.AppStatus) => Promise<void>;
  install: (a: api.AppStatus) => void;
  adopt: (a: api.AppStatus) => void;
  open: (url: string) => void;
  /** Starts each app in turn; reports which is at hand. */
  startAll: (apps: api.AppStatus[], progress: (i: number) => void) => Promise<void>;
  toggle: (label: string) => void;
}

export interface AppListProps {
  groups: Group[];
  /** Each group's label: whether it is unfolded. */
  open: Record<string, boolean>;
  catalog: api.Catalog | null;
  /** Each app's share of the watchdog's passing checks this week, 0 to 1. */
  weekUp: Record<string, number>;
  batteryPaused: Set<string>;
  /** An app's command runs: every row's buttons wait. */
  busy: boolean;
  /** The phone companion: no Start all. */
  companion: boolean;
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

/** A link that opens in the browser. */
function Link({ url, text, open }: { url: string; text: string; open: (url: string) => void }) {
  return <ActionLink onClick={() => open(url)}>{text}</ActionLink>;
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

function IconButton({ name, title, danger, disabled, onClick }: { name: string; title: string; danger?: boolean; disabled: boolean; onClick: () => void }) {
  return <button class={'iconbtn' + (danger ? ' danger' : '')} title={title} aria-label={title} disabled={disabled} onClick={onClick}><Icon name={name} /></button>;
}

/** Open (on a Mac) or start an installed app the homelab does not run itself. */
function NativeButton({ a, title, label, open }: { a: api.AppStatus; title: string; label: string; open: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return <button class="small" title={title} disabled={busy} onClick={() => { setBusy(true); open().catch(() => setBusy(false)); }}>{label}</button>;
}

/** Each app's own buttons: start or stop, restart, update, and its log. */
function Actions({ a, entry, busy, os, on }: { a: api.AppStatus; entry?: api.App; busy: boolean; os: string; on: AppListActions }) {
  if (entry?.kind === 'native') {
    const title = os === 'mac' ? `Open ${a.name}; it then keeps running in the menu bar`
      : os === 'windows' ? `Start ${a.name} (Windows asks for approval)` : `Start ${a.name}'s service (asks for your password)`;
    return entry.macApp && a.state !== 'running' ? <NativeButton a={a} title={title} label={os === 'mac' ? 'Open' : 'Start'} open={() => on.openNative(a)} /> : null;
  }
  if (a.state === 'elsewhere') return null;
  if (a.state === 'missing') return <button class="small" onClick={() => on.install(a)}>Install</button>;
  const btn = (action: string, title: string, danger = false) => <IconButton name={action} title={title} danger={danger} disabled={busy} onClick={() => on.act(a, action)} />;
  const back = a.updatedAt ? btn('rollback', `Roll back: the version it ran before its update ${ago(a.updatedAt)}, and hold its updates`) : null;
  const logs = <IconButton name="logs" title="Logs" disabled={busy} onClick={() => on.logs(a)} />;
  if (a.state !== 'running') return <>{btn('start', 'Start')}{back}{logs}</>;
  return (
    <>
      {a.address && <IconButton name="phone" title="Open on a phone" disabled={busy} onClick={() => on.phone(a)} />}
      {!!entry?.login?.length && <IconButton name="key" title="Sign-in details" disabled={busy} onClick={() => on.signIn(a, entry.login!)} />}
      {btn('restart', 'Restart')}
      {btn('update', 'Update: dump its database, pull the newest image, and recreate it')}
      {back}
      {btn('stop', 'Stop (data is kept)', true)}
      {logs}
    </>
  );
}

function Row({ a, p }: { a: api.AppStatus; p: AppListProps }) {
  const [cls, words] = stateOf(a, p.batteryPaused);
  const entry = p.catalog?.apps.find((c) => c.id === a.id);
  return (
    <tr>
      <td><strong>{a.name}</strong></td>
      <td class="state">
        <span class={'dot ' + cls} />{words}
        {a.state === 'elsewhere'
          ? <><span class="local">container {a.container}</span><button class="small" onClick={() => p.on.adopt(a)}>Move in</button></>
          : <Uptime a={a} week={p.weekUp[a.id]} />}
      </td>
      {/* One address: the app's own name when it has one (its address on this machine is in the tooltip), else the local one. */}
      <td title={a.address && a.url ? 'On this machine: ' + a.url : ''}>
        {a.address ? <Link url={'https://' + a.address} text={a.address} open={p.on.open} />
          : a.url ? <Link url={a.url} text={a.url.replace(/^http:\/\//, '')} open={p.on.open} />
          : <span class="muted">—</span>}
      </td>
      <td class="rowActions"><Actions a={a} entry={entry} busy={p.busy} os={p.os} on={p.on} /></td>
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

function GroupHead({ g, open, p }: { g: Group; open: boolean; p: AppListProps }) {
  const running = g.apps.filter((a) => a.state === 'running').length;
  const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.on.toggle(g.label); } };
  return (
    <tr class={'grouphead fold' + (g.alert ? ' bad' : '')} aria-expanded={open} tabIndex={0} onClick={() => p.on.toggle(g.label)} onKeyDown={key}>
      <th colSpan={4}>
        <span class="chev">{open ? '▾' : '▸'}</span>{g.label}
        <span class="n">{g.alert ? String(g.apps.length) : running === g.apps.length ? `${running} running ✓` : `${running} of ${g.apps.length} running`}</span>
        <StartAll g={g} p={p} />
        {!open && <span class="names">{g.apps.map((a) => a.name).join(' · ')}</span>}
      </th>
    </tr>
  );
}

export function AppList(p: AppListProps) {
  return (
    <>
      {p.groups.flatMap((g) => {
        const open = !!p.open[g.label];
        return [<GroupHead key={'g:' + g.label} g={g} open={open} p={p} />, ...(open ? g.apps.map((a) => <Row key={a.id} a={a} p={p} />) : [])];
      })}
    </>
  );
}

/** Renders the list into the table body el. */
export function mountAppList(el: Element, props: AppListProps) { render(<AppList {...props} />, el); }

/** Empties el, so the next mount starts afresh. */
export function clearAppList(el: Element) { render(null, el); }
