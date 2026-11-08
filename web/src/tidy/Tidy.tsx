// Tidy Up: the libraries on the media drive, sorted, tagged, and lean.
// Overview says what needs your OK (each thing with what it wins back and
// one button), the genres, the drive, and what was done, with Undo; each
// library's tab says the same for it alone. screens/tidy.ts reads TidyUp,
// runs the jobs (TidyRun), and keeps the running job's events; these
// components only draw, and say what a click wants (run, confirm, reveal).
import { createContext, render, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { ago } from '../format';
import { Card, CardHead } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows, type Tone } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Sheet } from '../parts/Sheet';
import { Widget } from '../finances/ui/Widget';
import { Stat } from '../finances/ui/Amount';
import { Legend, SplitBar, hue, type Hue } from '../finances/ui/Legend';
import { Donut } from '../finances/ui/charts';

export type TidyTab = 'overview' | 'music' | 'movies' | 'tv' | 'books' | 'audiobooks';

/** A running (or just finished) job, as its events said. */
export interface TidyJob {
  kind: string;
  action: string;
  /** What it was run with, for Try again. */
  args?: string[];
  yes?: boolean;
  title: string;
  started: number;
  /** The step at hand: "Build", 2 of 5. */
  step?: { n: number; total: number; text: string };
  /** The bar: done of total, and what it's on now. */
  progress?: { done: number; total: number; label: string; note?: string; eta?: number };
  /** The lines worth showing: done, notes, failures. */
  lines: { tone: Tone; text: string }[];
  log: string[];
  result?: Record<string, any>;
  /** Set once it ended: ok, or why not. */
  ended?: { ok: boolean; why?: string };
  /** Stop was pressed: it stops at its next safe point, which can take a while. */
  stopping?: boolean;
}

/** What a click asks for. */
export interface TidyActions {
  run: (kind: string, action: string, args?: string[], yes?: boolean) => void;
  stop: () => void;
  ask: (c: TidyConfirm) => void;
  reveal: (path: string) => void;
  /** Settings; with keys, opened at those settings (Jellyfin's API key). */
  settings: (keys?: string[]) => void;
  review: () => void;
  cover: (id: number, which: 'current' | 'new') => Promise<string>;
  /** Fetches ffmpeg (the check's Install); after: the job to run again once it's in. */
  install: (after?: { kind: string; action: string }) => void;
  /** Keeps the folders Tidy Up watches and when it files what's in them (arrive, daily, manual). */
  inbox: (folders: string[], when: string) => void;
  /** The system's folder picker, for a folder to watch: '' when cancelled. */
  pickFolder: () => Promise<string>;
  /** Opens a page in the browser (Calibre's download). */
  open: (url: string) => void;
}

/** A question before a step that changes something. */
export interface TidyConfirm {
  title: string;
  lead: string;
  steps?: string[];
  keep?: string[];
  action: string;
  /** Asks for a second click, for what can't be undone from here. */
  twice?: boolean;
  go: () => void;
}

const names: Record<string, string> = { music: 'Music', books: 'Books', movies: 'Movies', tv: 'TV', audiobooks: 'Audiobooks', inbox: 'Downloads', scrubber: 'Leftovers', tdarr: 'Tdarr', arr: 'Downloads' };
/** What each job is called while it runs: "Scanning your films". */
const titles: Record<string, string> = {
  'music scan': 'Scanning your music', 'music run': 'Tidying your music', 'music finalize': 'Swapping in your cleaned library',
  'music verify': 'Checking nothing went missing', 'music free-space': 'Freeing the space', 'music undo': 'Putting the old library back',
  'music navidrome-cleanup': 'Tidying Navidrome', 'music playlists': 'Making playlists', 'music lyrics': 'Adding lyrics',
  'music genres': 'Checking genres', 'music genre-counts': 'Counting your genres', 'movies genre-counts': "Counting your films' genres", 'tv genre-counts': "Counting your shows' genres", 'books genre-counts': "Counting your books' genres", 'books review': 'Reviewing your books', 'books apply': 'Tidying your books', 'books undo': 'Undoing the last apply', 'books build': 'Making your Calibre library', 'inbox undo': 'Putting it back',
  'movies scan': 'Scanning your films', 'movies run': 'Handing films to Tdarr', 'movies collect': "Collecting Tdarr's work",
  'tv scan': 'Scanning your TV', 'movies dedupe': 'Removing the extra copies', 'trash restore': 'Putting it back', 'movies posters': 'Asking Jellyfin for posters', 'tv posters': 'Asking Jellyfin for posters', 'tv dedupe': 'Removing the extra copies', 'tv run': 'Handing episodes to Tdarr', 'tv collect': "Collecting Tdarr's work",
  'audiobooks scan': 'Scanning your audiobooks', 'audiobooks run': 'Merging your audiobooks',
  'inbox scan': 'Checking Downloads', 'scrubber scan': 'Sweeping up leftovers', 'music delete-backup': 'Removing the old backup', 'install ffmpeg': 'Getting ffmpeg', 'tdarr setup': 'Setting up Tdarr', 'arr apply': 'Handing the downloads over',
};
/** A job's name in words, never its command ("free-space"): for its panel, the lock's card, and one that stopped part-way. */
export function jobTitle(kind: string, action: string, args: string[] = []): string {
  if (kind === 'music' && action === 'lyrics' && args.includes('--tidy')) return 'Tidying lyrics';
  return titles[`${kind} ${action}`] || `${names[kind] || kind}: ${action.replace(/-/g, ' ')}`;
}
/** A size as the engines write it (internal/media's Bytes, video_engine's human): 1000 to a KB, as the Finder and
 * Explorer count a drive, so the screen's "412 GB won back" and Recently done's "412 GB freed" are one figure. */
export function size(v: number): string {
  if (!v) return '—';
  let f = v, i = 0;
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  while (f >= 1000 && i < units.length - 1) { f /= 1000; i++; }
  if (i === 0) return `${Math.trunc(f)} bytes`;
  if (f >= 100) return `${Math.round(f)} ${units[i]}`;
  const tenths = Math.round(f * 10);
  return `${tenths % 10 ? (tenths / 10).toFixed(1) : tenths / 10} ${units[i]}`;
}
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const count = (v: number, one: string, many = one + 's') => `${v.toLocaleString()} ${v === 1 ? one : many}`;
const lib = (d: app.TidyUp, kind: string) => d.libraries.find((l) => l.kind === kind)!;
const last = (l: app.TidyLibrary, action: string) => l.last?.[action];
const busy = (job: TidyJob | null) => !!job && !job.ended;
/** The books' last review was applied (and not undone since): its list is what was changed, not what could be. */
function reviewApplied(l: app.TidyLibrary) {
  const rv = last(l, 'review'), ap = last(l, 'apply'), un = last(l, 'undo');
  return !!(rv && ap?.ok && ap.at > rv.at && (!un || un.at < ap.at));
}

// The languages kept, by name: "eng" reads as English, "eng,jpn" as English and Japanese.
const languageNames: Record<string, string> = { eng: 'English', en: 'English', spa: 'Spanish', es: 'Spanish', fra: 'French', fre: 'French', fr: 'French', deu: 'German', ger: 'German', de: 'German', ita: 'Italian', it: 'Italian', por: 'Portuguese', pt: 'Portuguese', nld: 'Dutch', dut: 'Dutch', nl: 'Dutch', swe: 'Swedish', sv: 'Swedish', nor: 'Norwegian', dan: 'Danish', fin: 'Finnish', pol: 'Polish', rus: 'Russian', ukr: 'Ukrainian', jpn: 'Japanese', ja: 'Japanese', kor: 'Korean', ko: 'Korean', zho: 'Chinese', chi: 'Chinese', zh: 'Chinese', hin: 'Hindi', ara: 'Arabic', heb: 'Hebrew', tur: 'Turkish', gre: 'Greek', ell: 'Greek' };
export function languages(codes: string): string {
  const list = codes.split(/[,\s]+/).filter(Boolean).map((c) => languageNames[c.toLowerCase()] || c.toUpperCase());
  return list.length < 2 ? list.join('') : list.length === 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')}, and ${list.at(-1)}`;
}

/** Whether a line of activity is one to look at: something missing, stopped, or kept back ("Nothing went missing" is good news). */
export const worrying = (text: string) => !/\bnothing went missing\b/i.test(text) && /missing|stopped|kept/i.test(text);

/** A library's tab while its folder is not there (its drive unplugged): its jobs are off. */
const FolderGone = createContext(false);

/** What a tab says while its library's folder is not there, above everything else. */
function Gone({ l }: { l: app.TidyLibrary }) {
  if (l.found) return null;
  return <Card kind="notice" role="status"><strong>{names[l.kind]}: its folder isn't there</strong><span class="muted">{l.folder} could not be found. Plug in the drive it is on: nothing here runs until it is back.</span></Card>;
}

/** A job this window didn't start holds the lock (the agent's Collect, a terminal's run): what it is, for the buttons' hover. */
const Elsewhere = createContext('');

