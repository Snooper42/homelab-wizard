// Settings › This machine › Take the homelab off this machine: homelab
// uninstall, with what else to remove picked here. The plan comes from
// the homelab itself (the folders it names, the backups it keeps because
// a cloud drive syncs them), and nothing happens until the words are typed.
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export interface UninstallActions {
  plan: (o: app.UninstallOptions) => Promise<string>;
  /** Runs it; each line of its log comes to onLine. */
  run: (o: app.UninstallOptions, onLine: (line: string) => void) => Promise<void>;
}

const none: app.UninstallOptions = { data: false, folder: false, backups: false, app: false, everythingElse: false };

interface Choice {
  key: keyof app.UninstallOptions;
  label: string;
  note: string;
  danger?: boolean;
}

function choices(machine: string): Choice[] {
  return [
    { key: 'data', label: 'Delete the apps’ data', note: 'Their volumes and data folders. Without this, Start the homelab brings every app back as it was.' },
    { key: 'folder', label: 'Delete the homelab folder too', note: 'With .env: every app’s password, and the passphrase that opens the backups. Print the recovery kit (Backups) first if you may restore them.' },
    { key: 'backups', label: 'Delete the backups on ' + machine.toLowerCase(), note: 'A backup folder in a cloud drive always stays: deleting it here would delete it on every machine signed in to the drive.' },
    { key: 'app', label: 'Remove Homelab Wizard itself', note: 'Its settings and downloads too. It quits when it is done.' },
    { key: 'everythingElse', label: 'Delete everything else in the container runtime', note: 'Every other container, image, and volume (with its data), the homelab’s or not: things you run yourself go too.', danger: true },
  ];
}

export function Uninstall({ machine, on }: { machine: string; on: UninstallActions }) {
  const [o, setO] = useState<app.UninstallOptions>(none);
  const [plan, setPlan] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');
  const [result, setResult] = useState<'' | 'done' | 'failed'>('');
  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const phrase = o.everythingElse ? 'delete everything' : 'uninstall';
  const set = (key: keyof app.UninstallOptions, on: boolean) => {
    const next = { ...o, [key]: on };
    if (key === 'folder' && on) next.data = true; // the folder holds the data
    if (key === 'data' && !on) next.folder = false;
    setO(next);
    setPlan('');
    setTyped('');
    setResult('');
  };
  const review = async () => {
    setBusy(true);
    try { setPlan(await on.plan(o)); } catch { /* shown by app.ts */ }
    setBusy(false);
  };
  const go = async () => {
    setBusy(true);
    setResult('');
    setLog('');
    let text = '';
    try {
      await on.run(o, (line) => { text += line + '\n'; setLog(text); });
      setResult('done');
    } catch {
      setResult('failed');
    }
    setBusy(false);
    setPlan('');
    setTyped('');
  };

  return (
    <div id="uninstall" class="uninstall">
      <h3 class="subhead">Take the homelab off {machine.toLowerCase()}</h3>
      <p class="muted">Stops and removes every app, the images it pulled, the scheduled jobs, and the tray icon at login. For when another machine runs the homelab now, or to start again. The media drive is never touched.</p>
      {choices(machine).map((c) => (
        <label key={c.key} class={'check' + (c.danger ? ' danger' : '')}>
          <input type="checkbox" id={'uninstall-' + c.key} checked={o[c.key]} disabled={busy || (c.key === 'data' && o.folder)} onChange={(e) => set(c.key, e.currentTarget.checked)} />
          {' '}<strong>{c.label}</strong>
          <span class="muted"> {c.note}</span>
        </label>
      ))}
      {!plan && <button id="uninstallReview" class="btn" disabled={busy} onClick={review}>Review what goes…</button>}
      {plan && (
        <div class="uninstallconfirm">
          <pre id="uninstallPlan">{plan}</pre>
          {o.everythingElse && <p class="bad">Everything else in the container runtime goes too, the homelab’s or not, and cannot be brought back.</p>}
          <label class="check">Type <code>{phrase}</code> to go ahead:{' '}
            <input id="uninstallTyped" type="text" autocomplete="off" spellcheck={false} value={typed} disabled={busy} onInput={(e) => setTyped(e.currentTarget.value)} />
          </label>
          <div class="actions">
            <button id="uninstallGo" class="btn danger" disabled={busy || typed.trim().toLowerCase() !== phrase} onClick={go}>Uninstall</button>
            <button class="btn" disabled={busy} onClick={() => { setPlan(''); setTyped(''); }}>Cancel</button>
          </div>
        </div>
      )}
      {log && <pre id="uninstallLog" role="log" ref={logRef}>{log}</pre>}
      {result === 'done' && <p id="uninstallDone" class="ok">{o.app ? 'Done. Homelab Wizard quits now.' : 'Done: the log’s last lines say what is left for you.'}</p>}
      {result === 'failed' && <p id="uninstallFailed" class="bad">Some of it could not be removed: the log says which. Fix that, then run it again; what already went stays gone.</p>}
    </div>
  );
}

export const mountUninstall = (el: Element, props: { machine: string; on: UninstallActions }) => render(<Uninstall {...props} />, el);
