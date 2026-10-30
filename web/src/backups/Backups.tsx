// The Backups screen's parts: the tiles, each database copy (grouped: stale,
// up to date, paused while its app waits for a drive, not copied yet), the
// vault export reminder, and the off-site Duplicati jobs. app.ts reads the
// data and runs the buttons; these only draw.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ago, bytes, dateTimeText, dayText, never, untilText } from '../format';
import { CardHead } from '../parts/Card';
import { Row, Rows, type Tone } from '../parts/Row';
import { Tile } from '../status/Tiles';

/** "45 seconds", "3 minutes". */
const tookText = (s: number) => (s < 120 ? `${s} seconds` : `${Math.round(s / 60)} minutes`);

const shortPath = (p: string) => { const parts = p.split('/').filter(Boolean); return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p; };

const order: Record<string, number> = { stale: 0, none: 1, paused: 2, fresh: 3 };

/** The copies, what needs a look first. */
export const sortedCopies = (o: backup.Overview) => (o.copies || []).slice().sort((a, b) => order[a.state] - order[b.state]);

/** Where the backups go, in words: "Proton Drive", "the Backup drive", else its last folder. */
export function placeName(dest: string): string {
  const clouds: [RegExp, string][] = [[/ProtonDrive/i, 'Proton Drive'], [/OneDrive/i, 'OneDrive'], [/GoogleDrive|Google Drive/i, 'Google Drive'], [/Dropbox/i, 'Dropbox'], [/iCloud|Mobile Documents/i, 'iCloud Drive'], [/pCloud/i, 'pCloud']];
  for (const [re, name] of clouds) if (re.test(dest)) return name;
  const drive = dest.match(/^\/(?:Volumes|media\/[^/]+|run\/media\/[^/]+|mnt)\/([^/]+)/) || dest.match(/^([A-Z]):[\\/]/i);
  if (drive) return `the ${drive[1]} drive`;
  return dest.split(/[\\/]/).filter(Boolean).pop() || dest;
}

/** The folder in the place the backups go: its last folder. */
const lastFolder = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;

/** "/Volumes/Hobbies" → "the Hobbies drive". */
const driveName = (path: string) => placeName(path);

/** Duplicati's sizes ("3.311 GiB") as the app's other sizes ("3.3 GB"). */
export function sizeText(s: string): string {
  const m = s.trim().match(/^([\d.,]+)\s*(bytes|B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)$/i);
  if (!m) return s;
  const power = { b: 0, bytes: 0, kb: 1, kib: 1, mb: 2, mib: 2, gb: 3, gib: 3, tb: 4, tib: 4 }[m[2].toLowerCase()]!;
  return bytes(parseFloat(m[1].replace(',', '.')) * 1024 ** power);
}

/** The restore test tile: when one last passed and how long it took, a failure since, and the drills on record when hovered; Test a restore once there is a backup to test. */
function RestoreTile({ t, due, test }: { t: backup.RestoreLog; due: boolean; test?: () => void }) {
  const runs = t.history || [];
  const newest = runs[runs.length - 1];
  const timed = runs.slice().reverse().find((r) => r.passed && r.seconds);
  const sub = newest && !newest.passed ? <span class="bad">Failed {ago(newest.when)}: {newest.summary}</span>
    : due ? <span class="warn">Prove the backups open, once a month</span>
    : (t.lastSummary || (never(t.lastTest) ? 'Once there is a backup to test' : 'Proven in the last 30 days')) + (timed ? ` · in ${tookText(timed.seconds!)}` : '');
  const record = runs.slice(-6).reverse().map((r) => `${dayText(new Date(r.when), { day: 'numeric', month: 'short' })}: ${r.passed ? 'passed' : 'failed'}${r.seconds ? ' in ' + tookText(r.seconds) : ''}`);
  return <Tile id="restoreTile" title={record.length ? `Restore drills on record (${runs.length}):\n` + record.join('\n') : undefined}
    label="Restore test" value={never(t.lastTest) ? 'Never' : ago(t.lastTest)}
    sub={<>
      {sub}
      {test && <span class="tileaction"><button id="restoreTest" class="small" title="Duplicati restores a dozen files from last night's Homelab AppData backup, and each is compared with the live file" onClick={test}>Test a restore</button></span>}
    </>} />;
}

