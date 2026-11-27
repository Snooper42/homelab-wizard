import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ago, bytes, clockText, dateTimeText, dayText, never, untilText } from '../format';
import { Card, CardFigure, CardHead } from '../parts/Card';
import { Hover } from '../parts/Hover';
import { AppMark } from '../parts/AppMark';
import { Row, Rows, type Tone } from '../parts/Row';

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
  const failed = !!newest && !newest.passed;
  const sub = failed ? <span class="bad">{newest.summary}</span> : due ? <span class="warn">Due</span> : null;
  const record = runs.slice(-6).reverse().map((r) => `${dayText(new Date(r.when), { day: 'numeric', month: 'short' })}: ${r.passed ? 'passed' : 'failed'}${r.seconds ? ' in ' + tookText(r.seconds) : ''}`);
  return (
    <Card kind="bkcard" id="restoreTile" title={record.length ? `Restore drills on record (${runs.length}):\n` + record.join('\n') : undefined}>
      <CardHead title="Restore test" />
      <CardFigure figure={<span class={'value' + (failed ? ' bad' : '')}>{never(t.lastTest) ? 'Never' : failed ? 'Failed' : 'Passed'}</span>} label={never(t.lastTest) ? undefined : ago(t.lastTest)} />
      {sub && <p class="bksub">{sub}</p>}
      {test && <div class="bkactions"><button id="restoreTest" class="small" onClick={test}>Test a restore</button></div>}
    </Card>
  );
}

/** A job's folders, by name: /source/appdata/immich/ is "immich". */
const sourceNames = (sources: string[]) => sources.map((s) => s.split('/').filter(Boolean).pop() || s).join(', ');

/** A job's last run on hover: when, how long it took, what it holds, the versions kept, its folders, and its next run. */
export function JobRun({ j }: { j: duplicati.Job }) {
  const line = (text: string, cls = 'outline') => <span class={cls}>{text}</span>;
  return (
    <>
      {line(never(j.lastFinished) ? 'Never ran' : `Last ran ${dateTimeText(new Date(j.lastFinished))}` + (j.took ? `, in ${tookText(j.took)}` : ''))}
      {j.holds && line(`Holds ${j.holds} of yours` + (j.files ? `, ${j.files.toLocaleString('en-US')} ${j.files === 1 ? 'file' : 'files'}` : ''))}
      {(j.size || j.versions) && line([j.size && `${sizeText(j.size)} where it is kept`, j.versions && `${j.versions} ${j.versions === 1 ? 'version' : 'versions'} to go back to`].filter(Boolean).join(', '))}
      {!!j.sources?.length && line(`Copies ${sourceNames(j.sources)}`)}
      {!never(j.checked) && line(j.checkProblem ? `Checked ${dateTimeText(new Date(j.checked!))}: a file is damaged` : `Checked ${dateTimeText(new Date(j.checked!))}: a sample of its files matched`)}
      {!never(j.nextRun) && line(`Next run ${dateTimeText(new Date(j.nextRun))}`, 'outfoot')}
    </>
  );
}

/** A night's result for one app, as a tone: copied is ok, stopped (so not copied) warn, failed bad; nothing to copy none. */
export const resultTone = (r?: string): Tone => (r === 'copied' ? 'ok' : r === 'stopped' ? 'warn' : r === 'failed' ? 'bad' : '');

export function nightTone(n: backup.Night): Tone {
  const r = Object.values(n.apps || {});
  if (r.includes('failed')) return 'bad';
  if (r.includes('stopped')) return 'warn';
  return r.includes('copied') ? 'ok' : '';
}

const nightDate = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };

