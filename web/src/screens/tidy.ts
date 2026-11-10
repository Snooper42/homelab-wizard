// Tidy Up: reads TidyUp, runs the screen's jobs through TidyRun, and keeps
// the running job's events (media:event) for the job panel.
import { jobTitle, mountTidy, mountTidySheet, tabNow, type TidyConfirm, type TidyJob, type TidyTab } from '../tidy/Tidy';
import { store } from '../store';
import { navigate } from '../app';
import { showSettings } from './settings';
import { cliFlow } from './status';
import { $, errorText, go, showError } from '../core';

export const tidyData = store(() => go().TidyUp());
let tab: TidyTab = 'overview';
// A tab kept from before the tabs changed (New downloads, Lyrics) opens where those things are now.
try { tab = tabNow(localStorage.getItem('homelab.tidyTab') || 'overview'); } catch { /* none */ }
let job: TidyJob | null = null;
// Where should your libraries live? is open (Change where your libraries live…, or a drive's Choose another…).
let placing = false;
let review: app.TidyBook[] | null = null;
// Why the review couldn't be read (Calibre's database locked, say): said on Books, with Try again, never "every book looks tidy".
let reviewError = '';
// Look… was pressed: the review is shown, and the keyboard taken to it, once it's there.
let showReview = false;
const skip = new Set<number>();
let confirm: TidyConfirm | null = null;
// A job this window didn't start (the agent's Collect, a terminal's run): followed every few seconds while it holds the lock.
let running: app.TidyRunning | null = null;
let following: number | undefined;
// A job this window didn't start that was asked to stop: when it took the lock.
let stoppingElsewhere = '';
const FOLLOW_MS = 3000;


function draw() {
  const d = tidyData.value || null;
  mountTidy($('tidyRoot'), {
    d, error: tidyData.error ? errorText(tidyData.error) : undefined, tab, job, review, reviewError, skip, running, placing, stoppingElsewhere,
    reload: () => { tidyData.load(); },
    reloadReview: () => { loadReview(); },
    pick: (t) => { tab = t; try { localStorage.setItem('homelab.tidyTab', t); } catch { /* none */ } if (t === 'books' && !review) loadReview(); draw(); },
    // Closed from the keyboard, its place goes back to the tabs rather than the top of the window.
    closeJob: () => { job = null; draw(); (document.querySelector('#tidy .seg button[aria-checked="true"]') as HTMLElement | null)?.focus(); },
    toggle: (id) => { if (skip.has(id)) skip.delete(id); else skip.add(id); draw(); },
    act: {
      run, stop: () => { if (job && !job.ended) { job.stopping = true; draw(); } go().TidyStop(); },
      stopElsewhere: (lock) => {
        stoppingElsewhere = lock.start;
        draw();
        Promise.resolve(go().TidyStopElsewhere(lock.pid, lock.start)).catch((e) => { stoppingElsewhere = ''; showError(e); draw(); });
      },
      ask: (c) => { confirm = c; drawSheet(); $('tidySheet').hidden = false; },
      reveal: (path) => { Promise.resolve(go().TidyReveal(path)).catch(showError); },
      settings: (keys) => (keys?.length ? showSettings(keys) : navigate('settings')),
      review: () => { tab = 'books'; try { localStorage.setItem('homelab.tidyTab', tab); } catch { /* none */ } showReview = true; draw(); if (!review) loadReview(); },
      cover: (id, which) => go().TidyCover(id, which),
      // Fetches ffmpeg; once it's in, the job that wanted it runs again.
      install: async (after) => {
        await run('install', 'ffmpeg', [], true);
        if (after && job?.ended?.ok) run(after.kind, after.action);
      },
      open: (url) => { Promise.resolve(go().Open(url)).catch(showError); },
      inbox: (folders, when) => { Promise.resolve(go().TidySetInbox(folders, when)).then((d) => { tidyData.set(d); draw(); }).catch(showError); },
      pickFolder: () => Promise.resolve(go().TidyPickFolder()).catch((e) => { showError(e); return ''; }),
      places: (open) => { placing = open; if (open) { tab = 'overview'; } draw(); if (open) document.querySelector('#tidy .tidyplaces')?.scrollIntoView({ block: 'start' }); },
      drives: () => Promise.resolve(go().TidyDrives()),
      place: (root) => Promise.resolve(go().TidyPlace(root)),
      pickMediaFolder: () => Promise.resolve(go().TidyPickMediaFolder()).catch((e) => { showError(e); return ''; }),
      albums: (artist, album) => Promise.resolve(go().TidyFindAlbums(artist, album)),
      titles: (kind, name) => Promise.resolve(go().TidyFindTitles(kind, name)),
      // Kept, then the apps that read the libraries are recreated on it: homelab fix lists them and asks first.
      useMediaRoot: (root, name) => {
        Promise.resolve(go().TidySetMediaRoot(root)).then((d) => {
          placing = false; tidyData.set(d); draw();
          cliFlow(`Use ${name}`, 'fix', '', 'Restart them');
        }).catch(showError);
      },
    },
  });
  // The button that started a job waits while it runs, which takes the keyboard's place with it: it goes to the job's own button.
  if (job && (!document.activeElement || document.activeElement === document.body) && $('tidy').classList.contains('active')) (document.querySelector('#tidyJob button:not([disabled])') as HTMLElement | null)?.focus();
  // Look…: once the review is there, it's scrolled to and its first switch (or its Apply) takes the keyboard.
  if (showReview && tab === 'books' && (review || reviewError)) {
    showReview = false;
    const box = document.getElementById('tidyReview') || document.getElementById('tidyReviewError');
    box?.scrollIntoView({ block: 'start' });
    (box?.querySelector('input, button') as HTMLElement | null)?.focus({ preventScroll: true });
  }
  // The sidebar's count: what needs a look (a check that blocks, or a library swapped and not checked).
  const looks = (d?.checks || []).filter((c) => !c.ok && c.needs === 'all').length + (d?.libraries || []).filter((l) => l.stage === 'swapped').length;
  $('tidyCount').textContent = looks ? String(looks) : '';
  follow();
}
// While a job this window didn't start holds the lock and Tidy Up shows, where it has got to; once it's done, the screen is read again.
function follow() {
  const held = (job && !job.ended) ? false : running ? !!running.lock : !!tidyData.value?.lock;
  if (held && following === undefined) {
    following = window.setTimeout(async () => {
      following = undefined;
      if (job && !job.ended) { running = null; return; }
      // Another screen shows: nothing is asked, and it looks again once Tidy Up is back.
      if (!$('tidy').classList.contains('active')) { follow(); return; }
      // A read that fails (a busy disk) keeps what was known and asks again on the next tick.
      try { running = await go().TidyLock(); } catch { follow(); return; }
      if (!running.lock) { running = null; tidyData.load(); }
      draw();
    }, FOLLOW_MS);
  }
}
// Closing sets hidden only on an open sheet: the sheet calls this again once
// it is hidden (its onClose), and setting hidden again would call it again.
function drawSheet() { mountTidySheet($('tidySheetBox'), confirm, () => { const s = $('tidySheet'); if (!s.hidden) s.hidden = true; }); }