/** The drives the paused copies' apps wait for, in words. */
const drivesOf = (copies: backup.Copy[]) => [...new Set(copies.map((c) => driveName(c.waitingFor || '')))].join(' and ');

export function BackupTiles({ o, os, test }: { o: backup.Overview; os: string; test?: () => void }) {
  const copies = sortedCopies(o);
  const fresh = copies.filter((c) => c.state === 'fresh').length;
  const stale = copies.filter((c) => c.state === 'stale');
  const paused = copies.filter((c) => c.state === 'paused');
  return (
    <>
      <Tile label="Last backup" value={never(o.lastRun) ? 'Never' : ago(o.lastRun)} sub={never(o.envCopied) ? 'Settings file not copied yet' : 'Every night at 03:30; the settings file too'} />
      <Tile id="copiesTile" label="Copies up to date" value={copies.length ? <>{String(fresh)}<small> of {copies.length - paused.length}</small></> : 'None yet'}
        sub={!copies.length ? 'The first are made the night after an app with a database starts' : stale.length || paused.length ? <>
          {!!stale.length && <span class="bad">Stale: {stale.map((c) => c.name).join(', ')}</span>}
          {!!paused.length && <span>{`${paused.length} more paused: ${paused.length === 1 ? 'its app waits' : 'their apps wait'} for ${drivesOf(paused)}`}</span>}
        </> : `Each under ${o.staleAfterHours} hours old`} />
      <Tile id="offsiteTile" label="Off-site" value={o.destinationOK ? placeName(o.destination) : <span class="warn">Not set</span>}
        sub={o.destinationOK ? <span title={o.destination}>Encrypted, in {lastFolder(o.destination)}</span>
          : os === 'linux' ? 'Put a backup drive or a synced folder in Settings › Backups go to' : 'Put a Proton Drive folder in Settings › Backups go to'} />
      <RestoreTile t={o.restoreTest || ({} as backup.RestoreLog)} due={o.restoreDue} test={test} />
    </>
  );
}

interface CopyGroup { key: string; label: string; tone: Tone; copies: backup.Copy[]; note: string }

/** The copies in groups: stale, up to date, paused, not copied yet. */
export function copyGroups(o: backup.Overview): CopyGroup[] {
  const copies = sortedCopies(o);
  const of = (state: string) => copies.filter((c) => c.state === state);
  const paused = of('paused'), none = of('none');
  const oldest = paused.filter((c) => !never(c.newest)).map((c) => c.newest).sort()[0];
  return [
    { key: 'stale', label: 'Stale', tone: 'bad' as Tone, copies: of('stale'), note: '' },
    { key: 'fresh', label: 'Up to date', tone: 'ok' as Tone, copies: of('fresh'), note: '' },
    { key: 'paused', label: 'Paused', tone: '' as Tone, copies: paused,
      note: `${paused.map((c) => c.name).join(', ')} ${paused.length === 1 ? 'waits' : 'wait'} for ${drivesOf(paused)}` + (oldest ? `; ${paused.length === 1 ? 'its last copy' : 'their last copies'} (${ago(oldest)}) ${paused.length === 1 ? 'is' : 'are'} kept` : '') },
    { key: 'none', label: 'Not copied yet', tone: '' as Tone, copies: none, note: `${none.map((c) => c.name).join(', ')}, tonight` },
  ].filter((g) => g.copies.length);
}