/** A button that runs a job; every one waits while a job runs, this window's or another's. */
function Go({ label, primary, job, title, onClick }: { label: string; primary?: boolean; job: TidyJob | null; title?: string; onClick: () => void }) {
  const gone = useContext(FolderGone), other = useContext(Elsewhere);
  const why = gone ? "Its folder isn't there: plug in its drive" : other ? `Waits for ${other.charAt(0).toLowerCase() + other.slice(1)} to finish` : busy(job) ? 'Waits for the job above to finish' : title;
  return <button class={primary ? 'primary small' : 'small'} disabled={busy(job) || gone || !!other} title={why} onClick={onClick}>{label}</button>;
}

/** The job at hand: its step, its bar, what it's on, its notes, and its log. */
/** What a line's dot says, for VoiceOver (the dot alone is a colour). */
const toneWords: Record<string, string> = { ok: 'Done', warn: 'To look at', bad: 'Failed' };

/** A job's bar: done of total, and about how long is left. */
function Bar({ title, p, idle }: { title: string; p?: TidyJob['progress']; idle: string }) {
  const pct = p && p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : undefined;
  const left = p?.eta ? (p.eta > 3600 ? `~${Math.floor(p.eta / 3600)}h ${Math.round((p.eta % 3600) / 60)}m left` : `~${Math.max(1, Math.round(p.eta / 60))}m left`) : '';
  return (
    <div class="progress">
      <div class="track" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span class="fill" style={{ width: `${pct ?? 0}%` }} /></div>
      <p class="step">{p ? `${p.label} ${p.done.toLocaleString()} of ${p.total.toLocaleString()}${pct !== undefined ? ` · ${pct}%` : ''}${left ? ' · ' + left : ''}` : idle}</p>
    </div>
  );
}

export function JobPanel({ job, stop, done, fix, again }: { job: TidyJob; stop: () => void; done: () => void; fix?: { label: string; run: () => void }; again?: () => void }) {
  const p = job.progress;
  // Stopped is what you did; a job that ended on its own without finishing says so, and why.
  const ended = !job.ended ? '' : job.ended.ok ? 'done' : job.stopping ? 'stopped' : "didn't finish";
  return (
    <Card kind="tidyjob" id="tidyJob">
      <p class="sr" role="status">{ended ? `${job.title}: ${ended}${job.ended && !job.ended.ok && job.ended.why ? '. ' + job.ended.why : ''}` : job.stopping ? `${job.title}: stopping` : job.step ? `${job.title}: step ${job.step.n} of ${job.step.total}, ${job.step.text}` : `${job.title}: started`}</p>
      <CardHead title={ended ? `${job.title}: ${ended}` : job.stopping ? `${job.title}: stopping` : job.title}>
        {job.ended ? <span class="actions">{again && !fix && !job.ended.ok && !job.stopping && <button class="small" onClick={again} title="Runs it again: it picks up where it left off">Try again</button>}<button class="small" onClick={done}>Close</button></span>
          : job.stopping ? <button class="small" disabled title="It stops at its next safe point, so nothing is left half done">Stopping…</button>
          : <button class="small" onClick={stop} title="It stops at a safe point; run it again to carry on where it left off">Stop</button>}
      </CardHead>
      {job.step && <p class="tidystep">Step {job.step.n} of {job.step.total} · {job.step.text}</p>}
      {!job.ended && <Bar title={job.title} p={p} idle="Starting…" />}
      {job.stopping && !job.ended && <p class="muted tidynow">Stopping at the next safe point, so nothing is left half done. Run it again to carry on from there.</p>}
      {p?.note && !job.ended && !job.stopping && <p class="muted tidynow">Now: {p.note}</p>}
      {job.ended && !job.ended.ok && job.ended.why && <p class="bad">{job.ended.why}</p>}
      {fix && <p class="tidyfix"><button class="primary small" onClick={fix.run}>{fix.label}</button> <span class="muted">Then it carries on by itself.</span></p>}
      {!!job.lines.length && (
        <Rows kind="tidylines">
          {job.lines.slice(-9).map((l, i) => <Row key={i} dot={l.tone} title={<>{toneWords[l.tone] && <span class="sr">{toneWords[l.tone]}: </span>}{l.text}</>} />)}
        </Rows>
      )}
      <details class="jobdetails"><summary>Show details</summary><pre role="log">{job.log.join('\n')}</pre></details>
    </Card>
  );
}

/** A job this window didn't start (the agent's, a terminal's): what it is, since when, and where it has got to. */
function RunningCard({ lock, now }: { lock: app.TidyUp['lock'] & {}; now?: app.TidyRunning['now'] }) {
  const title = jobTitle(lock.kind, lock.action);
  const p = now?.progress && now.progress.total ? { done: now.progress.done || 0, total: now.progress.total, label: now.progress.label || '', note: now.progress.note, eta: now.progress.eta } : undefined;
  const since = new Date(lock.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <Card kind="tidyjob" id="tidyRunning">
      <p class="sr" role="status">{title}: {now?.step ? `step ${now.step.n} of ${now.step.total}, ${now.step.text}` : 'running'}</p>
      <CardHead title={title} />
      {now?.step && <p class="tidystep">Step {now.step.n} of {now.step.total} · {now.step.text}</p>}
      <Bar title={title} p={p} idle="Working…" />
      {p?.note && <p class="muted tidynow">Now: {p.note}</p>}
      <p class="muted">Started at {since}, outside this window, and carries on with it closed. The buttons below wait until it's done.</p>
    </Card>
  );
}

/** A job that stopped part-way, and how to carry it on: as it is, after asking again, or from where its choices were made. */
export function carryOn(s: { kind: string; action: string }, d: app.TidyUp, act: TidyActions, pick: (t: TidyTab) => void): { label: string; run: () => void } | { say: string } {
  const title = jobTitle(s.kind, s.action), what = `${s.kind} ${s.action}`;
  // Which books were left alone isn't kept with the job: Apply again from the review, where they're chosen.
  if (what === 'books apply') return { label: 'Open the review', run: () => pick('books') };
  // Which run to put back isn't kept either: its Undo is still in Recently done.
  if (what === 'trash restore') return { say: "Press Undo beside it in Recently done again: what's back stays back." };
  // A step that asks first asks again, then carries on with that OK.
  const asks: Record<string, string> = {
    'music finalize': 'Navidrome is paused again while the swap finishes.',
    'music undo': 'Navidrome is paused again while the old library goes back.',
    'music free-space': `What is left of the old library goes to ${d.trash}.`,
    'books undo': "Calibre-Web is paused again while Calibre's database is put back.",
    'movies dedupe': `The extra copies left go to ${d.trash}, each checked again first.`,
    'tv dedupe': `The extra copies left go to ${d.trash}, each checked again first.`,
  };
  if (asks[what]) {
    return { label: 'Carry on…', run: () => act.ask({ title: `Carry on: ${title.charAt(0).toLowerCase() + title.slice(1)}?`, action: 'Carry on', lead: `It stopped part-way. It picks up where it left off. ${asks[what]}`, go: () => act.run(s.kind, s.action, [], true) }) };
  }
  return { label: 'Carry on', run: () => act.run(s.kind, s.action) };
}

/** A films', TV's, or audiobooks' job stopped for want of ffmpeg, where the app can fetch it: Install, then the job again. */
function installFix(job: TidyJob, d: app.TidyUp | null | undefined, act: TidyActions) {
  const ff = d?.checks.find((c) => c.id === 'ffmpeg' && !c.ok && c.install);
  if (!job.ended || job.ended.ok || !ff || !['movies', 'tv', 'audiobooks'].includes(job.kind)) return undefined;
  return { label: 'Install ffmpeg', run: () => act.install({ kind: job.kind, action: job.action }) };
}

