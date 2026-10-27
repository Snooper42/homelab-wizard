// The window running a job: its bar, a row per app, and Docker's lines
// under Show details.
import { mountJobApps, overall } from './job/Apps';
import { progress } from './setup/Checklist';
import { catalog } from './screens/choose';
import { $ } from './core';

// The window running a job (cli, backup, setup, or install): a bar with
// the step at hand in words, a row per app (job:app, from what Compose
// prints), and the raw lines under Show details, which fold away once the
// rows say it better. The CLI's steps (cli:step) drive the bar; without
// them, the apps' rows do.
export let jobBox = 'cli';
/** The job window's box goes back to the command sheet's. */
export function endJob() { jobBox = 'cli'; }
let jobRows: Record<string, progress.Update> = {};
let jobSteps = false;
export function startJob(box: string) {
  jobBox = box;
  jobRows = {};
  jobSteps = false;
  mountJobApps($(box + 'Apps'), []);
  const d = $(box + 'Details');
  if (d) { d.open = true; delete d.dataset.touched; }
  cliProgress(null);
}
export function jobApp(u: progress.Update) {
  const fresh = !jobRows[u.app];
  jobRows[u.app] = u;
  const rows = Object.values(jobRows);
  mountJobApps($(jobBox + 'Apps'), rows);
  const d = $(jobBox + 'Details');
  if (d && fresh && !d.dataset.touched) d.open = false;
  if (jobSteps) return;
  const box = $(jobBox + 'Progress');
  if (!box) return;
  const ready = rows.filter((r) => r.done && !r.failed).length;
  box.hidden = false;
  box.classList.remove('failed');
  box.querySelector('.fill').style.width = `${Math.round(overall(rows) * 100)}%`;
  box.querySelector('.step').textContent = rows.length === 1 ? rows[0].words : `${ready} of ${rows.length} apps ready`;
}
// Opening Show details by hand keeps it open.
document.addEventListener('click', (e) => {
  const d = (e.target as Element).closest?.('.jobdetails > summary')?.parentElement;
  if (d) d.dataset.touched = '1';
});

// The CLI's steps name apps by ID ("Updating navidrome, mealie-db"); the
// window names them as people know them.
function namesFor(text: string) {
  const byID = Object.fromEntries((catalog?.apps || []).map((a) => [a.id, a.name]));
  return text.replace(/[a-z0-9][a-z0-9-]*[a-z0-9]/g, (w) => byID[w] || w);
}

export function cliProgress(s) {
  const box = $(jobBox + 'Progress');
  if (!s) { box.hidden = true; return; }
  const fill = box.querySelector('.fill'), step = box.querySelector('.step');
  if (s === 'done' || s === 'failed') {
    if (box.hidden) return;
    fill.style.width = '100%';
    box.classList.toggle('failed', s === 'failed');
    step.textContent = s === 'done' ? 'Done' : 'Stopped with a problem: Show details says where';
    return;
  }
  if (s.total < 2) return;
  jobSteps = true;
  box.hidden = false;
  box.classList.remove('failed');
  // A step that says how far it is (a download) moves the bar within it.
  const within = s.percent ? s.percent / 100 : 0.5;
  fill.style.width = `${Math.round(((s.n - 1 + within) / s.total) * 100)}%`;
  step.textContent = `${namesFor(s.text)}${s.percent ? ` · ${s.percent}%` : ''} · ${s.n} of ${s.total}`;
}