/** Each database copy or volume archive, in groups; stale and up to date open, the rest folded with their names. */
export function CopyRows({ o }: { o: backup.Overview }) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const groups = copyGroups(o);
  if (!groups.length) return <tr><td colSpan={4} class="muted">No installed app has a database to dump yet.</td></tr>;
  return (
    <>
      {groups.map((g) => {
        const open = picked[g.key] ?? (g.key === 'stale' || g.key === 'fresh');
        const toggle = () => setPicked({ ...picked, [g.key]: !open });
        return [
          <tr key={'g:' + g.key} class={'grouphead fold copygroup ' + g.key + (g.tone === 'bad' ? ' bad' : '') + (open ? ' open' : '')} onClick={toggle}>
            <th colSpan={4}>
              <button type="button" class="foldbtn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggle(); }}>
                <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>{g.label}
              </button>
              <span class="n">{String(g.copies.length)}</span>
              {!open && g.note && <span class="names">{g.note}</span>}
            </th>
          </tr>,
          ...(open ? g.copies.map((c) => (
            <tr key={c.id} class={'copy ' + c.state}>
              <td class="name"><span class={'dot ' + g.tone} />{c.name}</td>
              <td class="when muted">{never(c.newest) ? '—' : ago(c.newest)}</td>
              <td class="size muted">{bytes(c.size)}</td>
              <td class="kept muted">{c.count ? `${c.count} kept` : '—'}</td>
            </tr>
          )) : []),
        ];
      })}
    </>
  );
}

/** The password vault export, as one line that opens for how. */
export function Vault({ o }: { o: backup.Overview }) {
  const plain = o.plainExports || [];
  const [tone, said]: [Tone, string] = plain.length ? ['bad', 'A plain export is lying in recovery-staging/secrets: delete it']
    : never(o.vaultExport) ? ['warn', 'Never made yet']
    : o.vaultDue ? ['warn', `Due: the last one is from ${ago(o.vaultExport)}`]
    : ['ok', `The last one ${ago(o.vaultExport)}`];
  return (
    <details class="morerow" open={!!plain.length}>
      <summary>
        <span class={'dot ' + tone} />
        <span class="grow"><strong>Password vault export</strong><span class={'sub ' + (tone === 'bad' ? 'bad' : 'muted')}>A copy of your passwords you can open anywhere, once a month. {said}.</span></span>
        <span class="btn small">How</span>
      </summary>
      {!!plain.length && <p class="bad">{plain.join(', ')} in recovery-staging/secrets holds every password readable. Delete it, then export again encrypted.</p>}
      <p>The database backup needs the server to open. Once a month, also keep an export you can open anywhere: in the Bitwarden web vault, Tools › Export vault › .json (Encrypted) › Password protected, with that password kept outside the vault. Save it in <code>recovery-staging/secrets</code> and the nightly Secrets job takes it off-site. The backup reminds you when one is due.</p>
    </details>
  );
}

export interface JobsProps {
  /** The jobs, or null when Duplicati could not be asked. */
  jobs: duplicati.Job[] | null;
  /** Where they go, in words ("Proton Drive"); "" when not known. */
  place: string;
  problem?: string;
  /** The drive Duplicati waits for, stopped until it is plugged in. */
  waitingFor?: string;
  create: () => void;
}

const jobMark: Record<string, [Tone, string]> = { ok: ['ok', 'Ran'], failed: ['bad', 'Failed'], stale: ['warn', 'Not run for over a week'], never: ['warn', 'Never run'] };

/** The encrypted off-site jobs: each Duplicati job's last run. */
/** Why the jobs could not be read, in words: not Go's "dial tcp … connection refused". */
export function jobsProblem(problem: string, waitingFor?: string): string {
  if (/DUPLICATI_PASSWORD is empty/.test(problem)) return 'Shown here once DUPLICATI_PASSWORD is in Settings.';
  if (waitingFor) return `Duplicati waits for ${driveName(waitingFor)}: the jobs show here once it is plugged in.`;
  if (/connection refused|dial tcp|no such host|timeout|EOF/i.test(problem)) return 'Duplicati is not answering: start it on Status, and the jobs show here.';
  return problem;
}