export function nightWords(n: backup.Night, name: (id: string) => string): string {
  const all = Object.entries(n.apps || {}).filter(([, r]) => r !== 'none' && r !== 'outside');
  const copied = all.filter(([, r]) => r === 'copied').length;
  const missed = all.filter(([, r]) => r === 'failed' || r === 'stopped').map(([id, r]) => `${name(id)} ${r}`);
  const day = nightDate(n.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}: ${all.length ? `${copied} of ${all.length} copied` : 'nothing to copy'}${missed.length ? ' · ' + missed.join(', ') : ''}`;
}

function Nights({ nights, name }: { nights: backup.Night[]; name: (id: string) => string }) {
  const shown = nights.slice(-14);
  return (
    <div class="bknights" role="list" aria-label={`The last ${shown.length} nights`}>
      {shown.map((n) => {
        const words = nightWords(n, name);
        return (
          <span key={n.date} role="listitem" class={'bknight ' + nightTone(n)} title={words} aria-label={words}>
            <i />
            <small aria-hidden="true">{['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'][nightDate(n.date).getDay()]}</small>
          </span>
        );
      })}
    </div>
  );
}

/** An app's last `count` nights, oldest first: its result each night (undefined where the night didn't have it). */
export const appNights = (nights: backup.Night[], app: string, count = 7) => nights.slice(-count).map((n) => ({ date: n.date, result: n.apps?.[app] }));

/** The drives the paused copies' apps wait for, in words. */
const drivesOf = (copies: backup.Copy[]) => [...new Set(copies.map((c) => driveName(c.waitingFor || '')))].join(' and ');

export interface BackupTilesProps {
  o: backup.Overview; os: string; test?: () => void;
  /** Each app's state by its ID (Status'), to say why a copy is stale and offer Start. */
  apps?: Record<string, api.AppStatus>;
  start?: (a: api.AppStatus) => void;
  gaps?: duplicati.Gap[];
  addGap?: () => void;
}

export function BackupTiles({ o, os, test, apps, start, gaps, addGap }: BackupTilesProps) {
  const copies = sortedCopies(o);
  const fresh = copies.filter((c) => c.state === 'fresh');
  const stale = copies.filter((c) => c.state === 'stale');
  const paused = copies.filter((c) => c.state === 'paused');
  const kept = Math.max(0, ...copies.map((c) => c.count));
  const size = fresh.reduce((t, c) => t + c.size, 0);
  const lastNight = !never(o.lastRun) && Date.now() - new Date(o.lastRun).getTime() < 30 * 3600e3;
  const needs = [...stale, ...paused];
  return (
    <>
      <Card kind="bkcard bklast" id="copiesTile">
        <CardHead title={lastNight || never(o.lastRun) ? 'Last night' : 'Last backup'} />
        <CardFigure
          figure={<span class="value">{copies.length ? <>{fresh.length}<small> of {copies.length - paused.length} copied</small></> : 'None yet'}</span>}
          label={never(o.lastRun) ? undefined : lastNight ? clockText(new Date(o.lastRun)) : ago(o.lastRun)}
          chip={stale.length ? <span class="bkskipped">{stale.length === 1 ? `${stale[0].name} skipped` : `${stale.length} skipped`}</span> : undefined} />
        {!!o.nights?.length && <Nights nights={o.nights} name={(id) => copies.find((c) => c.app === id)?.name || apps?.[id]?.name || id} />}
        {!copies.length && <p class="bksub">None yet</p>}
        <dl class="bkfacts">
          <div><dt>Next</dt><dd>Tonight, 03:30</dd></div>
          <div><dt>{lastNight ? "Last night's size" : 'Its size'}</dt><dd>{size ? bytes(size) : '—'}</dd></div>
          <div><dt>Kept</dt><dd>{kept ? `${kept} ${kept === 1 ? 'night' : 'nights'}` : '—'}</dd></div>
        </dl>
      </Card>
      <Card kind="bkcard bkneeds" id="needsYou">
        <CardHead title={<>Skipped{!!stale.length && <span class="bkcount">{stale.length}</span>}</>} />
        {needs.length ? <Rows kind="bkneedlist">{needs.map((c) => {
          const a = c.app ? apps?.[c.app] : undefined;
          return <Row key={c.id} lead={<AppMark id={c.app} name={c.name} icon="" small />} dot={c.state === 'stale' ? 'bad' : 'warn'} title={c.name}
            sub={c.state === 'paused' ? `Waiting for ${driveName(c.waitingFor || '')}` : staleWhy(c, apps) || `Last copied ${ago(c.newest)}`}
            end={c.state === 'stale' && a && a.state !== 'running' && start ? <button type="button" class="small primary" onClick={() => start(a)}>Start</button> : undefined} />;
        })}</Rows> : <p class="bksub ok">✓ Every copy is up to date.</p>}
      </Card>
      <RestoreTile t={o.restoreTest || ({} as backup.RestoreLog)} due={o.restoreDue} test={test} />
      <Card kind="bkcard" id="offsiteTile">
        <CardHead title="Off-site" />
        <CardFigure figure={<span class="value">{o.destinationOK ? placeName(o.destination) : <span class="warn">Not set</span>}</span>} label={o.destinationOK ? lastFolder(o.destination) : 'Settings › Backups go to'} />
      </Card>
      {!!gaps?.length && addGap && <Card kind="bkcard" id="gapsTile"><Gaps gaps={gaps} add={addGap} /></Card>}
    </>
  );
}

interface CopyGroup { key: string; label: string; tone: Tone; copies: backup.Copy[]; note: string }

/** The copies in groups: stale, up to date, paused, not copied yet. */
export function copyGroups(o: backup.Overview): CopyGroup[] {
  const copies = sortedCopies(o);
  const of = (state: string) => copies.filter((c) => c.state === state);
  const paused = of('paused'), none = of('none');
  return [
    { key: 'stale', label: 'Out of date', tone: 'bad' as Tone, copies: of('stale'), note: '' },
    { key: 'fresh', label: 'Up to date', tone: 'ok' as Tone, copies: of('fresh'), note: '' },
    { key: 'paused', label: 'Paused', tone: '' as Tone, copies: paused,
      note: `${paused.map((c) => c.name).join(', ')} ${paused.length === 1 ? 'waits' : 'wait'} for ${drivesOf(paused)}` },
    { key: 'none', label: 'Not copied yet', tone: '' as Tone, copies: none, note: `${none.map((c) => c.name).join(', ')}, tonight` },
  ].filter((g) => g.copies.length);
}

/** Whether a copy's size moved by a tenth or more since the night before's: then both are shown. */
const changed = (c: backup.Copy) => !!c.before && Math.abs(c.size - c.before) >= c.before / 10;

/** Why a copy is stale, from its app's state, and what helps: "" when that isn't known. */
export function staleWhy(c: backup.Copy, apps?: Record<string, api.AppStatus>): string {
  if (!apps || !c.app) return '';
  const a = apps[c.app];
  if (!a) return 'Removed';
  if (a.state === 'stopped') return 'Stopped';
  if (a.state !== 'running') return 'Not running';
  return '';
}

/** Each database copy or volume archive, in groups; stale and up to date open, the rest folded with their names. */
export function CopyRows({ o, apps }: { o: backup.Overview; apps?: Record<string, api.AppStatus> }) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const groups = copyGroups(o);
  const nights = o.nights || [];
  const cols = nights.length ? 5 : 4;
  if (!groups.length) return <tr><td colSpan={cols} class="muted">No installed app has a database to dump yet.</td></tr>;
  return (
    <>
      {groups.map((g) => {
        const open = picked[g.key] ?? (g.key === 'stale' || g.key === 'fresh');
        const toggle = () => setPicked({ ...picked, [g.key]: !open });
        return [
          <tr key={'g:' + g.key} class={'grouphead fold copygroup ' + g.key + (g.tone === 'bad' ? ' bad' : '') + (open ? ' open' : '')} onClick={toggle}>
            <th colSpan={cols}>
              <button type="button" class="foldbtn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggle(); }}>
                <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>{g.label}
              </button>
              <span class="n">{String(g.copies.length)}</span>
              {!open && g.note && <span class="names">{g.note}</span>}
            </th>
          </tr>,
          ...(open ? g.copies.map((c) => (
            <tr key={c.id} class={'copy ' + c.state + (c.shrank ? ' shrank' : '')}>
              <td class="name"><span class={'dot ' + (c.shrank ? 'bad' : g.tone)} /><AppMark id={c.app} name={c.name} icon="" small />{c.name}
                {c.shrank && <span class="note bad">Under half the night before's {bytes(c.before || 0)}</span>}
                {c.state === 'stale' && staleWhy(c, apps) && <span class="note muted">{staleWhy(c, apps)}</span>}
              </td>
              <td class="when muted">{never(c.newest) ? '—' : ago(c.newest)}</td>
              <td class="size muted" title={c.before ? `The night before: ${bytes(c.before)}` : undefined}>
                {bytes(c.size)}{!c.shrank && changed(c) && <span class="was"> (was {bytes(c.before || 0)})</span>}
              </td>
              <td class="kept muted">{c.count ? `${c.count} kept` : '—'}</td>
              {!!nights.length && <td class="nights" aria-label={`The last ${Math.min(7, nights.length)} nights`}>
                {appNights(nights, c.app || c.id).map((n) => <span key={n.date} class={'dot ' + resultTone(n.result)} title={`${nightDate(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${n.result || 'not copied yet'}`} />)}
              </td>}
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
    : ['ok', ago(o.vaultExport)];
  return (
    <details class="morerow" open={!!plain.length}>
      <summary>
        <span class={'dot ' + tone} />
        <span class="grow"><strong>Password vault export</strong><span class={'sub ' + (tone === 'bad' ? 'bad' : 'muted')}>{said.charAt(0).toUpperCase() + said.slice(1)}</span></span>
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
  if (/connection refused|dial tcp|no such host|timeout|EOF/i.test(problem)) return 'Duplicati is not answering: start it on Home, and the jobs show here.';
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
        <p class="muted">No jobs yet. Afterwards, copy DUPLICATI_SECRETS_PASSPHRASE from Settings into Vaultwarden.</p>
      </>
    );
  }
  const bad = jobs.filter((j) => j.state !== 'ok' || j.checkProblem).length;
  const newest = jobs.map((j) => j.lastFinished).filter((t) => !never(t)).sort().pop();
  return (
    <>
      <CardHead title={title}>{bad ? <span class="warn">{bad} need a look</span> : <span class="ok">✓ All {jobs.length} ran{newest ? ' ' + ago(newest) : ''}</span>}</CardHead>
      <Rows kind="jobs">
        {jobs.map((j) => {
          const [mark, word] = jobMark[j.state] || ['', j.state];
          // Sunday's check (homelab backup-check) found a damaged file: a version may not restore.
          const damaged = j.checkProblem && j.state === 'ok' ? `Failed its check ${dateTimeText(new Date(j.checked!))}: ${j.checkProblem}. A version may not restore: open the job in Duplicati.` : '';
          const tone = damaged ? 'bad' : mark;
          return (
            <Row key={j.id} dot={tone} title={j.name} sub={j.errorMessage || damaged || (j.state !== 'ok' && word)} subTone={j.errorMessage || damaged ? 'bad' : undefined}
              end={j.size && <span class="size muted">{sizeText(j.size)}</span>}
              when={<Hover label={never(j.nextRun) ? (never(j.lastFinished) ? 'never ran' : 'ran ' + ago(j.lastFinished)) : <span class="next">next {untilText(j.nextRun)}</span>} tip={<JobRun j={j} />} />} />
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
        In <span title={k.repository}>{shortPath(k.repository)}</span>.
        {' '}{k.failed ? `The last test: ${k.failed}.` : never(k.lastTest) ? 'No restore test yet.' : `Last proven ${ago(k.lastTest)}.`}
      </p>
      <div class="actions"><button class="btn" onClick={test}>Test Kopia's restore</button></div>
    </>
  );
}

export const mountKopia = (el: Element, props: { k: backup.Engine; test: () => void } | null) => render(props && <KopiaLine {...props} />, el);
export const mountBackupTiles = (el: Element, props: BackupTilesProps) => render(<BackupTiles {...props} />, el);
export const mountCopyRows = (el: Element, props: { o: backup.Overview; apps?: Record<string, api.AppStatus> } | null) => render(props && <CopyRows {...props} />, el);
export const mountVault = (el: Element, props: { o: backup.Overview }) => render(<Vault {...props} />, el);
export const mountJobs = (el: Element, props: JobsProps) => render(<Jobs {...props} />, el);

export function Gaps({ gaps, add }: { gaps: duplicati.Gap[]; add: () => void }) {
  if (!gaps.length) return null;
  return (
    <>
      <CardHead title="Not in any backup" />
      <Rows kind="gaplist">
        {gaps.map((g) => <Row key={g.path} title={g.name} sub={<><span title={g.path}>{shortPath(g.path)}</span> · {g.why}</>}
          end={g.job ? <button type="button" class="small" onClick={add}>Add</button> : undefined} />)}
      </Rows>
    </>
  );
}
