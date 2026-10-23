// Updating: Setup's card for the homelab files (the changes waiting on
// GitHub, and Update), or for a newer app build when the files are
// current; and the banner a newer app build shows on every screen.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { ago } from '../format';

export interface UpgradeProps {
  c: app.UpgradeInfo;
  /** How to get the newest app build on this machine's platform. */
  buildSteps: string;
  /** An update or an app install runs: its button waits. */
  busy: boolean;
  upgrade: () => void;
  installApp: () => void;
  open: (url: string) => void;
}

/** Whether the card has anything to say. */
export const upgradeShown = (c: app.UpgradeInfo) => c.behind > 0 || !!c.appUpdate || c.appBehind > 0;

export function Upgrade({ c, buildSteps, busy, upgrade, installApp, open }: UpgradeProps) {
  const n = c.behind, s = n === 1 ? '' : 's';
  // Stable: the published releases; testing: the latest Release run's builds.
  const releases = c.web ? c.web + (c.channel === 'stable' ? '/releases' : '/actions/workflows/release.yml') : '';
  const app = c.appUpdate;
  if (!n && app) {
    // The folder is current, and GitHub has a newer build of this app.
    return (
      <>
        <div class="row">
          <h2>{app.version ? `Homelab Wizard ${app.version} is ready` : 'A newer Homelab Wizard is ready'}</h2>
          {app.canInstall ? <button id="appUpdateBtn" class="primary small" disabled={busy} onClick={installApp}>Update now</button>
            : <button class="primary small" onClick={() => open(app.page)}>Download it</button>}
        </div>
        <p class="muted">{app.canInstall ? 'Update now downloads it, puts it in place of this one, and opens it again. Your homelab keeps running.' : `Download it from the release page: ${buildSteps}.`}</p>
      </>
    );
  }
  if (!n && c.appBehind > 0) {
    // The folder is current, but this app was built before its latest changes.
    return (
      <>
        <div class="row"><h2>A newer Homelab Wizard is ready</h2>{releases && <button class="primary small" onClick={() => open(releases)}>Open the release builds</button>}</div>
        <p>{`The homelab folder has ${c.appBehind} change${c.appBehind === 1 ? '' : 's'} to the app since this build. Download the newest: ${buildSteps} (Upgrading.md).`}</p>
      </>
    );
  }
  if (!n) return null;
  const notes: string[] = [];
  if (c.newVersion && c.newVersion !== c.version) notes.push(`Version ${c.version} → ${c.newVersion}.`);
  if (c.settingsChanged) notes.push('New settings are added to .env on the way.');
  if (app?.canInstall) notes.push('The app updates too, and opens again.');
  else if (c.selfUpdates && (c.appChanged || app)) notes.push('The app updates too, once its new build is out: the banner offers it.');
  else if (c.appChanged || app) notes.push(`The desktop app changed too: afterwards, ${buildSteps}.`);
  if (c.dirty?.length) notes.push(`Edited here, and kept: ${c.dirty.join(', ')}.`);
  if (c.ahead) notes.push(`This folder has ${c.ahead} commit(s) of its own, so it cannot simply move forward.`);
  if (c.fetchError) notes.push('GitHub could not be reached just now; this is from the last check.');
  const shown = (c.changes || []).slice(0, 6);
  return (
    <>
      <div class="row">
        <h2>{`Update the homelab: ${n} new change${s}`}</h2>
        <button id="upgradeBtn" class="primary small" disabled={c.ahead > 0 || busy} onClick={upgrade}>Update</button>
      </div>
      <ul class="alertlist">
        {shown.map((ch, i) => <li key={i}><span class="dot" /><div class="grow">{ch.subject}</div><span class="when muted">{ago(ch.when)}</span></li>)}
      </ul>
      {n > shown.length && <p class="muted">{`and ${n - shown.length} more`}</p>}
      {!!notes.length && <p>{notes.join(' ')}</p>}
      {!!c.notes?.length && (
        <details class="whatsnew"><summary>{`What is new (${c.notes.length})`}</summary><ul>{c.notes.map((t, i) => <li key={i}>{t}</li>)}</ul></details>
      )}
      <p class="muted">{`Update moves the homelab folder forward to ${c.channel === 'stable' && c.target ? c.target + ' (the stable channel)' : c.upstream}, never merging or overwriting your own edits, then starts the homelab again so changed apps are recreated. Upgrading.md says what each batch of changes asks of you.`}</p>
    </>
  );
}

export interface BannerProps {
  u: app.PendingUpdate;
  isMac: boolean;
  later: () => void;
  /** Downloads it if need be, then the app closes and opens again; rejects when that failed. */
  restart: () => Promise<void>;
  setInstallOnQuit: (on: boolean) => Promise<void>;
}

/** A newer app build, found in the background: what changed, Restart to update, and installing on quit instead. */
export function Banner({ u, isMac, later, restart, setInstallOnQuit }: BannerProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onQuit, setOnQuit] = useState(!!u.installOnQuit);
  const notes = u.notes || [];
  const go = async () => { setBusy(true); try { await restart(); } catch { setBusy(false); } };
  const quit = async (on: boolean) => { setOnQuit(on); try { await setInstallOnQuit(on); } catch { setOnQuit(!on); } };
  return (
    <>
      <div class="row">
        <strong class="grow">{u.version ? `Homelab Wizard ${u.version} is ready` : 'A Homelab Wizard update is ready'}</strong>
        {!!notes.length && <ActionLink id="updateWhatsNew" cls="small" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'What’s new'}</ActionLink>}
        <button id="updateLater" class="small" onClick={later}>Later</button>
        <button id="updateRestart" class="primary small" disabled={busy} title={u.ready ? 'Already downloaded: the app closes and opens again in a few seconds' : 'Downloads it (a minute or two), then the app closes and opens again'} onClick={go}>
          {busy ? (u.ready ? 'Restarting…' : 'Downloading…') : 'Restart to update'}
        </button>
      </div>
      <ul id="updateNotes" hidden={!open}>
        {notes.slice(0, 12).map((n, i) => <li key={i}>{n}</li>)}
        {notes.length > 12 && <li class="muted">{`and ${notes.length - 12} more`}</li>}
      </ul>
      {u.canInstallOnQuit !== false && <label><input type="checkbox" id="installOnQuit" checked={onQuit} onChange={(e) => quit(e.currentTarget.checked)} />Install updates when I quit the app, without asking</label>}
      <span class="muted small">
        {'Your homelab keeps running while the app updates.'
          + (u.canInstallOnQuit === false ? (isMac ? '' : ' Installing asks for an administrator’s password.') : '')
          + (isMac ? ' Afterwards macOS may say Homelab Wizard added items that can run in the background: that is this update, not something new. The app is not signed with a Developer ID, so macOS sees each build as new.' : '')}
      </span>
    </>
  );
}

export const mountUpgrade = (el: Element, props: UpgradeProps | null) => render(props && <Upgrade {...props} />, el);
export const mountBanner = (el: Element, props: BannerProps | null) => render(props && <Banner key={props.u.commit} {...props} />, el);
