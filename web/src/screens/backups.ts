// Backups: the copies and Duplicati's jobs as last read, and the backup
// screen's commands.
import { mountBackupTiles, mountCopyRows, mountJobs, mountKopia, mountVault, placeName } from '../backups/Backups';
import { store } from '../store';
import { statusById } from './status';
import { cliProgress, endJob, startJob } from '../jobs';
import { $, go, osName, showError } from '../core';

// Backups: the newest copy of each database and volume, the destination,
// and the last restore test, read from the files the nightly job leaves.

// Both as last read (store.ts): the copies, and beside them Duplicati's
// jobs (which ask Duplicati, not the files).
export const backupsData = store(() => go().Backups());
export const jobsData = store(async () => (await go().DuplicatiJobs()) || []);
// Each draws from both: the tiles' Test a restore waits for the jobs, and
// the jobs' card names the place from the copies' destination.
backupsData.watch(() => { drawBackups(); drawJobs(); });
jobsData.watch(() => { if (backupsData.value && !backupsData.error) drawBackups(); drawJobs(); });
export function loadBackups() { return Promise.all([jobsData.load(), backupsData.load()]); }

function drawBackups() {
  if (backupsData.error) { mountCopyRows($('backupRows'), null); showError(backupsData.error); return; }
  const o = backupsData.value!;
  // The restore test needs the Homelab AppData job to have run once.
  const testable = (jobsData.value || []).some((j) => j.name.toLowerCase() === 'homelab appdata' && j.state !== 'never');
  const test = () => backupTask('restore-test', 'Testing a restore (a few minutes)…', 'Restore test passed', 'The restore test failed: the log says why');
  mountBackupTiles($('backupTiles'), { o, os: osName, test: testable ? test : undefined });
  mountCopyRows($('backupRows'), { o });
  mountVault($('vaultCard'), { o });
  $('kopiaCard').hidden = !o.kopia;
  mountKopia($('kopiaCard'), o.kopia ? { k: o.kopia, test: () => backupTask('restore-test-kopia', "Testing Kopia's restore (a few minutes)…", "Kopia's restore test passed", "Kopia's restore test failed: the log says why") } : null);
  // A copy paused while its app waits for a drive is not a problem.
  const problems = (o.copies || []).filter((c) => c.state === 'stale').length + (o.plainExports || []).length + (o.kopia?.failed ? 1 : 0);
  $('backupsCount').textContent = problems ? String(problems) : '';
  const dup = statusById.duplicati;
  $('openDuplicati').hidden = !(dup?.state === 'running' && dup.url);
  $('openDuplicati').onclick = () => go().Open(dup.url);
}

// The encrypted off-site jobs: each Duplicati job's last run.
function drawJobs() {
  const card = $('dupCard');
  const create = () => backupTask('duplicati-setup', 'Creating the backup jobs…', 'Backup jobs created', 'Creating the jobs stopped: the log says why');
  if (!jobsData.value && !jobsData.error) return;
  const o = backupsData.value;
  const place = o?.destinationOK ? placeName(o.destination) : '';
  if (jobsData.error) {
    const e: any = jobsData.error;
    mountJobs(card, { jobs: null, place, problem: String((e && e.message) || e), waitingFor: statusById.duplicati?.waitingFor, create });
    return;
  }
  mountJobs(card, { jobs: jobsData.value!, place, create });
}

// Runs a backup-screen command, streaming its output into the panel.
async function backupTask(action, busy, done, failed) {
  // Test a restore is in its tile, drawn again while this runs: look it up each time.
  const panel = $('backupPanel'), log = $('backupLog');
  const btns = () => [$('backupNow'), document.getElementById('restoreTest')].filter(Boolean) as HTMLButtonElement[];
  panel.hidden = false;
  $('backupTitle').textContent = busy;
  log.textContent = '';
  startJob('backup');
  btns().forEach((b) => { b.disabled = true; });
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let ok = true;
  try { await go().Homelab(action, '', action === 'backup'); } catch (e) { ok = false; showError(e); }
  cliProgress(ok ? 'done' : 'failed');
  endJob();
  if (typeof off === 'function') off();
  $('backupTitle').textContent = ok ? done : failed;
  btns().forEach((b) => { b.disabled = false; });
  loadBackups();
}
// Moving: out packs this homelab into one file and stops it; in unpacks one here.
async function moveTask(direction, button) {
  if (direction === 'out' && button.dataset.sure !== '1') {
    button.dataset.sure = '1';
    button.textContent = 'Click again: back up, stop every app, and pack';
    return;
  }
  const panel = $('backupPanel'), log = $('backupLog');
  button.disabled = true;
  panel.hidden = false;
  $('backupTitle').textContent = direction === 'out' ? 'Moving out (a backup first, then packing)…' : 'Moving in…';
  log.textContent = '';
  const off = window.runtime.EventsOn('cli:log', (line) => { log.textContent += line + '\n'; log.scrollTop = log.scrollHeight; });
  let file = '', ok = true;
  try { file = await go().Move(direction); } catch (e) { ok = false; showError(e); }
  if (typeof off === 'function') off();
  button.disabled = false;
  delete button.dataset.sure;
  button.textContent = direction === 'out' ? 'Move out…' : 'Move in…';
  if (ok && !file) { panel.hidden = true; return; }
  $('backupTitle').textContent = !ok ? 'The move stopped: the log says why'
    : direction === 'out' ? 'Packed. This machine is stopped: take the file and the media drive to the new one' : 'Moved in: the apps that ran before are starting';
}
$('moveOut').onclick = (e) => moveTask('out', e.target);
$('moveIn').onclick = (e) => moveTask('in', e.target);
$('backupNow').onclick = () => backupTask('backup', 'Backing up…', 'Backup done', 'The backup failed: the log says which step');
$('recoveryKit').onclick = async () => {
  const btn = $('recoveryKit');
  btn.disabled = true;
  try { await go().RecoveryKit(); } catch (e) { showError(e); }
  btn.disabled = false;
};
