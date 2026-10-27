// Setup's machine cards: this computer, its container runtime, what runs
// in the background, the homelab folder, its disks, and the version (with
// the update check beside it); the runtime walked through while it is
// missing; and making the homelab folder when there is none.
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { systemOfHost, trayNote } from '../differs';

/** What the update check says beside the version; error when it could not check. */
export interface UpgradeLine {
  error?: string;
  behind: number;
  appCommit?: string;
  previous?: upgrade.Point | null;
}

export interface HostActions {
  background: () => Promise<app.BackgroundJob[]>;
  /** Where the system lists the background jobs, in its own words. */
  whereBackground: () => string;
  jobsOff: () => void;
  setTrayAtLogin: (on: boolean) => Promise<void>;
  setMenuEntry: (on: boolean) => Promise<void>;
  chooseRoot: () => void;
  /** homelab upgrade --back. */
  goBack: () => Promise<void>;
}

export interface HostProps {
  i: app.HostInfo;
  /** Whether the menu bar item starts at login; null where there is none. */
  atLogin: boolean | null;
  menu: app.MenuEntry | null;
  upgrade: UpgradeLine | null;
  on: HostActions;
}

function Row({ k, children }: { k: string; children: ComponentChildren }) {
  return <div><dt>{k}</dt><dd>{children}</dd></div>;
}

/** What the homelab runs in the background, in plain words, behind What are these?. */
function Background({ on }: { on: HostActions }) {
  const [jobs, setJobs] = useState<app.BackgroundJob[] | null>(null);
  const toggle = async () => {
    if (jobs) { setJobs(null); return; }
    try { setJobs(await on.background()); } catch { /* shown by app.ts */ }
  };
  return (
    <>
      <span>the scheduled jobs </span>
      <ActionLink id="bgToggle" cls="small" onClick={toggle}>{jobs ? 'Hide' : 'What are these?'}</ActionLink>
      <div id="bgList" class="bglist" hidden={!jobs}>
        {jobs && <>
          <ul class="alertlist">
            {jobs.map((j) => (
              <li key={j.label}>
                <span class={'dot ' + (j.installed ? 'ok' : '')} />
                <div class="grow"><strong>{j.name}</strong><div class="muted">{j.what}</div></div>
                <span class="when muted" title={j.label}>{j.installed ? j.when : 'not installed'}</span>
              </li>
            ))}
          </ul>
          <p class="muted small">{on.whereBackground()} They only work on the homelab, and only use power while they run. Uninstalling (homelab uninstall) removes every one.</p>
          {jobs.some((j) => j.installed && j.label !== 'tray') && (
            <button id="bgOff" class="small" title="The apps keep running, but nothing starts them after a restart, backs them up at night, or watches them. Setup offers to put the jobs back." onClick={on.jobsOff}>Turn the scheduled jobs off</button>
          )}
        </>}
      </div>
    </>
  );
}