export function Jobs({ jobs, place, problem, waitingFor, create }: JobsProps) {
  const title = place ? `Encrypted to ${place}` : 'Encrypted off-site';
  if (!jobs) {
    return <CardHead title={title}><span class="muted" title={problem}>{jobsProblem(problem || '', waitingFor)}</span></CardHead>;
  }
  if (!jobs.length) {
    return (
      <>
        <CardHead title={title}><button class="small" onClick={create}>Create the backup jobs</button></CardHead>
        <p class="muted">No jobs yet. This makes the jobs in docs/Automation.md, encrypted with passphrases kept in .env, and runs the small ones once. Then copy DUPLICATI_SECRETS_PASSPHRASE from Settings into Vaultwarden.</p>
      </>
    );
  }
  const bad = jobs.filter((j) => j.state !== 'ok').length;
  const newest = jobs.map((j) => j.lastFinished).filter((t) => !never(t)).sort().pop();
  return (
    <>
      <CardHead title={title}>{bad ? <span class="warn">{bad} need a look</span> : <span class="ok">✓ All {jobs.length} ran{newest ? ' ' + ago(newest) : ''}</span>}</CardHead>
      <Rows kind="jobs">
        {jobs.map((j) => {
          const [tone, word] = jobMark[j.state] || ['', j.state];
          return (
            <Row key={j.id} dot={tone} title={j.name} sub={j.errorMessage || (j.state !== 'ok' && word)} subTone={j.errorMessage ? 'bad' : undefined}
              end={j.size && <span class="size muted">{sizeText(j.size)}</span>}
              whenTitle={(never(j.lastFinished) ? 'Never ran' : 'Last ran ' + dateTimeText(new Date(j.lastFinished))) + (never(j.nextRun) ? '' : '\nNext run ' + dateTimeText(new Date(j.nextRun)))}
              when={never(j.nextRun) ? (never(j.lastFinished) ? 'never ran' : 'ran ' + ago(j.lastFinished)) : <span class="next">next {untilText(j.nextRun)}</span>} />
          );
        })}
      </Rows>
    </>
  );
}

/** Kopia, the second engine beside Duplicati: where its copy is, and its own restore test. */
export function KopiaLine({ k, test }: { k: backup.Engine; test: () => void }) {
  return (
    <>
      <CardHead title="Second copy (Kopia)">
        {k.failed ? <span class="bad">✗ Restore test failed</span>
          : k.due ? <span class="warn">Due: Test Kopia's restore</span>
          : <span class="ok">✓ Restore proven {ago(k.lastTest)}</span>}
      </CardHead>
      <p class="muted">
        Kopia keeps a copy of its own of the same folders in <span title={k.repository}>{shortPath(k.repository)}</span>, apart from Duplicati's, and its restore is tested on its own.
        {' '}{k.failed ? `The last test: ${k.failed}.` : never(k.lastTest) ? 'No restore test yet.' : `Last proven ${ago(k.lastTest)}.`}
      </p>
      <div class="actions"><button class="btn" onClick={test}>Test Kopia's restore</button></div>
    </>
  );
}

export const mountKopia = (el: Element, props: { k: backup.Engine; test: () => void } | null) => render(props && <KopiaLine {...props} />, el);
export const mountBackupTiles = (el: Element, props: { o: backup.Overview; os: string; test?: () => void }) => render(<BackupTiles {...props} />, el);
export const mountCopyRows = (el: Element, props: { o: backup.Overview } | null) => render(props && <CopyRows {...props} />, el);
export const mountVault = (el: Element, props: { o: backup.Overview }) => render(<Vault {...props} />, el);
export const mountJobs = (el: Element, props: JobsProps) => render(<Jobs {...props} />, el);
