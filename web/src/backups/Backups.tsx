// The Backups screen's parts: the tiles, each database copy, the vault
// export reminder, and the off-site Duplicati jobs. app.ts reads the data
// and runs the buttons; these only draw.
import { render } from 'preact';
import { ago, never, untilText } from '../format';
import { Tile } from '../status/Tiles';

/** "45 seconds", "3 minutes". */
const tookText = (s: number) => (s < 120 ? `${s} seconds` : `${Math.round(s / 60)} minutes`);

/** "1.2 MB", in powers of 1024 as file sizes are; "—" for none. */
function bytes(n: number): string {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

const shortPath = (p: string) => { const parts = p.split('/').filter(Boolean); return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p; };

const order: Record<string, number> = { stale: 0, none: 1, fresh: 2 };

/** The copies, what needs a look first. */
export const sortedCopies = (o: backup.Overview) => (o.copies || []).slice().sort((a, b) => order[a.state] - order[b.state]);

/** The restore test tile: when one last passed and how long it took, a failure since, and the drills on record when hovered. */
function RestoreTile({ t, due }: { t: backup.RestoreLog; due: boolean }) {
  const runs = t.history || [];
  const newest = runs[runs.length - 1];
  const timed = runs.slice().reverse().find((r) => r.passed && r.seconds);
  const sub = newest && !newest.passed ? <span class="bad">Failed {ago(newest.when)}: {newest.summary}</span>
    : due ? <span class="warn">Due: Test a restore</span>
    : (t.lastSummary || 'Proven in the last 30 days') + (timed ? ` · in ${tookText(timed.seconds!)}` : '');
  const record = runs.slice(-6).reverse().map((r) => `${new Date(r.when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${r.passed ? 'passed' : 'failed'}${r.seconds ? ' in ' + tookText(r.seconds) : ''}`);
  return <Tile id="restoreTile" title={record.length ? `Restore drills on record (${runs.length}):\n` + record.join('\n') : undefined}
    label="Restore test" value={never(t.lastTest) ? 'Never' : ago(t.lastTest)} sub={sub} />;
}

export function BackupTiles({ o, os }: { o: backup.Overview; os: string }) {
  const copies = sortedCopies(o);
  const fresh = copies.filter((c) => c.state === 'fresh').length;
  const stale = copies.filter((c) => c.state === 'stale');
  return (
    <>
      <Tile label="Last backup" value={never(o.lastRun) ? 'Never' : ago(o.lastRun)} sub={never(o.envCopied) ? 'Settings file not copied yet' : `Settings file copied ${ago(o.envCopied)}`} />
      <Tile label="Fresh copies" value={<>{String(fresh)}<small> of {copies.length}</small></>}
        sub={stale.length ? <span class="bad">Stale: {stale.map((c) => c.name).join(', ')}</span> : `Each under ${o.staleAfterHours} hours old`} />
      <Tile label="Destination" value={o.destinationOK ? 'Set' : <span class="warn">Not set</span>}
        sub={o.destinationOK ? <span title={o.destination}>{shortPath(o.destination)}</span>
          : os === 'linux' ? 'Put a backup drive or a synced folder in Settings › BACKUP_DESTINATION' : 'Put a Proton Drive folder in Settings › BACKUP_DESTINATION'} />
      <RestoreTile t={o.restoreTest || ({} as backup.RestoreLog)} due={o.restoreDue} />
    </>
  );
}

const copyMark: Record<string, [string, string]> = { fresh: ['ok', 'Fresh'], stale: ['bad', 'Stale'], none: ['', 'None yet'] };

/** Each database copy or volume archive, what needs a look first. */
export function CopyRows({ o }: { o: backup.Overview }) {
  const copies = sortedCopies(o);
  if (!copies.length) return <tr><td colSpan={4} class="muted">No installed app has a database to dump yet.</td></tr>;
  return (
    <>
      {copies.map((c) => {
        const [cls, word] = copyMark[c.state] || ['', c.state];
        return (
          <tr key={c.id}>
            <td><strong>{c.name}</strong><span class="local">{c.volume ? 'volume archive' : 'database'}</span></td>
            <td class="state"><span class={'dot ' + cls} />{c.state === 'none' ? word : `${word} · ${ago(c.newest)}`}</td>
            <td>{bytes(c.size)}</td>
            <td>{c.count ? String(c.count) : '—'}</td>
          </tr>
        );
      })}
    </>
  );
}

/** The password vault export: when one was last kept, or a plain one to delete. */
export function Vault({ o }: { o: backup.Overview }) {
  const plain = o.plainExports || [];
  return (
    <>
      <div class="row">
        <h2>Password vault export</h2>
        {plain.length ? <span class="bad">✗ Delete the plain export</span>
          : never(o.vaultExport) ? <span class="warn">Never exported</span>
          : o.vaultDue ? <span class="warn">Due: last {ago(o.vaultExport)}</span>
          : <span class="ok">✓ Exported {ago(o.vaultExport)}</span>}
      </div>
      {!!plain.length && <p class="bad">{plain.join(', ')} in recovery-staging/secrets holds every password readable. Delete it, then export again encrypted.</p>}
      <p>The database backup needs the server to open. Once a month, also keep an export you can open anywhere: in the Bitwarden web vault, Tools › Export vault › .json (Encrypted) › Password protected, with that password kept outside the vault. Save it in <code>recovery-staging/secrets</code> and the nightly Secrets job takes it off-site. The backup reminds you when one is due.</p>
    </>
  );
}

export interface JobsProps {
  /** The jobs, or null when Duplicati could not be asked. */
  jobs: duplicati.Job[] | null;
  problem?: string;
  create: () => void;
}

const jobMark: Record<string, [string, string]> = { ok: ['ok', 'Ran'], failed: ['bad', 'Failed'], stale: ['warn', 'Not run for over a week'], never: ['warn', 'Never run'] };

/** The encrypted off-site jobs: each Duplicati job's last run. */
export function Jobs({ jobs, problem, create }: JobsProps) {
  const title = <h2>Off-site jobs (Duplicati)</h2>;
  if (!jobs) {
    return <div class="row">{title}<span class="muted">{/DUPLICATI_PASSWORD is empty/.test(problem || '') ? 'Shown here once DUPLICATI_PASSWORD is in Settings.' : problem}</span></div>;
  }
  if (!jobs.length) {
    return (
      <>
        <div class="row">{title}<button class="small" onClick={create}>Create the backup jobs</button></div>
        <p class="muted">No jobs yet. This makes the jobs in docs/Automation.md, encrypted with passphrases kept in .env, and runs the small ones once. Then copy DUPLICATI_SECRETS_PASSPHRASE from Settings into Vaultwarden.</p>
      </>
    );
  }
  const bad = jobs.filter((j) => j.state !== 'ok').length;
  return (
    <>
      <div class="row">{title}{bad ? <span class="warn">{bad} need a look</span> : <span class="ok">✓ All {jobs.length} ran</span>}</div>
      <ul class="alertlist">
        {jobs.map((j) => {
          const [cls, word] = jobMark[j.state] || ['', j.state];
          return (
            <li key={j.id}>
              <span class={'dot ' + cls} />
              <div class="grow"><strong>{j.name}</strong>{j.errorMessage ? <div class="bad">{j.errorMessage}</div> : j.state !== 'ok' ? <div class="muted">{word}</div> : null}</div>
              {j.size && <span class="size muted">{j.size}</span>}
              <span class="when muted" title={never(j.nextRun) ? '' : 'Next run ' + new Date(j.nextRun).toLocaleString()}>
                {never(j.lastFinished) ? 'never' : ago(j.lastFinished)}
                {!never(j.nextRun) && <span class="next"> · next {untilText(j.nextRun)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export const mountBackupTiles = (el: Element, props: { o: backup.Overview; os: string }) => render(<BackupTiles {...props} />, el);
export const mountCopyRows = (el: Element, props: { o: backup.Overview } | null) => render(props && <CopyRows {...props} />, el);
export const mountVault = (el: Element, props: { o: backup.Overview }) => render(<Vault {...props} />, el);
export const mountJobs = (el: Element, props: JobsProps) => render(<Jobs {...props} />, el);