/** A setting with a button that flips it: what it is now, and the change. */
function Flip({ id, on, yes, no, turnOn, turnOff, set }: { id: string; on: boolean; yes: string; no: string; turnOn: string; turnOff: string; set: (on: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      {on ? <span class="ok">{yes}</span> : <span class="muted">{no}</span>}{' '}
      <button class="small" id={id} disabled={busy} onClick={async () => { setBusy(true); await set(!on); setBusy(false); }}>{on ? turnOff : turnOn}</button>
    </>
  );
}

/** One disk as a storage bar, as in System Settings: its name and what is free, the used part filled (red when low), and what lives on it. */
function DiskBar({ d }: { d: app.Disk }) {
  const used = d.total ? Math.min(100, Math.max(1, Math.round(100 * (1 - d.free / d.total)))) : 0;
  return (
    <div class={'disk' + (d.low ? ' low' : '')} title={d.hint || ''}>
      <div class="dhead"><strong>{d.name || 'Internal disk'}</strong><span class={d.low ? 'bad' : 'muted'}>{d.space.replace(/\s*\(\d+%\)$/, '')}</span></div>
      {!!d.total && <div class="storagebar" role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={100} aria-label={`${used}% used`}><span style={`width:${used}%`} /></div>}
      <div class="muted small">{d.label}</div>
      {d.low && <div class="muted small">{d.hint}</div>}
    </div>
  );
}

/** Back to the version before the last update: the first click asks, the second goes. */
function GoBack({ p, go }: { p: upgrade.Point; go: () => Promise<void> }) {
  const [sure, setSure] = useState(false);
  const click = () => { if (!sure) { setSure(true); return; } setSure(false); go(); };
  return (
    <ActionLink id="upgradeBack" title={`The homelab files as they were before the update of ${new Date(p.when).toLocaleString()}; settings and data stay`} onClick={click}>
      {sure ? `click again to go back to ${p.version}` : `go back to ${p.version} (${p.commit.slice(0, 7)})`}
    </ActionLink>
  );
}

function UpgradeState({ u, on }: { u: UpgradeLine | null; on: HostActions }) {
  if (!u) return <span id="upgradeState" />;
  if (u.error) return <span id="upgradeState"><span class="muted" title={u.error}> · no update check</span></span>;
  return (
    <span id="upgradeState">
      {u.behind ? <span class="warn">{` · ${u.behind} new change${u.behind === 1 ? '' : 's'}`}</span> : <span class="ok"> · ✓ up to date</span>}
      {u.appCommit && <span class="muted" title="The commit this app was built from">{` · build ${u.appCommit.slice(0, 7)}`}</span>}
      {u.previous && <> · <GoBack p={u.previous} go={on.goBack} /></>}
    </span>
  );
}

/** The machine card. */
export function Host({ i, atLogin, menu, upgrade, on }: HostProps) {
  const disks = i.disks || [];
  const tray = trayNote(systemOfHost(i.os || ''), i.desktop || '');
  return (
    <>
      <Row k="Machine">
        {i.supported ? (i.osVersion || i.os) : `${i.osVersion || i.os} (not supported)`}
        {(i.model || i.machine) && <span class="muted">{' · ' + (i.model || i.machine)}</span>}
      </Row>
      <Row k="Container runtime">
        {i.runtimeOK ? <><span class="dot ok" />{i.runtimeFound}</> : <span class="bad">{`${i.runtime} is not ready: ${i.runtimeHint}`}</span>}
      </Row>
      <Row k="Runs in the background"><Background on={on} /></Row>
      {atLogin !== null && (
        <Row k={i.os.startsWith('macOS') ? 'Menu bar item' : 'Tray icon'}>
          <Flip id="trayAtLogin" on={atLogin} yes={`✓ starts at ${signIn(i.os)}`} no="only while the app is open" turnOn={`Start at ${signIn(i.os)}`} turnOff="Turn off" set={on.setTrayAtLogin} />
          {!!tray && <div id="trayNote" class="muted">{tray}</div>}
        </Row>
      )}
      {menu?.available && (
        <Row k="App menu">
          <Flip id="menuEntry" on={menu.added} yes="✓ in the app menu" no="opened from its file" turnOn="Add to the app menu" turnOff="Remove" set={on.setMenuEntry} />
        </Row>
      )}
      <Row k="Homelab folder">
        {i.rootOK ? i.root : <span class="bad">{i.kit ? 'not set up yet' : 'not found'}</span>}{' '}
        <ActionLink cls="small" title="Choose the folder with compose.yaml" onClick={on.chooseRoot}>{i.rootOK ? 'Change…' : 'Choose…'}</ActionLink>
      </Row>
      {!!disks.length && (
        <div class="diskrow"><dt>Storage</dt><dd><div id="diskSpace" class="disks">{disks.map((d) => <DiskBar key={d.label + d.name} d={d} />)}</div></dd></div>
      )}
      <div><dt>Version</dt><dd id="versionInfo">{i.version}<UpgradeState u={upgrade} on={on} /></dd></div>
    </>
  );
}

export interface RuntimeProps {
  i: app.HostInfo;
  start: () => void;
  open: (url: string) => void;
}

/** When an account starts its session, in the system's own word: Windows signs in, the others log in. */
const signIn = (os: string) => (os.startsWith('Windows') ? 'sign-in' : 'login');

/** The container runtime, walked through: download it, open it, and this screen notices on its own once it answers. */
export function Runtime({ i, start, open }: RuntimeProps) {
  // On Linux the engine is a system service: started, not opened, and
  // installed from the system's packages rather than downloaded.
  const service = (i.os || '').startsWith('Linux');
  const moves = 'This screen moves on by itself once it is running.';
  return (
    <>
      <h2>{i.runtimeInstalled ? `Start ${i.runtime}` : `Install ${i.runtime}`}</h2>
      {i.runtimeInstalled ? <>
        <p>{service ? `${i.runtime} is installed but not running. Start it now and at every boot; your password is asked for once.`
          : `${i.runtime} is installed but not running. Open it, accept what it asks the first time, and turn on starting at ${signIn(i.os)} in its settings.`}</p>
        <div class="actions"><button id="startRuntime" class="primary" onClick={start}>{`${service ? 'Start' : 'Open'} ${i.runtime}`}</button><span class="muted">{moves}</span></div>
      </> : service ? <>
        <ol><li>{`Install ${i.runtime} and its compose plugin from your system's packages (the guide has the commands).`}</li><li>Add yourself to the docker group, then log out and back in.</li></ol>
        <div class="actions">{i.runtimeDownload && <button id="getRuntime" class="primary" onClick={() => open(i.runtimeDownload!)}>Open the install guide</button>}<span class="muted">{moves}</span></div>
      </> : <>
        <ol><li>{`Download ${i.runtime}, the engine every app runs in.`}</li><li>Open the downloaded file and drag it to Applications (or run the installer).</li><li>Open it once and accept what it asks.</li></ol>
        <div class="actions">{i.runtimeDownload && <button id="getRuntime" class="primary" onClick={() => open(i.runtimeDownload!)}>{`Download ${i.runtime}`}</button>}<span class="muted">{`Or in Terminal: ${i.runtimeHint}. ${moves}`}</span></div>
      </>}
    </>
  );
}

/** No homelab folder yet: a build that carries the homelab files makes one. */
export function NewHomelab({ i, create, choose }: { i: app.HostInfo; create: () => Promise<void>; choose: () => void }) {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await create(); } catch { setBusy(false); } };
  return (
    <>
      <h2>Start your homelab</h2>
      <p>{`Homelab Wizard makes the folder everything lives in, at ${i.newRoot}, with the apps' settings and guides. Your photos, media, and backups can live elsewhere; Settings says where.`}</p>
      <div class="actions">
        <button id="createHomelab" class="primary" disabled={busy} onClick={go}>{busy ? 'Setting it up…' : 'Set it up for me'}</button>
        <span class="muted">Already have one? <ActionLink onClick={choose}>Choose it</ActionLink></span>
      </div>
    </>
  );
}

export const mountHost = (el: Element, props: HostProps) => render(<Host {...props} />, el);
export const mountRuntime = (el: Element, props: RuntimeProps) => render(<Runtime {...props} />, el);
export const mountNewHomelab = (el: Element, props: { i: app.HostInfo; create: () => Promise<void>; choose: () => void }) => render(<NewHomelab {...props} />, el);
