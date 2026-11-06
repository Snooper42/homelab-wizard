// Tidy Up: the libraries on the media drive, sorted, tagged, and lean.
// Overview says what needs your OK (each thing with what it wins back and
// one button), the genres, the drive, and what was done, with Undo; each
// library's tab says the same for it alone. screens/tidy.ts reads TidyUp,
// runs the jobs (TidyRun), and keeps the running job's events; these
// components only draw, and say what a click wants (run, confirm, reveal).
import { createContext, render, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { ago, bytes } from '../format';
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
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const count = (v: number, one: string, many = one + 's') => `${v.toLocaleString()} ${v === 1 ? one : many}`;
const lib = (d: app.TidyUp, kind: string) => d.libraries.find((l) => l.kind === kind)!;
const last = (l: app.TidyLibrary, action: string) => l.last?.[action];
const busy = (job: TidyJob | null) => !!job && !job.ended;

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

/** A button that runs a job; every one waits while a job runs. */
function Go({ label, primary, job, title, onClick }: { label: string; primary?: boolean; job: TidyJob | null; title?: string; onClick: () => void }) {
  const gone = useContext(FolderGone);
  return <button class={primary ? 'primary small' : 'small'} disabled={busy(job) || gone} title={gone ? "Its folder isn't there: plug in its drive" : title} onClick={onClick}>{label}</button>;
}

/** The job at hand: its step, its bar, what it's on, its notes, and its log. */
export function JobPanel({ job, stop, done, fix }: { job: TidyJob; stop: () => void; done: () => void; fix?: { label: string; run: () => void } }) {
  const p = job.progress;
  const pct = p && p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : undefined;
  const left = p?.eta ? (p.eta > 3600 ? `~${Math.floor(p.eta / 3600)}h ${Math.round((p.eta % 3600) / 60)}m left` : `~${Math.max(1, Math.round(p.eta / 60))}m left`) : '';
  return (
    <Card kind="tidyjob" id="tidyJob" role="status">
      <CardHead title={job.ended ? (job.ended.ok ? `${job.title}: done` : `${job.title}: stopped`) : job.title}>
        {job.ended ? <button class="small" onClick={done}>Close</button> : <button class="small" onClick={stop} title="It stops at a safe point; run it again to carry on where it left off">Stop</button>}
      </CardHead>
      {job.step && <p class="tidystep">Step {job.step.n} of {job.step.total} · {job.step.text}</p>}
      {!job.ended && (
        <div class="progress">
          <div class="track" role="progressbar" aria-label={job.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span class="fill" style={{ width: `${pct ?? 0}%` }} /></div>
          <p class="step" aria-live="polite">{p ? `${p.label} ${p.done.toLocaleString()} of ${p.total.toLocaleString()}${pct !== undefined ? ` · ${pct}%` : ''}${left ? ' · ' + left : ''}` : 'Starting…'}</p>
        </div>
      )}
      {p?.note && !job.ended && <p class="muted tidynow">Now: {p.note}</p>}
      {job.ended && !job.ended.ok && job.ended.why && <p class="bad">{job.ended.why}</p>}
      {fix && <p class="tidyfix"><button class="primary small" onClick={fix.run}>{fix.label}</button> <span class="muted">Then it carries on by itself.</span></p>}
      {!!job.lines.length && (
        <Rows kind="tidylines">
          {job.lines.slice(-9).map((l, i) => <Row key={i} dot={l.tone} title={l.text} />)}
        </Rows>
      )}
      <details class="jobdetails"><summary>Show details</summary><pre role="log">{job.log.join('\n')}</pre></details>
    </Card>
  );
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
  go?: { label: string; run: () => void; quiet?: boolean };
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
      verified: { kind: k, title: 'Free the old music library', sub: `Every song made it${n(run?.set_aside) ? ' · ' + count(n(run?.set_aside), 'copy', 'copies') + ' set aside go with it' : ''}`, go: { label: 'Free it…', run: free } },
    };
    if (step[l.stage]) out.push(step[l.stage]);
    const lyr = last(l, 'lyrics')?.result;
    // Only songs not yet asked about: those LRCLIB had nothing for wait a month before they're asked again. Songs whose
    // lyrics carry a translation after a caret on each line (two languages on one line) are set apart by the same job.
    const none = n(lyr?.none), apart = n(lyr?.to_clean);
    const notOn = n(lyr?.not_found) ? ` · ${count(n(lyr!.not_found), 'song')} not on LRCLIB yet` : '';
    // Setting lyrics right is done on this computer (--tidy): it never waits for LRCLIB, which thousands of songs would.
    if (lyr && apart > 0) out.push({ kind: 'lyrics', title: `${count(apart, 'song')} show two languages on one line`, sub: 'Each translation goes on a line of its own under its original, so both scroll along in Navidrome. Done on this computer, in minutes', go: { label: 'Tidy lyrics', run: () => act.run('music', 'lyrics', ['--tidy']) } });
    if (lyr && none > 0) out.push({ kind: 'lyrics', title: `${count(none, 'song')} could get lyrics`, sub: `Synced from LRCLIB where it has them, so they scroll along in Navidrome${notOn}`, go: { label: 'Add lyrics', run: () => act.run('music', 'lyrics') } });
    // A check from before Tidy Up counted those: one more, which changes nothing, finds them.
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
        go: { label: 'Remove extras…', run: () => act.ask({
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
    if (withTdarr) out.push({ kind: k, title: "Collect what Tdarr has finished", sub: `${things(k, withTdarr)} with Tdarr now · it checks by itself every few minutes`, go: { label: 'Collect', run: () => act.run(k, 'collect'), quiet: true } });
  } else if (k === 'books') {
    const rv = last(l, 'review');
    // Before the review's list is read (it is, on the Books tab), its count says how many.
    const changing = review ? review.filter((b) => !b.held).map((b) => b.title) : [];
    const many = review ? changing.length : Math.max(0, n(rv?.result?.changes) - ((rv?.result?.held as unknown[]) || []).length);
    if (!rv) out.push({ kind: k, title: 'Look over your books', sub: 'Titles, series, publishers, genres, and covers: nothing changes until you say', go: { label: 'Review', run: () => act.review() } });
    else if (many) out.push({ kind: k, title: `${things(k, many)} could look tidier`, sub: changing.length ? changing.slice(0, 2).join(', ') + (changing.length > 2 ? `, and ${changing.length - 2} more` : '') : 'Titles, series, and covers, from the last review', go: { label: 'Look…', run: () => pick('books') } });
  } else if (k === 'audiobooks') {
    if (!scan) out.push({ kind: k, title: 'Look at your audiobooks first', sub: 'A scan finds books split into many files and changes nothing', go: { label: 'Scan', run: () => act.run('audiobooks', 'scan') } });
    else if (n(scan.books)) out.push({ kind: k, title: `Merge ${things(k, n(scan.books))}`, sub: `${count(n(scan.files), 'file')} into one .m4b each, with chapters and one cover`, go: { label: 'Merge', run: () => act.run('audiobooks', 'run') } });
  }
  return out;
}

/** The list: each thing's mark, words, what it wins back, and its button (off while a job runs). */
function TodoRows({ todos, job }: { todos: Todo[]; job: TidyJob | null }) {
  return (
    <Rows kind="fx-rows tidytodo">
      {todos.map((t, i) => (
        <Row key={t.kind + i} lead={<LibIcon kind={t.kind} />} title={t.title} sub={t.sub} subTone={t.warn ? 'warn' : undefined}
          end={<>{!!t.gain && <span class="fx-amount fx-in tidygain">{bytes(t.gain)}</span>}{t.go && <Go label={t.go.label} primary={!t.go.quiet} job={job} onClick={t.go.run} />}</>} />
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
  return (
    <Widget title={dr.name ? `On the ${dr.name} drive` : 'On this machine'} kind="fx-flow tidydrive">
      <Stat value={<span class="fx-amount">{bytes(dr.free)}<small> free</small></span>} caption={`Of ${bytes(dr.total)}${d.freed ? ' · ' + bytes(d.freed) + ' won back so far' : ''}`} />
      <SplitBar parts={[...parts, { label: 'Free', value: dr.free, color: 'track' }]} label="The drive" />
      <Legend items={[...parts.map((p) => ({ label: p.label, color: p.color, value: bytes(p.value) })), { label: 'Free', color: 'track' as Hue, value: bytes(dr.free) }]} />
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
      <Stat value={<span class="fx-amount">{l.size ? bytes(l.size) : total ? things(l.kind, total) : '—'}</span>} caption={l.size && total ? things(l.kind, total) : l.freed ? bytes(l.freed) + ' won back' : 'Measured after a scan'} />
      {total > 0 && <><SplitBar parts={parts} label={names[l.kind]} /><Legend items={parts.map((p) => ({ label: p.label, color: p.color, value: p.value.toLocaleString() }))} /></>}
      {!!l.freed && total > 0 && <p class="fx-sub">{bytes(l.freed)} won back so far</p>}
      {!!d.tdarr?.[l.kind] && <p class="fx-sub">Tdarr: {(d.settings.TIDY_VIDEO_CODEC || 'hevc').toUpperCase()}, {languages(d.settings.TIDY_KEEP_LANGUAGES || 'eng')} only</p>}
    </Widget>
  );
}

/** What was done lately, newest first; Undo where an undo exists (the music swap, the books' apply). */
function DoneWidget({ d, job, act, kind }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions; kind?: string }) {
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
  const check = !kind && <Go label="Check Downloads" job={job} onClick={() => act.run('inbox', 'scan', ['--apply'])} title="New films, episodes, music, and books in Downloads are filed every minute by themselves" />;
  return (
    <Widget title="Recently done" span="all" kind="fx-renewing tidydone" actions={check || undefined}>
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

function Overview({ d, job, act, review, pick }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions; review: app.TidyBook[] | null; pick: (t: TidyTab) => void }) {
  const gone: Todo[] = d.libraries.filter((l) => !l.found).map((l) => ({ kind: l.kind, title: `${names[l.kind]}: its drive isn't plugged in`, sub: `${l.folder} could not be found. It shows up here again once it's back.`, warn: true }));
  // A tool missing: Install when the app can fetch it (ffmpeg), Calibre's download page for Calibre.
  const machine: Todo[] = d.checks.filter((c) => !c.ok && c.needs).map((c) => ({ kind: 'machine', title: c.name, sub: `${c.note}. ${c.fix}`, warn: true,
    go: c.install ? { label: 'Install', run: () => act.install() } : c.id === 'calibredb' ? { label: 'Get Calibre', run: () => act.open('https://calibre-ebook.com/download'), quiet: true } : undefined }));
  const todos = [...machine, ...LIBRARIES.flatMap((k) => todosFor(lib(d, k), d, act, review, pick)), ...gone];
  // What waits on you: the things with a button (a drive away or a tool missing is said, not counted), as the heading counts.
  const waiting = todos.filter((t) => t.go).length;
  const gain = todos.reduce((t, x) => t + (x.gain || 0), 0);
  return (
    <div class="fx-board">
      <Widget title="Needs your OK" span="all" kind="fx-paycheck tidyneeds" actions={waiting ? <span class="muted">{count(waiting, 'thing')}{gain ? ' · ' + bytes(gain) + ' to win back' : ''}</span> : undefined}>
        {todos.length ? <TodoRows todos={todos} job={job} /> : (
          <div class="tidyclear"><span class="fmark logo tidyicon fx-h-in" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>
            <div><strong>Everything's tidy</strong><div class="muted">New downloads are filed as they finish, and anything new to tidy shows up here.</div></div></div>
        )}
      </Widget>
      <GenresWidget d={d} job={job} act={act} />
      <DriveWidget d={d} />
      <DoneWidget d={d} job={job} act={act} />
    </div>
  );
}

// ------------------------------------------------------------ a library's own tab

function LibraryTab({ kind, d, job, act, review, skip, toggle, pick }: { kind: string; d: app.TidyUp; job: TidyJob | null; act: TidyActions; review: app.TidyBook[] | null; skip: Set<number>; toggle: (id: number) => void; pick: (t: TidyTab) => void }) {
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
    if (!last(l, 'lyrics')) extra.push({ kind: 'lyrics', title: 'See how many songs have lyrics', sub: 'Reads every song; changes nothing', go: { label: 'Check lyrics', run: () => act.run('music', 'lyrics', ['--check']), quiet: true } });
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
  const rows = [...todos, ...extra];
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
        <Widget title="Can be tidier" span="all" kind="fx-paycheck tidyneeds" actions={again || undefined}>
          {rows.length ? <TodoRows todos={rows} job={job} /> : <Empty>{l.found ? `Your ${names[kind].toLowerCase()} ${kind === 'music' ? 'is' : 'are'} tidy. Anything new shows up here.` : 'Plug in its drive to see what could be tidier.'}</Empty>}
        </Widget>
        {kind === 'books' && review && (
          <Widget title="The review" id="tidyReview" span="all" kind="fx-renewing tidyreview" actions={!!changing.length && <Go primary label={`Apply to ${count(changing.length, 'book')}…`} job={job} onClick={apply} />}>
            {review.length ? (
              <Rows kind="tidybooks">
                {review.map((b) => <BookRow key={b.id} b={b} on={!b.held && !skip.has(b.id)} toggle={() => toggle(b.id)} cover={act.cover} />)}
              </Rows>
            ) : <Empty>Every book already looks tidy.</Empty>}
            {last(l, 'apply')?.ok && <div class="actions"><Go label="Undo the last apply" job={job} onClick={() => act.ask({ title: 'Undo the last apply?', action: 'Undo', lead: 'Puts back the titles, series, tags, and covers it changed.', go: () => act.run('books', 'undo', [], true) })} /></div>}
          </Widget>
        )}
        {kind in genreAsk && <GenresWidget d={d} job={job} act={act} only={kind} />}
        {(kind === 'movies' || kind === 'tv') && <SpaceWidget l={l} d={d} />}
        {kind !== 'music' && kind !== 'movies' && kind !== 'tv' && l.size > 0 && (
          <Widget title="Space" kind="fx-flow tidyspace"><Stat value={<span class="fx-amount">{bytes(l.size)}</span>} caption={l.freed ? bytes(l.freed) + ' won back so far' : 'On the drive'} /></Widget>
        )}
        <DoneWidget d={d} job={job} act={act} kind={kind} />
      </div>
    </FolderGone.Provider>
  );
}

// ------------------------------------------------------------ the screen

export interface TidyProps {
  d: app.TidyUp | null;
  error?: string;
  tab: TidyTab;
  pick: (t: TidyTab) => void;
  job: TidyJob | null;
  closeJob: () => void;
  act: TidyActions;
  review: app.TidyBook[] | null;
  skip: Set<number>;
  toggle: (id: number) => void;
}

/** A tab kept from before (New downloads, Lyrics) opens where those things are now. */
export const tabNow = (t: string): TidyTab => (t === 'inbox' ? 'overview' : t === 'lyrics' ? 'music' : ((['overview', ...LIBRARIES] as string[]).includes(t) ? t as TidyTab : 'overview'));

export function TidyScreen(p: TidyProps) {
  const { d, job, act } = p;
  const tab = tabNow(p.tab);
  const waiting = d ? LIBRARIES.flatMap((k) => todosFor(lib(d, k), d, act, p.review, p.pick)).filter((t) => t.go).length : 0;
  const say = !d ? '' : (d.freed ? `${bytes(d.freed)} won back so far · ` : '') + (waiting ? `${count(waiting, 'thing')} ${waiting === 1 ? 'needs' : 'need'} your OK` : 'Everything is tidy');
  return (
    <>
      <div class="row header">
        <div><h1>Tidy Up</h1><p class="lead">{say || 'Your music, films, TV, books, and audiobooks: sorted, tagged, and lean'}</p></div>
        <div class="toolbar"><button class="btn" onClick={() => act.settings()}>Settings…</button></div>
      </div>
      <Segmented label="Tidy Up sections" value={tab} pick={(v) => p.pick(v as TidyTab)} options={[['overview', 'Overview'], ...LIBRARIES.map((k): [string, string] => [k, names[k]])]} />
      {d?.lock && !job && <Card kind="notice" role="status"><strong>{names[d.lock.kind] || d.lock.kind}: {d.lock.action} is running</strong><span class="muted">Since {ago(d.lock.start)}. It carries on with this window closed.</span></Card>}
      {d?.stale && !d.lock && !job && <Card kind="notice"><strong>{names[d.stale.kind] || d.stale.kind}: {d.stale.action} stopped part-way</strong><span class="muted">Run it again to carry on where it left off. <button class="small" onClick={() => act.run(d.stale!.kind, d.stale!.action)}>Carry on</button></span></Card>}
      {job && <JobPanel job={job} stop={act.stop} done={p.closeJob} fix={installFix(job, p.d, act)} />}
      {p.error && !d && <Card kind="notice"><strong>Tidy Up couldn't read its record</strong><span class="muted">{p.error}</span></Card>}
      {!d ? (!p.error && <Empty>Reading…</Empty>) : (
        <div class="finbody tidybody">
          {tab === 'overview' ? <Overview d={d} job={job} act={act} review={p.review} pick={p.pick} />
            : <LibraryTab kind={tab} d={d} job={job} act={act} review={p.review} skip={p.skip} toggle={p.toggle} pick={p.pick} />}
        </div>
      )}
    </>
  );
}

/** Draws the screen into its box. */
export function mountTidy(el: Element, props: TidyProps) { render(<TidyScreen {...props} />, el); }
/** Draws the question sheet (closed until asked). */
export function mountTidySheet(el: Element, c: TidyConfirm | null, close: () => void) { render(<ConfirmSheet c={c} close={close} />, el); }
