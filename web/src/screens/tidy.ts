// Tidy Up: reads TidyUp, runs the screen's jobs through TidyRun, and keeps
// the running job's events (media:event) for the job panel.
import { mountTidy, mountTidySheet, tabNow, type TidyConfirm, type TidyJob, type TidyTab } from '../tidy/Tidy';
import { store } from '../store';
import { navigate } from '../app';
import { $, errorText, go, showError } from '../core';

export const tidyData = store(() => go().TidyUp());
let tab: TidyTab = 'overview';
// A tab kept from before the tabs changed (New downloads, Lyrics) opens where those things are now.
try { tab = tabNow(localStorage.getItem('homelab.tidyTab') || 'overview'); } catch { /* none */ }
let job: TidyJob | null = null;
let review: app.TidyBook[] | null = null;
const skip = new Set<number>();
let confirm: TidyConfirm | null = null;

const titles: Record<string, string> = {
  'music scan': 'Scanning your music', 'music run': 'Tidying your music', 'music finalize': 'Swapping in your cleaned library',
  'music verify': 'Checking nothing went missing', 'music free-space': 'Freeing the space', 'music undo': 'Putting the old library back',
  'music navidrome-cleanup': 'Tidying Navidrome', 'music playlists': 'Making playlists', 'music lyrics': 'Adding lyrics',
  'music genres': 'Checking genres', 'music genre-counts': 'Counting your genres', 'movies genre-counts': "Counting your films' genres", 'tv genre-counts': "Counting your shows' genres", 'books genre-counts': "Counting your books' genres", 'books review': 'Reviewing your books', 'books apply': 'Tidying your books', 'books undo': 'Undoing the last apply',
  'movies scan': 'Scanning your films', 'movies run': 'Handing films to Tdarr', 'movies collect': "Collecting Tdarr's work",
  'tv scan': 'Scanning your TV', 'movies dedupe': 'Removing the extra copies', 'trash restore': 'Putting it back', 'movies posters': 'Asking Jellyfin for posters', 'tv posters': 'Asking Jellyfin for posters', 'tv dedupe': 'Removing the extra copies', 'tv run': 'Handing episodes to Tdarr', 'tv collect': "Collecting Tdarr's work",
  'audiobooks scan': 'Scanning your audiobooks', 'audiobooks run': 'Merging your audiobooks',
  'inbox scan': 'Checking Downloads', 'tdarr setup': 'Setting up Tdarr', 'arr apply': 'Handing the downloads over',
};

function draw() {
  const d = tidyData.value || null;
  mountTidy($('tidyRoot'), {
    d, error: tidyData.error ? errorText(tidyData.error) : undefined, tab, job, review, skip,
    pick: (t) => { tab = t; try { localStorage.setItem('homelab.tidyTab', t); } catch { /* none */ } if (t === 'books' && !review) loadReview(); draw(); },
    closeJob: () => { job = null; draw(); },
    toggle: (id) => { if (skip.has(id)) skip.delete(id); else skip.add(id); draw(); },
    act: {
      run, stop: () => { go().TidyStop(); },
      ask: (c) => { confirm = c; drawSheet(); $('tidySheet').hidden = false; },
      reveal: (path) => { Promise.resolve(go().TidyReveal(path)).catch(showError); },
      settings: () => navigate('settings'),
      review: () => { tab = 'books'; draw(); if (!review) loadReview(); },
      cover: (id, which) => go().TidyCover(id, which),
    },
  });
  // The sidebar's count: what needs a look (a check that blocks, or a library swapped and not checked).
  const looks = (d?.checks || []).filter((c) => !c.ok && c.needs === 'all').length + (d?.libraries || []).filter((l) => l.stage === 'swapped').length;
  $('tidyCount').textContent = looks ? String(looks) : '';
}
// Closing sets hidden only on an open sheet: the sheet calls this again once
// it is hidden (its onClose), and setting hidden again would call it again.
function drawSheet() { mountTidySheet($('tidySheetBox'), confirm, () => { const s = $('tidySheet'); if (!s.hidden) s.hidden = true; }); }

tidyData.watch(draw);
export function loadTidy() { if (tab === 'books' && !review) loadReview(); return tidyData.load(); }
async function loadReview() {
  try { review = await go().TidyReview(); } catch (e) { showError(e); review = []; }
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
  job = { kind, action, title: titles[`${kind} ${action}`] || `${kind} ${action}`, started: Date.now(), lines: [], log: [`$ homelab media ${kind} ${action} ${args.join(' ')}`.trim()] };
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