/** The question before a step that changes something, in a sheet. */
export function ConfirmSheet({ c, close }: { c: TidyConfirm | null; close: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => setSure(false), [c]);
  return (
    <Sheet id="tidySheet" titleId="tidySheetTitle" onClose={close}>
      <h2 id="tidySheetTitle">{c?.title}</h2>
      <p class="lead">{c?.lead}</p>
      {!!c?.steps?.length && <ol class="tidyplan">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
      {!!c?.keep?.length && <><p><strong>Kept either way:</strong></p><ul class="tidykeep">{c.keep.map((s) => <li key={s}>{s}</li>)}</ul></>}
      <div class="actions">
        <button class="small" onClick={close}>Cancel</button>
        <button class={'primary small' + (sure ? ' confirm' : '')} onClick={() => {
          if (c?.twice && !sure) { setSure(true); return; }
          close();
          c?.go();
        }}>{c?.twice && sure ? `Click again: ${c.action.toLowerCase()}` : c?.action}</button>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------ a book in the review

const fieldNames: Record<string, string> = { title: 'Title', series: 'Series', series_index: 'Number', publisher: 'Publisher', tags: 'Genre' };

function BookRow({ b, on, toggle, cover }: { b: app.TidyBook; on: boolean; toggle: () => void; cover: TidyActions['cover'] }) {
  const [art, setArt] = useState<[string, string] | null>(null);
  useEffect(() => { if (b.cover) Promise.all([cover(b.id, 'current'), cover(b.id, 'new')]).then((c) => setArt([c[0], c[1]])).catch(() => {}); }, [b.id]);
  return (
    <Row dot={b.held ? 'warn' : on ? 'ok' : ''} title={b.title}
      sub={b.held ? 'Looks misfiled, so it is left alone' : b.changes.map((c) => `${fieldNames[c.field] || c.field}: ${c.old || '—'} → ${c.new}`).join(' · ') || 'A sharper cover'}
      end={<>
        {art && <span class="tidycovers">{art[0] ? <img src={art[0]} alt="Cover now" /> : <span class="nocover">No cover</span>}<span aria-hidden="true">→</span>{art[1] ? <img src={art[1]} alt="New cover" /> : <span class="nocover">No cover</span>}</span>}
        {!b.held && <label class="switch"><input type="checkbox" checked={on} onChange={toggle} /><span class="sr">Change {b.title}</span><span aria-hidden="true">{on ? 'Change' : 'Leave'}</span></label>}
      </>} />
  );
}

// ------------------------------------------------------------ the libraries, as things to do

/** Each library's colour (the chart's own hues) and icon, as Finances gives each bank its mark. */
const looks: Record<string, { hue: Hue; icon: string }> = {
  music: { hue: 8, icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  movies: { hue: 7, icon: 'M2 2h20v20H2zM7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5' },
  tv: { hue: 1, icon: 'M2 7h20v15H2zM17 2l-5 5-5-5' },
  books: { hue: 2, icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
  audiobooks: { hue: 6, icon: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z' },
  inbox: { hue: 3, icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
  machine: { hue: 'muted', icon: 'M2 4h20v12H2zM8 20h8M12 16v4' },
  folder: { hue: 5, icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  lyrics: { hue: 5, icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
};
const LIBRARIES = ['music', 'movies', 'tv', 'books', 'audiobooks'] as const;

/** A library's mark: its icon on its colour. */
function LibIcon({ kind }: { kind: string }) {
  const k = looks[kind] || looks.machine;
  return <span class={'fmark logo tidyicon ' + hue(k.hue)} aria-hidden="true"><svg viewBox="0 0 24 24"><path d={k.icon} /></svg></span>;
}

/** One thing a library could do now: what, why, what it wins back, and its one button. */
interface Todo {
  kind: string;
  title: string;
  sub: string;
  /** Bytes it wins back, when known. */
  gain?: number;
  /** risky: it throws things away (to the Trash), so it is never the screen's one main button. */
  go?: { label: string; run: () => void; quiet?: boolean; risky?: boolean };
  /** Something wrong (a drive away, a tool missing): said, in amber. */
  warn?: boolean;
}

const unit: Record<string, [string, string]> = { movies: ['film', 'films'], tv: ['episode', 'episodes'], books: ['book', 'books'], audiobooks: ['audiobook', 'audiobooks'], music: ['song', 'songs'] };
const things = (kind: string, v: number) => count(v, unit[kind][0], unit[kind][1]);
const lead = (s: string) => s[0].toUpperCase() + s.slice(1);

/** What each library could do now, from where it stands. The order is the order to do them in. */
export function todosFor(l: app.TidyLibrary, d: app.TidyUp, act: TidyActions, review: app.TidyBook[] | null, pick: (t: TidyTab) => void): Todo[] {
  if (!l.found) return [];
  const k = l.kind, out: Todo[] = [];
  const scan = last(l, 'scan')?.result;
  if (k === 'music') {
    const run = last(l, 'run')?.result, files = n(scan?.files), songs = n(run?.in_library);
    const swap = () => act.ask({
      title: 'Swap in your tidy library?', action: 'Swap in',
      lead: `${songs ? count(songs, 'song') + ' are ready. ' : ''}It takes about a minute, and you can undo it until you free the space.`,
      steps: ['Pause the apps that use your music (Navidrome, beets, Lidarr)', 'Back up Navidrome: plays, favourites, and playlists', "Clear Navidrome's artwork cache, so covers don't show as blank records", 'Swap the folders: your old library is kept as a hidden backup', 'Start everything again: Navidrome rescans on its own'],
      go: () => act.run('music', 'finalize', [], true),
    });
    const free = () => act.ask({
      title: 'Free the space?', action: 'Free the space', twice: true,
      lead: `Every song is checked first. Then the old library and the duplicates set aside go to ${d.trash}; after that, the swap can't be undone from here.`,
      keep: ['Your new library and everything Navidrome shows', 'The Navidrome backup from the swap', "Songs that weren't imported or couldn't be read, in the reports folder"],
      go: () => act.run('music', 'free-space'),
    });
    const step: Record<string, Todo> = {
      new: { kind: k, title: 'Look at your music first', sub: 'A scan reads every song and changes nothing', go: { label: 'Scan', run: () => act.run('music', 'scan') } },
      scanned: { kind: k, title: `Build a tidy copy of ${files ? count(files, 'song') : 'your music'}`, sub: 'Your originals stay as they are, and Navidrome keeps playing', go: { label: 'Build', run: () => act.run('music', 'run') } },
      built: { kind: k, title: 'Swap in your tidy library', sub: `${songs ? count(songs, 'song') + ' ready · ' : ''}Navidrome is paused and backed up first`, go: { label: 'Swap in…', run: swap } },
      swapped: { kind: k, title: 'Check nothing went missing', sub: 'Every song in the old library is looked for in the new one', go: { label: 'Check', run: () => act.run('music', 'verify') } },
      verified: { kind: k, title: 'Free the old music library', sub: `Every song made it${n(run?.set_aside) ? ' · ' + count(n(run?.set_aside), 'copy', 'copies') + ' set aside go with it' : ''}`, go: { label: 'Free it…', run: free, risky: true } },
    };
    // A check that found songs missing: said, with what's short, and both ways on (the old library is still kept).
    const ver = last(l, 'verify');
    if (l.stage === 'swapped' && ver && !ver.ok && n(ver.result?.missing) > 0) {
      const short = ((ver.result?.artists_with_fewer || []) as { artist: string; fewer: number; folder_missing?: boolean }[]);
      const who = short.slice(0, 3).map((a) => a.folder_missing ? `${a.artist} (all of it)` : `${a.artist} (${a.fewer} fewer)`).join(', ') + (short.length > 3 ? `, and ${short.length - 3} more` : '');
      out.push({ kind: k, title: `${count(n(ver.result!.missing), 'song')} didn't make it into the new library`, warn: true,
        sub: `${who ? who + ' · ' : ''}Your old library is still kept, so nothing is lost: put it back, or check again once they're in`,
        go: { label: 'Put the old library back…', quiet: true, run: () => act.ask({ title: 'Put the old library back?', action: 'Put it back', lead: 'Navidrome is paused while the folders swap back, exactly as they were.', go: () => act.run('music', 'undo', [], true) }) } });
      out.push({ kind: k, title: 'Check again', sub: 'Every song in the old library is looked for in the new one', go: { label: 'Check', run: () => act.run('music', 'verify'), quiet: true } });
    } else if (step[l.stage]) out.push(step[l.stage]);
    const lyr = last(l, 'lyrics')?.result;
    // Only songs not yet asked about: those LRCLIB had nothing for wait a month before they're asked again. Songs whose
    // lyrics carry a translation after a caret on each line (two languages on one line) are set apart by the same job.
    const none = n(lyr?.none), apart = n(lyr?.to_clean);
    const notOn = n(lyr?.not_found) ? ` · ${count(n(lyr!.not_found), 'song')} not on LRCLIB yet` : '';
    // Setting lyrics right is done on this computer (--tidy): it never waits for LRCLIB, which thousands of songs would.
    if (lyr && apart > 0) out.push({ kind: 'lyrics', title: `${count(apart, 'song')} show two languages on one line`, sub: 'Each translation goes on a line of its own under its original, so both scroll along in Navidrome. Done on this computer, in minutes', go: { label: 'Tidy lyrics', run: () => act.run('music', 'lyrics', ['--tidy']) } });
    if (lyr && none > 0) out.push({ kind: 'lyrics', title: `${count(none, 'song')} could get lyrics`, sub: `Synced from LRCLIB where it has them, so they scroll along in Navidrome${notOn}`, go: { label: 'Add lyrics', run: () => act.run('music', 'lyrics') } });
    // A check from before Tidy Up counted those: one more, which changes nothing, finds them.
    // Never checked: say so on Overview too (it was on the Music tab only, so lyrics seemed to have no option at all).
    if (!lyr) out.push({ kind: 'lyrics', title: 'See how many songs have lyrics', sub: 'Reads every song; changes nothing. Then Tidy Up offers to tidy them or add the missing ones', go: { label: 'Check lyrics', run: () => act.run('music', 'lyrics', ['--check']), quiet: true } });
    if (lyr && lyr.to_clean === undefined && none === 0) out.push({ kind: 'lyrics', title: 'Look over the lyrics again', sub: 'Finds songs that show two languages on one line; changes nothing', go: { label: 'Check lyrics', run: () => act.run('music', 'lyrics', ['--check']), quiet: true } });
  } else if (k === 'movies' || k === 'tv') {
    const c = l.counts || {}, bloated = n(c.bloated), withTdarr = n(c.queued) + n(l.waiting);
    const reasons = Object.keys((scan?.reasons || {}) as Record<string, number>).slice(0, 2).map((r) => r.replace(/\b([Hh])\.?26([45])\b/g, 'H.26$2')).join(', ');
    if (!scan) out.push({ kind: k, title: `Look at your ${k === 'tv' ? 'TV' : 'films'} first`, sub: 'A scan finds what wastes space and changes nothing', go: { label: 'Scan', run: () => act.run(k, 'scan') } });
    else if (bloated && !d.tdarr?.[k]) out.push({ kind: k, title: `Set up Tdarr to shrink ${things(k, bloated)}`, sub: "Tidy Up makes Tdarr's library with the space-saving settings", gain: n(scan.saving), go: { label: 'Set up Tdarr', run: () => act.run('tdarr', 'setup', ['--apply']) } });
    else if (bloated) out.push({ kind: k, title: `Shrink ${things(k, bloated)}`, sub: `They look the same after${reasons ? ' · ' + lead(reasons) : ''}`, gain: n(scan.saving), go: { label: 'Shrink', run: () => act.run(k, 'run') } });
    // The same film or episode twice, as the last scan found (until the extras are removed).
    const dupes = n(scan?.duplicates), dd = last(l, 'dedupe'), scanned = last(l, 'scan');
    if (dupes && !(dd?.ok && scanned && dd.at > scanned.at)) {
      const list = ((scan?.duplicate_list || []) as { keep: string; extra: string[] }[]);
      const extras = list.reduce((t, x) => t + x.extra.length, 0) || dupes;
      const file = (p: string) => p.split(/[\\/]/).pop() || p;
      out.push({ kind: k, title: `${lead(things(k, dupes))} ${dupes === 1 ? 'is' : 'are'} in the library twice`, sub: 'The copy with the best picture stays; the extra ones go', gain: n(scan?.duplicate_bytes),
        go: { label: 'Remove extras…', risky: true, run: () => act.ask({
          title: 'Put the extra copies in the Trash?', action: 'Put them in the Trash',
          lead: `${count(extras, 'copy', 'copies')}, each checked again first: one changed since the scan, or of another length, stays. They go to ${d.trash}, never straight away.`,
          steps: [...list.slice(0, 4).map((x) => `${x.extra.map(file).join(' and ')} ${x.extra.length === 1 ? 'goes' : 'go'}; ${file(x.keep)} stays`), ...(list.length > 4 ? [`And ${things(k, list.length - 4)} more`] : [])],
          go: () => act.run(k, 'dedupe', [], true),
        }) } });
    }
    // What Jellyfin shows with no poster (the scan asks it), until it's been asked to look again.
    const bare = n(scan?.posterless), asked = last(l, 'posters');
    if (bare && !(asked?.ok && scanned && asked.at > scanned.at)) {
      const names = ((scan?.posterless_list || []) as string[]);
      out.push({ kind: k, title: `${count(bare, k === 'tv' ? 'show' : 'film')} ${bare === 1 ? 'has' : 'have'} no poster in Jellyfin`, sub: names.slice(0, 3).join(', ') + (bare > 3 ? `, and ${bare - 3} more` : ''),
        go: { label: 'Fetch posters', quiet: true, run: () => act.run(k, 'posters') } });
    }
    // The last look at Tdarr's work couldn't reach it (paused on battery, or stopped): said, rather than a row that seems stuck.
    const looked = last(l, 'collect');
    const away = !!looked && !looked.ok && /answering|reach/i.test(looked.why || '');
    if (withTdarr) out.push({ kind: k, title: `Tdarr is shrinking ${things(k, withTdarr)}`, warn: away,
      sub: away ? "Tdarr isn't answering, so nothing is shrinking: it's paused on battery until this computer is plugged in, or stopped (start it from Status)"
        : 'One at a time, on this computer\'s processor: a big library takes days. Each smaller copy is swapped in once it is ready: Tidy Up looks every few minutes, or now with Collect',
      go: { label: 'Collect', run: () => act.run(k, 'collect'), quiet: true } });
  } else if (k === 'books') {
    const rv = last(l, 'review');
    // Before the review's list is read (it is, on the Books tab), its count says how many.
    const changing = review ? review.filter((b) => !b.held).map((b) => b.title) : [];
    const many = review ? changing.length : Math.max(0, n(rv?.result?.changes) - ((rv?.result?.held as unknown[]) || []).length);
    // A folder of books with no Calibre library (no metadata.db): made first, or nothing else here can read them.
    if (l.noCalibre) {
      const many = n(l.loose);
      if (many) out.push({ kind: k, title: `Make a Calibre library from your ${things(k, many)}`, sub: 'Each book with its own title, author, series, and cover, so the review and Calibre-Web can read them',
        go: { label: 'Make it…', run: () => act.ask({ title: `Make a Calibre library from ${things(k, many)}?`, action: 'Make it',
          lead: `Calibre adds each book with the details and cover beside it. Calibre-Web is paused meanwhile. Nothing is deleted: your books' folders move to "${l.folder.split(/[\\/]/).pop()} (before Calibre)" beside it, and stay there until you've looked.`,
          steps: ['Their folders move aside, on the same drive', 'Calibre adds each one as a book, its formats together', 'Every book is counted in before it says done'],
          go: () => act.run('books', 'build', [], true) }) } });
      else out.push({ kind: k, title: 'Not a Calibre library yet', sub: 'No books in folders of their own were found here: put each book in a folder of its own, or point Books at your Calibre library in Settings', warn: true });
      return out;
    }
    if (!rv) out.push({ kind: k, title: 'Look over your books', sub: 'Titles, series, publishers, genres, and covers: nothing changes until you say', go: { label: 'Review', run: () => act.review() } });
    else if (many && !reviewApplied(l)) out.push({ kind: k, title: `${things(k, many)} could look tidier`, sub: changing.length ? changing.slice(0, 2).join(', ') + (changing.length > 2 ? `, and ${changing.length - 2} more` : '') : 'Titles, series, and covers, from the last review', go: { label: 'Look…', run: () => act.review() } });
  } else if (k === 'audiobooks') {
    if (!scan) out.push({ kind: k, title: 'Look at your audiobooks first', sub: 'A scan finds books split into many files and changes nothing', go: { label: 'Scan', run: () => act.run('audiobooks', 'scan') } });
    else if (n(scan.books)) out.push({ kind: k, title: `Merge ${things(k, n(scan.books))}`, sub: `${count(n(scan.files), 'file')} into one .m4b each, with chapters and one cover`, go: { label: 'Merge', run: () => act.run('audiobooks', 'run') } });
    // Nothing split: said with how many are whole, rather than a bare nought.
    else if (n(scan.whole)) out.push({ kind: k, title: `All ${things(k, n(scan.whole))} are one file each`, sub: 'Nothing to merge. One that comes in split into many files shows up here after the next scan' });
  }
  return out;
}

/** The list: each thing's mark, words, what it wins back, and its button (off while a job runs). */
function TodoRows({ todos, job }: { todos: Todo[]; job: TidyJob | null }) {
  // One main button, on the first thing to do (the list is in the order to do them), never on one that throws things
  // away; the rest are there, quieter.
  const first = todos.findIndex((t) => t.go && !t.go.quiet && !t.go.risky);
  // Next up: that thing leads the list, drawn larger (style.css, the row with the main button), after only what has to
  // be put right before anything runs (a drive away, a tool missing). Before, a step that throws things away could
  // sit above it, and the main button hid in the middle of the list.
  let warned = 0;
  while (warned < todos.length && todos[warned].warn) warned++;
  const order = first > warned ? [...todos.slice(0, warned), todos[first], ...todos.slice(warned, first), ...todos.slice(first + 1)] : todos;
  const main = first >= 0 ? todos[first] : undefined;
  return (
    <Rows kind="fx-rows tidytodo">
      {order.map((t, i) => (
        <Row key={t.kind + t.title + i} lead={<LibIcon kind={t.kind} />} title={t.title} sub={t.sub} subTone={t.warn ? 'warn' : undefined}
          end={<>{!!t.gain && <><span class="fx-amount fx-in tidygain">{size(t.gain)}</span><span class="sr"> to win back</span></>}{t.go && <Go label={t.go.label} primary={t === main} job={job} onClick={t.go.run} />}</>} />
      ))}
    </Rows>
  );
}

// ------------------------------------------------------------ genres, space, the drive, what was done

/** The libraries with genres, and what each counts: songs, films, shows, books. */
const GENRED = ['music', 'movies', 'tv', 'books'] as const;
const genreUnit: Record<string, string> = { music: 'songs', movies: 'films', tv: 'shows', books: 'books' };
const genreAsk: Record<string, string> = {
  music: "See how your music splits across your 14 genres. Counting reads every song's tags and changes nothing.",
  movies: 'See how your films split by genre, from Jellyfin or the .nfo files beside them. Counting changes nothing.',
  tv: "See how your shows split by genre, from Jellyfin or each show's .nfo. Counting changes nothing.",
  books: "See how your books split by genre: each book's first tag in Calibre. Counting only reads Calibre's database.",
};

/** What each library's genre chart reads: its last genre count. */
function genresOf(d: app.TidyUp): Record<string, { total: number; genres: [string, number][]; source: string }> {
  const out: Record<string, { total: number; genres: [string, number][]; source: string }> = {};
  for (const k of GENRED) {
    const r = last(lib(d, k), 'genre-counts')?.result;
    const g = Object.entries((r?.genres || {}) as Record<string, number>).sort((a, b) => b[1] - a[1]);
    if (g.length) out[k] = { total: g.reduce((t, [, v]) => t + v, 0), genres: g, source: String(r?.source || '') };
  }
  return out;
}

const hues: Hue[] = [7, 1, 8, 2, 3, 5, 6, 4];

/** One genre chart; a dropdown picks the library when more than one has genres. */
function GenresWidget({ d, job, act, only }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions; only?: string }) {
  const all = genresOf(d);
  const kinds = only ? [only] : GENRED.filter((k) => all[k]) as string[];
  const [picked, setPicked] = useState(kinds[0] || 'music');
  const k = kinds.includes(picked) ? picked : kinds[0] || 'music';
  const g = all[k];
  const top = g ? g.genres.slice(0, 6) : [];
  const rest = g ? g.genres.slice(6).reduce((t, [, v]) => t + v, 0) : 0;
  const slices = [...top.map(([label, value], i) => ({ label, value, color: hues[i] })), ...(rest ? [{ label: `${g!.genres.length - 6} more`, value: rest, color: 'muted' as Hue }] : [])];
  const picker = kinds.length > 1 && (
    <select class="tidypick" aria-label="Genres of" value={k} onChange={(e) => setPicked((e.target as HTMLSelectElement).value)}>
      {kinds.map((x) => <option key={x} value={x}>{names[x]}</option>)}
    </select>
  );
  if (!g) {
    // None counted yet: on Overview, music's (or the first library there's to count); on a tab, its own.
    const ask = only || GENRED.find((x) => lib(d, x)?.found);
    if (!ask || !genreAsk[ask] || !lib(d, ask)?.found) return null;
    // Counted, and nothing had a genre: what was counted and why, not the first ask again.
    const tried = last(lib(d, ask), 'genre-counts')?.result;
    const none = tried && n(tried.items) > 0 ? `Counted ${count(n(tried.items), genreUnit[ask].replace(/s$/, ''), genreUnit[ask])}: none has a genre yet.${tried.why ? ' ' + String(tried.why).charAt(0).toUpperCase() + String(tried.why).slice(1) + '.' : ''}` : '';
    return (
      <Widget title="Genres" kind="fx-spend tidygenres">
        <Empty>{none || genreAsk[ask]}</Empty>
        <div class="actions">
          {none && /API key isn't set/.test(String(tried.why)) && <button class="small primary" onClick={() => act.settings(['JELLYFIN_API_KEY'])}>Add Jellyfin’s API key</button>}
          <Go label={none ? 'Count again' : 'Count genres'} job={job} onClick={() => act.run(ask, 'genre-counts')} />
        </div>
      </Widget>
    );
  }
  return (
    <Widget title="Genres" kind="fx-spend tidygenres" actions={picker || undefined}>
      <Stat value={<span class="fx-amount">{g.total.toLocaleString()}<small> {genreUnit[k]}</small></span>} caption={k === 'music' ? 'In your 14 genres' : g.source ? `One genre each, from ${g.source === 'Calibre' ? "Calibre's tags" : g.source}` : 'One genre each'} />
      <div class="fx-donutrow">
        <Donut slices={slices} label={`${names[k]} by genre`} center={<><strong>{g.total.toLocaleString()}</strong>{genreUnit[k]}</>} />
        <Legend items={slices.map((s) => ({ label: s.label, color: s.color, value: `${Math.round((s.value / g.total) * 100)}%` }))} />
      </div>
    </Widget>
  );
}

/** The media drive: how much each library takes, and what is free. */
function DriveWidget({ d }: { d: app.TidyUp }) {
  const dr = d.drive;
  if (!dr) return null;
  const parts = d.libraries.filter((l) => l.size).map((l) => ({ label: names[l.kind], value: l.size || 0, color: looks[l.kind].hue }));
  const measuring = d.libraries.some((l) => l.found && !l.size);
  const slices = [...parts, { label: 'Free', value: dr.free, color: 'track' as Hue }];
  return (
    <Widget title={dr.name ? `On the ${dr.name} drive` : 'On this machine'} kind="fx-flow tidydrive">
      <Stat value={<span class="fx-amount">{size(dr.free)}<small> free</small></span>} caption={`Of ${size(dr.total)}${d.freed ? ' · ' + size(d.freed) + ' won back so far' : ''}`} />
      <div class="fx-donutrow">
        <Donut slices={slices} size={124} label="The drive" center={<><strong>{dr.total ? Math.round((dr.free / dr.total) * 100) : 0}%</strong>free</>} />
        <Legend items={slices.map((p) => ({ label: p.label, color: p.color, value: size(p.value) }))} />
      </div>
      {measuring && <p class="fx-sub">Measuring the rest: it takes a few minutes on a big drive.</p>}
    </Widget>
  );
}

/** A film or TV library: what is lean, what could shrink, and what Tdarr has now. */
function SpaceWidget({ l, d }: { l: app.TidyLibrary; d: app.TidyUp }) {
  const c = l.counts || {};
  const parts = [{ label: 'Lean', value: n(c.lean), color: 'in' as Hue }, { label: 'Could shrink', value: n(c.bloated), color: 'out' as Hue }, { label: 'With Tdarr', value: n(c.queued) + n(l.waiting), color: 'save' as Hue }];
  const total = parts.reduce((t, p) => t + p.value, 0);
  return (
    <Widget title="Space" kind="fx-flow tidyspace">
      <Stat value={<span class="fx-amount">{l.size ? size(l.size) : total ? things(l.kind, total) : '—'}</span>} caption={l.size && total ? things(l.kind, total) : l.freed ? size(l.freed) + ' won back' : 'Measured after a scan'} />
      {total > 0 && <><SplitBar parts={parts} label={names[l.kind]} /><Legend items={parts.map((p) => ({ label: p.label, color: p.color, value: p.value.toLocaleString() }))} /></>}
      {!!l.freed && total > 0 && <p class="fx-sub">{size(l.freed)} won back so far</p>}
      {!!d.tdarr?.[l.kind] && <p class="fx-sub">Tdarr: {(d.settings.TIDY_VIDEO_CODEC || 'hevc').toUpperCase()}, {languages(d.settings.TIDY_KEEP_LANGUAGES || 'eng')} only</p>}
    </Widget>
  );
}

/** What was done lately, newest first; Undo where an undo exists (the music swap, the books' apply). */
function DoneWidget({ d, job, act, kind, span = 'all' }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions; kind?: string; span?: 1 | 'all' }) {
  const items = d.activity.map((a, i) => ({ a, i })).filter(({ a }) => !kind || a.kind === kind || (kind === 'music' && a.kind === 'lyrics')).reverse().slice(0, 6);
  const music = lib(d, 'music'), books = lib(d, 'books');
  const swapIdx = d.activity.map((a) => a.text).lastIndexOf('Cleaned library swapped in');
  const applyIdx = d.activity.map((a) => a.kind + a.text.slice(0, 12)).lastIndexOf('booksBooks tidied');
  const undo = (i: number) => {
    if (i === swapIdx && (music.stage === 'swapped' || music.stage === 'verified')) {
      return () => act.ask({ title: 'Put the old library back?', action: 'Put it back', lead: 'Navidrome is paused while the folders swap back, exactly as they were.', go: () => act.run('music', 'undo', [], true) });
    }
    // Anything else that put things in the Trash: put them back.
    if (d.activity[i].undo) {
      const run = d.activity[i].undo!;
      return () => act.ask({ title: 'Put it all back?', action: 'Put it back', lead: `What this put in ${d.trash} goes back where it was. Anything since moved, replaced, or emptied from ${d.trash} stays as it is.`, go: () => act.run('trash', 'restore', [run], true) });
    }
    const ap = last(books, 'apply'), un = last(books, 'undo');
    if (i === applyIdx && ap?.ok && (!un || un.at < ap.at)) {
      return () => act.ask({ title: 'Undo the last apply?', action: 'Undo', lead: 'Puts back the titles, series, tags, and covers it changed.', go: () => act.run('books', 'undo', [], true) });
    }
    return null;
  };
  return (
    <Widget title="Recently done" span={span} kind="fx-renewing tidydone">
      {items.length ? (
        <Rows kind="fx-rows tidydone">
          {items.map(({ a, i }) => {
            const u = undo(i);
            return <Row key={i} lead={<LibIcon kind={a.kind === 'inbox' || a.kind === 'scrubber' ? 'inbox' : a.kind} />} title={a.text} sub={a.sub} subTone={worrying(a.text) ? 'warn' : undefined}
              end={<><span class="muted tidywhen">{ago(a.at)}</span>{u && <Go label="Undo" job={job} onClick={u} />}</>} />;
          })}
        </Rows>
      ) : <Empty>Nothing yet. What Tidy Up does shows here, with Undo where it can be undone.</Empty>}
    </Widget>
  );
}

// ------------------------------------------------------------ Overview

/** The tools a library needs (a check's needs): ffmpeg for films and TV, Calibre's for books; Python for every one. */
const toolFor: Record<string, string[]> = { all: [...LIBRARIES], video: ['movies', 'tv'], books: ['books'] };
const TOOLS = new Set(['python', 'ffmpeg', 'calibredb']);

/** A fix without its own "Install Python 3: " at the start, which the row's title already says. */
const dropTitle = (fix: string, name: string) => (fix.toLowerCase().startsWith(`install ${name.toLowerCase()}: `) ? fix.slice(`install ${name}: `.length) : fix);

/** The tools missing, in one row: "Install Python 3 and ffmpeg", each one's fix under it, and Install when the app can
 * fetch one (ffmpeg). only: the libraries they're for (a tool no library here needs yet isn't asked for). */
function toolsRow(d: app.TidyUp, act: TidyActions, only: (needs: string) => boolean): Todo[] {
  const missing = d.checks.filter((c) => !c.ok && TOOLS.has(c.id) && only(c.needs || ''));
  if (!missing.length) return [];
  const short: Record<string, string> = { ffmpeg: 'ffmpeg' }; // "ffmpeg and ffprobe" in a list of three reads badly
  const names = missing.map((c) => short[c.id] || c.name);
  const listed = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  const fetch = missing.find((c) => c.install);
  const calibre = missing.length === 1 && missing[0].id === 'calibredb';
  return [{ kind: 'machine', title: `Install ${listed}`, warn: true,
    // Each one's fix, without its own "Install Python 3:" (the row's title says that).
    sub: missing.map((c) => (missing.length > 1 ? `${short[c.id] || c.name}: ` : '') + dropTitle(c.fix || c.note || '', short[c.id] || c.name)).join(' · '),
    go: fetch ? { label: names.length > 1 ? `Install ${short[fetch.id] || fetch.name}` : 'Install', run: () => act.install() }
      : calibre ? { label: 'Get Calibre', run: () => act.open('https://calibre-ebook.com/download'), quiet: true } : undefined }];
}

/** Overview's list, Needs your OK: the drive when it's away (one row, whatever lives on it), the tools missing (one
 * row), each library's next things, then a library whose own folder is away. The screen's first line counts the same
 * list, so the two always agree. Before, a drive away was a row of its own and one more for each library on it, and
 * each tool a row: nine rows on a new Mac with the drive unplugged. */
function needsFor(d: app.TidyUp, act: TidyActions, review: app.TidyBook[] | null, pick: (t: TidyTab) => void): Todo[] {
  const drive = d.checks.find((c) => c.id === 'drive' && !c.ok);
  const root = drive?.note?.replace(/ isn't there$/, '') || '';
  const away = d.libraries.filter((l) => !l.found);
  const onIt = root ? away.filter((l) => l.folder === root || l.folder.startsWith(root.replace(/[\\/]$/, '') + '/') || l.folder.startsWith(root.replace(/[\\/]$/, '') + '\\')) : [];
  const listed = (ls: app.TidyLibrary[]) => { const w = ls.map((l) => names[l.kind]); return w.length === 1 ? w[0] : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1]; };
  const plug: Todo[] = drive ? [{ kind: 'machine', warn: true, title: `Plug in ${drive.name.replace(/^The /, 'the ')}`,
    sub: `${onIt.length ? `${listed(onIt)} ${onIt.length === 1 ? 'is' : 'are'} on it (${root})` : `${root} isn't there`}. Each shows up here once it's back; or choose the folder your media is in.`,
    go: { label: 'Choose folder…', run: () => act.settings(['MEDIA_ROOT']), quiet: true } }] : [];
  const gone: Todo[] = away.filter((l) => !onIt.includes(l)).map((l) => ({ kind: l.kind, title: `${names[l.kind]}: its drive isn't plugged in`, sub: `${l.folder} could not be found. It shows up here again once it's back.`, warn: true }));
  // A tool only a library that's away needs waits for it: with the drive unplugged, only Python is asked for.
  const here = new Set(d.libraries.filter((l) => l.found).map((l) => l.kind));
  const tools = toolsRow(d, act, (needs) => needs === 'all' || (toolFor[needs] || []).some((k) => here.has(k)));
  // Anything else the machine needs (power for a big job): a row each, as before.
  const machine: Todo[] = d.checks.filter((c) => !c.ok && c.needs && c.id !== 'drive' && !TOOLS.has(c.id)).map((c) => ({ kind: 'machine', title: c.name, sub: `${c.note}. ${c.fix}`, warn: true }));
  return [...plug, ...tools, ...machine, ...LIBRARIES.flatMap((k) => todosFor(lib(d, k), d, act, review, pick)), ...gone];
}

function Overview({ d, job, act, review, pick }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions; review: app.TidyBook[] | null; pick: (t: TidyTab) => void }) {
  const todos = needsFor(d, act, review, pick);
  // What waits on you: the things with a button (a drive away or a tool missing is said, not counted), as the heading counts.
  const waiting = todos.filter((t) => t.go).length;
  const gain = todos.reduce((t, x) => t + (x.gain || 0), 0);
  // Three questions, in order: what to do now (the list, its first thing larger, beside the drive), how each library is
  // doing (the shelf), and what was done (beside the genres).
  return (
    <>
      <div class="fx-board"><InboxWidget d={d} job={job} act={act} /><TodayWidget d={d} job={job} act={act} /></div>
      <div class="fx-board tidytop">
        <Widget title="Needs your OK" kind="fx-paycheck tidyneeds" actions={waiting ? <span class="muted">{count(waiting, 'thing')}{gain ? ' · ' + size(gain) + ' to win back' : ''}</span> : undefined}>
          {todos.length ? <TodoRows todos={todos} job={job} /> : (
            <div class="tidyclear"><span class="fmark logo tidyicon fx-h-in" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>
              <div><strong>Everything's tidy</strong><div class="muted">New downloads are filed as they finish, and anything new to tidy shows up here.</div></div></div>
          )}
        </Widget>
        <DriveWidget d={d} />
      </div>
      <Shelf d={d} act={act} review={review} pick={pick} />
      <div class="fx-board tidybottom">
        <GenresWidget d={d} job={job} act={act} />
        <DoneWidget d={d} job={job} act={act} span={1} />
      </div>
    </>
  );
}

/** When Tidy Up files what's in the watched folders (TIDY_INBOX_WHEN). */
const WHENS: [string, string][] = [['arrive', 'As things arrive'], ['daily', 'Once a day, 3 AM'], ['manual', 'Only when I press it']];

/** A folder's own name, the last part of its path. */
const folderName = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;

/**
 * Drop anything here: the folders Tidy Up watches (Add, and Remove while another is left), when it files what's in them,
 * and Tidy up now. Whatever lands in them, however messy, is worked out, cleaned up, and filed in its library.
 */
function InboxWidget({ d, job, act }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions }) {
  const ib = d.inbox;
  const folders = ib.folders || [];
  const gone = new Set(ib.gone || []);
  const when = ib.when || 'arrive';
  const add = async () => {
    const p = await act.pickFolder();
    if (p && !folders.includes(p)) act.inbox([...folders, p], when);
  };
  const state = (f: string) => gone.has(f) ? "Not there now: plug in its drive" : !ib.watching ? "Not watched: Tidy Up's background work is off in Settings" : when === 'manual' ? 'Tidied when you press Tidy up now' : when === 'daily' ? 'Tidied once a day, after 3 AM' : 'Watched: tidied as things arrive';
  return (
    <Widget title="Drop anything here" span="all" kind="tidyinbox">
      <p class="muted tidyinboxlead">Music, films, shows, books, and audiobooks: put them in one of these folders, however messy, and Tidy Up works out what each is, cleans it up, and files it in your library.</p>
      <Rows kind="fx-rows tidytodo">
        {folders.map((f) => (
          <Row key={f} lead={<LibIcon kind="folder" />} title={folderName(f)} sub={`${f} · ${state(f)}`} subTone={gone.has(f) ? 'warn' : undefined}
            end={folders.length > 1 && <button class="small" aria-label={`Remove ${folderName(f)}`} onClick={() => act.inbox(folders.filter((x) => x !== f), when)}>Remove</button>} />
        ))}
        <Row lead={<LibIcon kind="inbox" />} title="Add a folder…" sub="Another folder, or a folder on a drive, for Tidy Up to watch" end={<button class="small" onClick={add}>Add…</button>} />
      </Rows>
      <div class="tidyinboxwhen">
        <span class="muted">Tidy up</span>
        <Segmented label="When Tidy Up files what's in these folders" value={when} pick={(v) => act.inbox(folders, v)} options={WHENS} />
      </div>
      <div class="tidyinboxgo"><Go primary label="Tidy up now" job={job} onClick={() => act.run('inbox', 'scan', ['--apply'])} /></div>
    </Widget>
  );
}

/** A time of day as the clock reads it: 9:41 AM. */
const clock = (at: string) => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * What I did today: a plain line for each download the inbox filed, newest first: what it is, where it went, and what
 * was done (tags, lyrics, the better copy kept, shrinking first). Undo puts its files back where they came from, and the
 * inbox then leaves them there.
 */
function TodayWidget({ d, job, act }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions }) {
  const today = d.today || [];
  return (
    <Widget title="What I did today" span="all" kind="tidytoday">
      {today.length ? (
        <Rows kind="fx-rows tidytoday">
          {today.map((f) => (
            <Row key={f.id} lead={<LibIcon kind={f.kind} />} title={f.title}
              sub={f.undone ? 'Put back where it came from' : `${f.where} · ${(f.did || []).join(' · ')}`}
              end={<>{f.undo && !f.undone && <Go label="Undo" job={job} title={`Put ${f.title} back where it came from`} onClick={() => act.run('inbox', 'undo', [f.id])} />}<span class="muted tidywhen">{clock(f.at)}</span></>} />
          ))}
        </Rows>
      ) : <Empty>Nothing yet today. Drop something in a watched folder, or press Tidy up now.</Empty>}
    </Widget>
  );
}

/** How far along a library is, where the record can say so: songs with lyrics, videos already lean. Nothing is guessed. */
function meterOf(l: app.TidyLibrary): { share: number; words: string } | undefined {
  if (l.kind === 'music') {
    const ly = last(l, 'lyrics')?.result;
    if (!ly) return undefined;
    const has = n(ly.synced) + n(ly.plain), all = has + n(ly.none) + n(ly.not_found);
    return all ? { share: has / all, words: 'with lyrics' } : undefined;
  }
  if (l.kind === 'movies' || l.kind === 'tv') {
    const c = l.counts || {}, lean = n(c.lean), all = lean + n(c.bloated) + n(c.queued) + n(l.waiting);
    return all ? { share: lean / all, words: 'already lean' } : undefined;
  }
  return undefined;
}

/** What a library holds, in a few words: "13,929 songs · 520 GB". */
function factsOf(l: app.TidyLibrary): string {
  const c = l.counts || {};
  const many = l.kind === 'music' ? n(last(l, 'run')?.result?.in_library) || n(last(l, 'scan')?.result?.files)
    : l.kind === 'movies' || l.kind === 'tv' ? n(c.lean) + n(c.bloated) + n(c.queued) + n(l.waiting)
    : l.kind === 'books' ? n(last(l, 'review')?.result?.books) : 0;
  return [many ? things(l.kind, many) : '', l.size ? size(l.size) : ''].filter(Boolean).join(' · ');
}

/** The libraries side by side, each in its colour: what it holds, how far along it is, and what it waits on. A tile
 * opens its tab. It sits outside the boards: it starts no job, so it never waits on one. */
function Shelf({ d, act, review, pick }: { d: app.TidyUp; act: TidyActions; review: app.TidyBook[] | null; pick: (t: TidyTab) => void }) {
  return (
    <section class="tidyshelf" aria-labelledby="tidyShelfTitle">
      <h2 id="tidyShelfTitle">Your libraries</h2>
      <ul>
        {LIBRARIES.map((k) => {
          const l = lib(d, k);
          if (!l) return null;
          const todos = l.found ? todosFor(l, d, act, review, pick) : [];
          const next = todos.find((t) => t.go && !t.go.risky) || todos[0];
          const m = l.found ? meterOf(l) : undefined;
          const facts = l.found ? factsOf(l) : '';
          const pct = m ? Math.round(m.share * 100) : 0;
          return (
            <li key={k}>
              <button type="button" class={'tidytile ' + hue(looks[k].hue) + (l.found ? '' : ' away')} onClick={() => pick(k)}>
                <LibIcon kind={k} />
                <span class="tidytilename">{names[k]}</span>
                <span class="tidytilefacts">{l.found ? facts || 'Not looked at yet' : "Its drive isn't plugged in"}</span>
                {m && <span class="tidymeter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>}
                <span class="tidytilenext">{m && <strong>{pct}% {m.words}</strong>}{m && next && <br />}{l.found ? next ? next.title : 'Nothing to tidy' : 'Shows up again once it is back'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Music's clean-up, as the steps it goes through: each one done (and when), the next, and those after. */
const MUSIC_STEPS: [string, string, string][] = [['scanned', 'scan', 'Scanned'], ['built', 'run', 'Tidy copy built'], ['swapped', 'finalize', 'Swapped in'], ['verified', 'verify', 'Every song checked'], ['freed', 'free-space', 'Old library freed']];
const STAGES = ['new', 'scanned', 'built', 'swapped', 'verified', 'freed'];
function MusicSteps({ l }: { l: app.TidyLibrary }) {
  const at = Math.max(0, STAGES.indexOf(l.stage));
  return (
    <ol class="tidysteps tidytrack" aria-label="The clean-up, step by step">
      {MUSIC_STEPS.map(([, action, label], i) => {
        const done = at > i, now = at === i, r = last(l, action);
        return (
          <li key={label} class={done ? 'done' : now ? 'now' : ''}>
            <span class="num" aria-hidden="true">{done ? <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg> : i + 1}</span>
            <span class="grow"><strong>{label}</strong><span class="muted">{done ? (r ? ago(r.at) : 'Done') : now ? 'Next' : 'Later'}</span></span>
          </li>
        );
      })}
    </ol>
  );
}

/** A library's tab opens on it: its mark and colour, where it is, what it holds, and (music) how far its clean-up is. */
function LibHero({ l }: { l: app.TidyLibrary }) {
  const c = l.counts || {};
  const many = l.kind === 'music' ? n(last(l, 'run')?.result?.in_library) || n(last(l, 'scan')?.result?.files)
    : l.kind === 'movies' || l.kind === 'tv' ? n(c.lean) + n(c.bloated) + n(c.queued) + n(l.waiting)
    : l.kind === 'books' ? n(last(l, 'review')?.result?.books) || n(l.loose) : 0;
  const m = meterOf(l);
  const facts: [string, string][] = [
    ...(many ? [[lead(unit[l.kind][1]), many.toLocaleString()] as [string, string]] : []),
    ...(l.size ? [['On the drive', size(l.size)] as [string, string]] : []),
    ...(m ? [[lead(m.words), `${Math.round(m.share * 100)}%`] as [string, string]] : []),
    ...(l.freed ? [['Won back', size(l.freed)] as [string, string]] : []),
  ];
  return (
    <Widget title={<><LibIcon kind={l.kind} />{names[l.kind]}</>} span="all" kind={'tidyhero ' + hue(looks[l.kind].hue)}>
      <div class="tidyherorow">
        <span class="muted tidyfolder">{l.folder}</span>
        {!!facts.length && <dl class="tidyfacts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      </div>
      {l.kind === 'music' && <MusicSteps l={l} />}
    </Widget>
  );
}

// ------------------------------------------------------------ a library's own tab

function LibraryTab({ kind, d, job, act, review, reviewError, reloadReview, skip, toggle, pick }: { kind: string; d: app.TidyUp; job: TidyJob | null; act: TidyActions; review: app.TidyBook[] | null; reviewError?: string; reloadReview?: () => void; skip: Set<number>; toggle: (id: number) => void; pick: (t: TidyTab) => void }) {
  const l = lib(d, kind);
  const todos = todosFor(l, d, act, review, pick);
  const scanned = !!last(l, 'scan') || !!last(l, 'review');
  const again = kind === 'books' ? (last(l, 'review') && <Go label="Review again" job={job} onClick={() => act.run('books', 'review')} />)
    : kind !== 'music' && scanned ? <Go label="Scan again" job={job} onClick={() => act.run(kind, 'scan')} /> : null;
  const extra: Todo[] = [];
  if (kind === 'music' && l.found) {
    const genres = last(l, 'genres');
    if (!genres || n(genres.result?.to_fix) > 0) extra.push({ kind: 'music', title: n(genres?.result?.to_fix) ? `${count(n(genres!.result!.to_fix), 'song')} outside your 14 genres` : 'Fold every song into one of your 14 genres', sub: 'Looks first; you see the list before anything changes', go: { label: 'Check genres', run: () => act.run('music', 'genres'), quiet: true } });
    if ((l.stage === 'swapped' || l.stage === 'verified' || l.stage === 'freed') && !last(l, 'navidrome-cleanup')?.ok) extra.push({ kind: 'music', title: 'Tidy Navidrome after the swap', sub: 'A full scan, and the old paths it still lists removed', go: { label: 'Tidy Navidrome', run: () => act.run('music', 'navidrome-cleanup'), quiet: true } });
    if (!last(l, 'playlists')?.ok) extra.push({ kind: 'music', title: 'A smart playlist for each of your genres', sub: 'Navidrome fills them by itself as music is added', go: { label: 'Make playlists', run: () => act.run('music', 'playlists'), quiet: true } });
    // Lyrics always have a row here once checked: what the last check found, and Check again. Before, a check that found
    // nothing to tidy or add left no lyrics option anywhere.
    const lr = last(l, 'lyrics'), ly = lr?.result;
    if (lr && ly) {
      const parts = [['synced', 'time-synced'], ['plain', 'plain'], ['none', 'without lyrics'], ['not_found', 'not on LRCLIB yet']]
        .filter(([key]) => n(ly[key]) > 0).map(([key, words]) => `${count(n(ly[key]), 'song')} ${words}`);
      const found = n(ly.to_clean) ? `${count(n(ly.to_clean), 'song')} with two languages on one line` : 'none with two languages on one line';
      extra.push({ kind: 'lyrics', title: 'Lyrics', sub: `${parts.join(' · ') || 'No songs read yet'} · ${found} · checked ${ago(lr.at)}`,
        go: { label: 'Check again', run: () => act.run('music', 'lyrics', ['--check']), quiet: true } });
    }
  }
  // Episodes missing from a season (a gap in its numbering, as the scan read it): said, with nothing to press.
  const gaps = kind === 'tv' && l.found ? n(last(l, 'scan')?.result?.missing) : 0;
  if (gaps) {
    const list = (last(l, 'scan')?.result?.missing_list || []) as { show: string; season: number | null; episodes: number[] }[];
    const where = list.slice(0, 3).map((g) => `${g.show}${g.season ? ' season ' + g.season : ''}: ${g.episodes.slice(0, 6).join(', ')}${g.episodes.length > 6 ? '…' : ''}`).join(' · ');
    extra.push({ kind: 'tv', title: `${count(gaps, 'episode')} ${gaps === 1 ? 'is' : 'are'} missing from ${count(new Set(list.map((g) => g.show)).size, 'show')}`, sub: where + (list.length > 3 ? ` · and ${count(list.length - 3, 'season')} more` : '') });
  }
  // Until the download apps are handed over (that leaves a line in what was done), it's offered here.
  if ((kind === 'movies' || kind === 'tv') && l.found && !d.activity.some((a) => a.kind === 'arr')) {
    extra.push({ kind: 'inbox', title: kind === 'tv' ? 'Let Tidy Up file what Sonarr downloads' : 'Let Tidy Up file what Radarr downloads', sub: 'They keep finding and downloading; Tidy Up renames and files, so the two never trip over each other', go: { label: 'Hand over…', quiet: true, run: () => act.ask({ title: 'Let Tidy Up file the downloads?', action: 'Hand over', lead: "Sonarr, Radarr, and Lidarr keep finding and downloading; they stop renaming files and stop moving finished downloads into the libraries. Tidy Up files them instead, so the two never rename each other's files.", go: () => act.run('arr', 'apply') }) } });
  }
  // The tools this library needs and hasn't got (Calibre's for books, ffmpeg for films and TV), as one row.
  const tools = l.found ? toolsRow(d, act, (needs) => needs === 'all' || (toolFor[needs] || []).includes(kind)) : [];
  const rows = [...tools, ...todos, ...extra];
  const changing = (review || []).filter((b) => !b.held && !skip.has(b.id));
  const apply = () => act.ask({
    title: `Apply the changes to ${count(changing.length, 'book')}?`, action: 'Apply',
    lead: `Calibre-Web is paused while Calibre's database is written, and started again after. ${skip.size ? count(skip.size, 'book') + ' you left alone stay as they are. ' : ''}Undo puts back what this changes.`,
    go: () => act.run('books', 'apply', skip.size ? ['--skip', [...skip].join(',')] : [], true),
  });
  return (
    <FolderGone.Provider value={!l.found}>
      <Gone l={l} />
      <div class="fx-board">
        {l.found && <LibHero l={l} />}
        <Widget title="Can be tidier" span="all" kind="fx-paycheck tidyneeds" actions={again || undefined}>
          {rows.length ? <TodoRows todos={rows} job={job} /> : <Empty>{l.found ? `Your ${names[kind].toLowerCase()} ${kind === 'music' ? 'is' : 'are'} tidy. Anything new shows up here.` : 'Plug in its drive to see what could be tidier.'}</Empty>}
        </Widget>
        {kind === 'books' && !l.noCalibre && !review && reviewError && (
          <Widget title="The review" id="tidyReviewError" span="all" kind="fx-renewing tidyreview">
            <p class="warn" role="alert">Couldn't read the last review: {reviewError}</p>
            <div class="actions"><button class="small" onClick={reloadReview}>Try again</button></div>
          </Widget>
        )}
        {kind === 'books' && !l.noCalibre && !review && !reviewError && last(l, 'review') && (
          <Widget title="The review" span="all" kind="fx-renewing tidyreview"><Empty>Reading the last review…</Empty></Widget>
        )}
        {kind === 'books' && !l.noCalibre && review && (
          <Widget title="The review" id="tidyReview" span="all" kind="fx-renewing tidyreview" actions={!!changing.length && !reviewApplied(l) && <Go primary label={`Apply to ${count(changing.length, 'book')}…`} job={job} onClick={apply} />}>
            {reviewApplied(l) ? (
              <Empty>Applied {ago(last(l, 'apply')!.at)}: the books in it were changed. <strong>Review again</strong> to see whether anything is left.</Empty>
            ) : review.length ? (
              <Rows kind="tidybooks">
                {review.map((b) => <BookRow key={b.id} b={b} on={!b.held && !skip.has(b.id)} toggle={() => toggle(b.id)} cover={act.cover} />)}
              </Rows>
            ) : <Empty>Every book already looks tidy.</Empty>}
            {reviewApplied(l) && <div class="actions"><Go label="Undo the last apply" job={job} onClick={() => act.ask({ title: 'Undo the last apply?', action: 'Undo', lead: 'Puts back the titles, series, tags, and covers it changed.', go: () => act.run('books', 'undo', [], true) })} /></div>}
          </Widget>
        )}
        {kind in genreAsk && !l.noCalibre && <GenresWidget d={d} job={job} act={act} only={kind} />}
        {(kind === 'movies' || kind === 'tv') && <SpaceWidget l={l} d={d} />}
        {kind !== 'movies' && kind !== 'tv' && l.size > 0 && (
          <Widget title="Space" kind="fx-flow tidyspace"><Stat value={<span class="fx-amount">{size(l.size)}</span>} caption={l.freed ? size(l.freed) + ' won back so far' : 'On the drive'} /></Widget>
        )}
        <DoneWidget d={d} job={job} act={act} kind={kind} />
      </div>
    </FolderGone.Provider>
  );
}

// ------------------------------------------------------------ the screen

export interface TidyProps {
  d: app.TidyUp | null;
  /** The job holding the lock, as last followed (a job this window didn't start). */
  running?: app.TidyRunning | null;
  error?: string;
  tab: TidyTab;
  pick: (t: TidyTab) => void;
  job: TidyJob | null;
  closeJob: () => void;
  act: TidyActions;
  review: app.TidyBook[] | null;
  /** Why the review couldn't be read, when it couldn't. */
  reviewError?: string;
  skip: Set<number>;
  toggle: (id: number) => void;
  /** Reads Tidy Up's record again (Try again when it couldn't be read). */
  reload?: () => void;
  /** Reads the books' review again. */
  reloadReview?: () => void;
}

/** A tab kept from before (New downloads, Lyrics) opens where those things are now. */
export const tabNow = (t: string): TidyTab => (t === 'inbox' ? 'overview' : t === 'lyrics' ? 'music' : ((['overview', ...LIBRARIES] as string[]).includes(t) ? t as TidyTab : 'overview'));

export function TidyScreen(p: TidyProps) {
  const { d, job, act } = p;
  const tab = tabNow(p.tab);
  const waiting = d ? needsFor(d, act, p.review, p.pick).filter((t) => t.go).length : 0;
  // A job this window didn't start holds the lock: followed as it goes (screens/tidy.ts asks every few seconds).
  const other = job && !job.ended ? null : (p.running ? p.running.lock : d?.lock) || null;
  const say = !d ? '' : (d.freed ? `${size(d.freed)} won back so far · ` : '') + (waiting ? `${count(waiting, 'thing')} ${waiting === 1 ? 'needs' : 'need'} your OK` : 'Everything is tidy');
  return (
    <>
      <div class="row header">
        <div><h1>Tidy Up</h1><p class="lead">{say || 'Your music, films, TV, books, and audiobooks: sorted, tagged, and lean'}</p></div>
        <div class="toolbar"><button class="btn" onClick={() => act.settings()}>Settings…</button></div>
      </div>
      <Segmented label="Tidy Up sections" value={tab} pick={(v) => p.pick(v as TidyTab)} options={[['overview', 'Inbox'], ...LIBRARIES.map((k): [string, string] => [k, names[k]])]} />
      {other && <RunningCard lock={other} now={p.running?.lock ? p.running.now : undefined} />}
      {d?.stale && !other && !job && (() => {
        const c = carryOn(d.stale, d, act, p.pick);
        return <Card kind="notice" id="tidyStale"><strong>{jobTitle(d.stale.kind, d.stale.action)}: stopped part-way</strong><span class="muted">{'say' in c ? c.say : <>It can pick up where it left off. <button class="small" onClick={c.run}>{c.label}</button></>}</span></Card>;
      })()}
      {job && <JobPanel job={job} stop={act.stop} done={p.closeJob} fix={installFix(job, p.d, act)}
        // A job that asked first (a swap, an apply) is tried again from its own button, which asks again.
        again={job.yes ? undefined : () => act.run(job.kind, job.action, job.args || [])} />}
      {p.error && !d && <Card kind="notice" id="tidyError" role="alert"><strong>Tidy Up couldn't read its record</strong><span class="muted">{p.error}. Nothing in your libraries changed. <button class="small" onClick={p.reload}>Try again</button></span></Card>}
      {!d ? (!p.error && <Empty>Reading…</Empty>) : (
        <Elsewhere.Provider value={other ? jobTitle(other.kind, other.action) : ''}>
          <div class="finbody tidybody">
            {tab === 'overview' ? <Overview d={d} job={job} act={act} review={p.review} pick={p.pick} />
              : <LibraryTab kind={tab} d={d} job={job} act={act} review={p.review} reviewError={p.reviewError} reloadReview={p.reloadReview} skip={p.skip} toggle={p.toggle} pick={p.pick} />}
          </div>
        </Elsewhere.Provider>
      )}
    </>
  );
}

/** Draws the screen into its box. */
export function mountTidy(el: Element, props: TidyProps) { render(<TidyScreen {...props} />, el); }
/** Draws the question sheet (closed until asked). */
export function mountTidySheet(el: Element, c: TidyConfirm | null, close: () => void) { render(<ConfirmSheet c={c} close={close} />, el); }