tidyData.watch(draw);
// Back from installing a tool another way (Terminal, Calibre's installer): the checks are read again
// as the window comes back, so the screen says it's found without a click.
window.addEventListener('focus', () => {
  if ($('tidy').classList.contains('active') && (!job || job.ended) && (tidyData.value?.checks || []).some((c) => !c.ok && c.needs)) tidyData.load();
});
export function loadTidy() { running = null; if (tab === 'books' && !review) loadReview(); return tidyData.load(); }
async function loadReview() {
  reviewError = '';
  try { review = await go().TidyReview(); } catch (e) { review = null; reviewError = errorText(e); }
  draw();
}

/** One event from the engine: the panel's step, bar, and lines. */
function onEvent(ev: Record<string, any>) {
  if (!job || job.ended) return;
  const text = String(ev.text ?? '');
  switch (ev.type) {
    case 'step': job.step = { n: ev.n, total: ev.total, text }; job.progress = undefined; break;
    case 'progress': case 'working':
      if (ev.total) job.progress = { done: Number(ev.done || 0), total: Number(ev.total), label: String(ev.label || ''), note: ev.note ? String(ev.note) : undefined, eta: ev.eta ? Number(ev.eta) : undefined };
      break;
    case 'ok': job.lines.push({ tone: 'ok', text }); break;
    case 'warn': job.lines.push({ tone: 'warn', text }); break;
    case 'fail': job.lines.push({ tone: 'bad', text }); break;
    // What else came of it, said plainly (the lyrics' songs that kept theirs, and why): a grey dot.
    case 'note': job.lines.push({ tone: '', text }); break;
    case 'result': job.result = ev; break;
  }
  const line = ev.type === 'kv' ? `${ev.label}: ${ev.value}` : ev.type === 'step' ? `[${ev.n}/${ev.total}] ${text}` : ev.type === 'progress' ? '' : text;
  if (line) job.log.push(line);
  draw();
}

let listening = false;
async function run(kind: string, action: string, args: string[] = [], yes = false) {
  if (job && !job.ended) return;
  if (!listening) { listening = true; window.runtime.EventsOn('media:event', onEvent); }
  const title = jobTitle(kind, action, args);
  job = { kind, action, args, yes, title, started: Date.now(), lines: [], log: [`$ homelab media ${kind} ${action} ${args.join(' ')}`.trim()] };
  running = null;
  draw();
  try {
    await go().TidyRun(kind, action, args, yes);
    job.ended = { ok: job.result?.ok !== false };
    if (job.result?.ok === false) job.ended.why = 'It finished with something to look at: see the lines above';
  } catch (e) {
    job.ended = { ok: false, why: errorText(e) };
  }
  if (kind === 'books' && action === 'review') { skip.clear(); await loadReview(); }
  draw();
  tidyData.load();
}

drawSheet();
