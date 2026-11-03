// Tidy Up: the libraries on the media drive, sorted, tagged, and lean.
// screens/tidy.ts reads TidyUp, runs the jobs (TidyRun), and keeps the
// running job's events; these components only draw, and say what a click
// wants (run, confirm, reveal).
import { createContext, render, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import { ago, bytes } from '../format';
import { Card, CardHead } from '../parts/Card';
import { Empty } from '../parts/Empty';
import { Row, Rows, type Tone } from '../parts/Row';
import { Segmented } from '../parts/Segmented';
import { Sheet } from '../parts/Sheet';
import { Tile } from '../status/Tiles';

export type TidyTab = 'overview' | 'music' | 'books' | 'movies' | 'tv' | 'audiobooks' | 'inbox' | 'lyrics';

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
  settings: () => void;
  review: () => void;
  cover: (id: number, which: 'current' | 'new') => Promise<string>;
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

/** A row of steps, the one at hand marked: Scan → Build → Swap → Check → Free space. */
function Steps({ steps, at, label, kind }: { steps: [string, ComponentChildren][]; at: number; label: string; kind?: string }) {
  return (
    <ol class={'tidysteps' + (kind ? ' ' + kind : '')} aria-label={label}>
      {steps.map(([name, sub], i) => (
        <li key={name} class={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>
          <span class="num" aria-hidden="true">{i < at ? '✓' : i + 1}</span>
          <span class="grow"><strong>{name}</strong><span class="muted">{sub}</span></span>
        </li>
      ))}
    </ol>
  );
}

/** A button that runs a job; every one waits while a job runs. */
function Go({ label, primary, job, title, onClick }: { label: string; primary?: boolean; job: TidyJob | null; title?: string; onClick: () => void }) {
  const gone = useContext(FolderGone);
  return <button class={primary ? 'primary small' : 'small'} disabled={busy(job) || gone} title={gone ? "Its folder isn't there: plug in its drive" : title} onClick={onClick}>{label}</button>;
}

/** The job at hand: its step, its bar, what it's on, its notes, and its log. */
export function JobPanel({ job, stop, done }: { job: TidyJob; stop: () => void; done: () => void }) {
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
      {!!job.lines.length && (
        <Rows kind="tidylines">
          {job.lines.slice(-6).map((l, i) => <Row key={i} dot={l.tone} title={l.text} />)}
        </Rows>
      )}
      <details class="jobdetails"><summary>Show details</summary><pre role="log">{job.log.join('\n')}</pre></details>
    </Card>
  );
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

// ------------------------------------------------------------ Overview

function Overview({ d, job, act, pick }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions; pick: (t: TidyTab) => void }) {
  const music = lib(d, 'music'), books = lib(d, 'books'), movies = lib(d, 'movies'), tv = lib(d, 'tv'), ab = lib(d, 'audiobooks');
  const songs = n(last(music, 'verify')?.result?.new) || n(last(music, 'run')?.result?.in_library) || n(last(music, 'scan')?.result?.files);
  const bloated = n(movies.counts?.bloated) + n(tv.counts?.bloated);
  const queued = n(movies.counts?.queued) + n(tv.counts?.queued);
  const lastFree = d.activity.filter((a) => a.text.includes('Trash') || a.sub?.includes('freed')).pop();
  const problems = d.checks.filter((c) => !c.ok && c.needs);
  return (
    <>
      <div class="tiles facts tidytiles">
        <Tile label="Space freed" value={d.freed ? bytes(d.freed) : 'None yet'} sub={lastFree ? `${lastFree.text} · ${ago(lastFree.at)}` : `What Tidy Up throws away goes to ${d.trash}`} />
        <Tile label="Music" value={songs ? count(songs, 'song') : 'Not scanned'} sub={musicWords(music.stage)} tone={music.stage === 'swapped' ? 'warn' : ''} />
        <Tile label="Movies and TV" value={bloated ? count(bloated, 'file') + ' to shrink' : queued ? count(queued, 'file') + ' with Tdarr' : n(movies.counts?.lean) + n(tv.counts?.lean) ? 'All lean' : 'Not scanned'}
          sub={queued ? 'Tdarr shrinks them one by one' : bloated ? 'H.264, lossless audio, or extra tracks' : 'HEVC, one language, nothing extra'} />
        <Tile label="Books and audiobooks" value={books.stage === 'reviewed' ? 'Ready to review' : books.stage === 'applied' ? 'Tidied' : 'Not tidied yet'}
          sub={ab.counts?.merged ? `${count(n(ab.counts.merged), 'audiobook')} merged into one file each` : 'Audiobooks: one .m4b a book'} />
      </div>
      <div class="tidycols">
        <div>
          {d.libraries.map((l) => <LibraryCard key={l.kind} l={l} d={d} job={job} act={act} open={() => pick(l.kind as TidyTab)} />)}
        </div>
        <div>
          <Card kind="alerts" id="tidyChecks">
            <CardHead title="This machine"><span class="muted">{problems.length ? count(problems.length, 'thing') + ' to fix' : 'Ready'}</span></CardHead>
            <Rows>
              {d.checks.map((c) => <Row key={c.id} dot={c.ok ? 'ok' : c.needs ? 'warn' : ''} title={c.name} sub={c.ok ? c.note : `${c.note}. ${c.fix}`} />)}
            </Rows>
          </Card>
          <Card kind="alerts" id="tidyActivity">
            <CardHead title="Recent activity" />
            {d.activity.length ? (
              <Rows>
                {d.activity.slice(-8).reverse().map((a, i) => <Row key={i} dot={worrying(a.text) ? 'warn' : 'ok'} title={a.text} sub={`${ago(a.at)}${a.sub ? ' · ' + a.sub : ''}`} />)}
              </Rows>
            ) : <Empty>Nothing yet. A scan changes nothing: start with one.</Empty>}
            <div class="actions"><button class="small" onClick={() => act.reveal(d.reports)}>Open reports folder</button></div>
          </Card>
        </div>
      </div>
    </>
  );
}

function musicWords(stage: string): string {
  return ({ new: 'Scan it to see what would change', scanned: 'Scanned: build the cleaned library next', built: 'Built: ready to swap in', swapped: 'Swapped in: check nothing went missing', verified: 'Checked: free the space', freed: 'All in order' } as Record<string, string>)[stage] || '';
}

/** One library on the overview: where it is, where it stands, its next step; its name opens its tab. */
function LibraryCard({ l, d, job, act, open }: { l: app.TidyLibrary; d: app.TidyUp; job: TidyJob | null; act: TidyActions; open: () => void }) {
  const where = l.found ? l.folder : `${l.folder}: not found (drive unplugged?)`;
  const next: Record<string, [string, () => void] | null> = {
    music: l.stage === 'new' ? ['Scan', () => act.run('music', 'scan')] : null,
    books: ['Review my books', () => act.review()],
    movies: ['Scan', () => act.run('movies', 'scan')],
    tv: ['Scan', () => act.run('tv', 'scan')],
    audiobooks: ['Scan', () => act.run('audiobooks', 'scan')],
  };
  const what: Record<string, string> = {
    music: musicWords(l.stage),
    books: 'Titles, series, publishers, and genres tidied; sharper covers. Nothing changes until you have looked it over.',
    movies: summary(l, d),
    tv: summary(l, d),
    audiobooks: l.counts?.merged ? `${count(n(l.counts.merged), 'book')} merged into one .m4b each` : 'Books in many MP3s become one .m4b with chapters',
  };
  const go = next[l.kind];
  return (
    <Card kind={'tidylib' + (l.found ? '' : ' missing')}>
      <CardHead title={<button type="button" class="tidyopen" aria-label={`Open ${names[l.kind]}`} onClick={open}>{names[l.kind]}<span class="chev" aria-hidden="true">›</span></button>}>{go && l.found && <Go label={go[0]} job={job} onClick={go[1]} />}</CardHead>
      <p class="muted tidyfolder" title={l.folder}>{where}</p>
      <p>{what[l.kind]}</p>
    </Card>
  );
}

function summary(l: app.TidyLibrary, d: app.TidyUp): string {
  const c = l.counts || {};
  const parts = [] as string[];
  if (n(c.lean)) parts.push(`${count(n(c.lean), 'file')} lean`);
  if (n(c.bloated)) parts.push(`${count(n(c.bloated), 'file')} to shrink`);
  if (n(c.queued)) parts.push(`${count(n(c.queued), 'file')} with Tdarr`);
  if (l.freed) parts.push(`${bytes(l.freed)} freed`);
  if (!d.tdarr?.[l.kind]) parts.push('Tdarr not set up');
  return parts.length ? parts.join(' · ') : 'Scan to find what wastes space';
}

// ------------------------------------------------------------ Music

function Music({ d, job, act }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions }) {
  const l = lib(d, 'music');
  const at = { new: 0, scanned: 1, built: 2, swapped: 3, verified: 4, freed: 5 }[l.stage] ?? 0;
  const scan = last(l, 'scan')?.result, run = last(l, 'run')?.result, verify = last(l, 'verify')?.result;
  const swap = () => act.ask({
    title: 'Swap in your cleaned library?', action: 'Swap in',
    lead: `${run ? count(n(run.in_library), 'song') + ' are ready. ' : ''}It takes about a minute, and you can undo it until you free the space.`,
    steps: ['Pause the apps that use your music (Navidrome, beets, Lidarr)', 'Back up Navidrome: plays, favourites, and playlists', "Clear Navidrome's artwork cache, so covers don't show as blank records", 'Swap the folders: your old library is kept as a hidden backup', 'Start everything again: Navidrome rescans on its own'],
    go: () => act.run('music', 'finalize', [], true),
  });
  const free = () => act.ask({
    title: 'Free the space?', action: 'Free the space', twice: true,
    lead: `Every song is checked first. Then the old library and the duplicates set aside go to ${d.trash}; after that, the swap can't be undone from here.`,
    keep: ['Your new library and everything Navidrome shows', 'The Navidrome backup from the swap', "Songs that weren't imported or couldn't be read, in the reports folder"],
    go: () => act.run('music', 'free-space'),
  });
  return (
    <FolderGone.Provider value={!l.found}>
      <Gone l={l} />
      <Card kind="tidylib">
        <CardHead title="Your music"><span class="muted tidyfolder" title={l.folder}>{l.folder} · played by Navidrome</span></CardHead>
        <Steps label="Tidying your music" at={at} steps={[
          ['Scan', scan ? `${n(scan.files).toLocaleString()} songs read` : 'Look first; changes nothing'],
          ['Build', run ? `${n(run.in_library).toLocaleString()} songs · ${ago(last(l, 'run')!.at)}` : 'A cleaned copy; originals untouched'],
          ['Swap', at >= 3 ? 'Navidrome backed up' : 'Pauses the apps, then swaps'],
          ['Check', verify ? (last(l, 'verify')!.ok ? 'Nothing missing' : `${n(verify.missing)} missing`) : 'Every song accounted for'],
          ['Free space', at >= 5 ? `${bytes(l.freed)} back` : `Old library to ${d.trash}`],
        ]} />
        <div class="actions">
          {at === 0 && <Go primary label="Scan" job={job} onClick={() => act.run('music', 'scan')} />}
          {at === 1 && <><Go primary label="Build the cleaned library" job={job} title="Hours for a big library; Navidrome keeps playing, and it carries on where it stopped" onClick={() => act.run('music', 'run')} /><Go label="Scan again" job={job} onClick={() => act.run('music', 'scan', ['--rescan'])} /></>}
          {at === 2 && <Go primary label="Swap in…" job={job} onClick={swap} />}
          {at === 3 && <Go primary label="Check nothing went missing" job={job} onClick={() => act.run('music', 'verify')} />}
          {at === 4 && <Go primary label="Free the space…" job={job} onClick={free} />}
          {at === 5 && <Go label="Tidy new music the same way" job={job} title="Cleans the whole library again, the same way" onClick={() => act.run('music', 'run', ['--start-over'])} />}
          {(at === 3 || at === 4) && <Go label="Put the old library back" job={job} onClick={() => act.ask({ title: 'Put the old library back?', action: 'Put it back', lead: 'Navidrome is paused while the folders swap back, exactly as they were.', go: () => act.run('music', 'undo', [], true) })} />}
        </div>
      </Card>
      {at >= 3 && (
        <Card kind="alerts">
          <CardHead title="After the swap: Navidrome" />
          <Rows>
            <Row dot={last(l, 'navidrome-cleanup')?.ok ? 'ok' : ''} title="Full scan, and the missing entries removed" sub="They're old paths, not lost songs" end={<Go label="Tidy Navidrome" job={job} onClick={() => act.run('music', 'navidrome-cleanup')} />} />
            <Row dot={last(l, 'playlists')?.ok ? 'ok' : ''} title="A smart playlist for each of your genres" sub="Navidrome fills them as music is added" end={<Go label="Make playlists" job={job} onClick={() => act.run('music', 'playlists')} />} />
          </Rows>
        </Card>
      )}
      <Card kind="alerts">
        <CardHead title="Checks" />
        <Rows>
          <Row dot={last(l, 'genres')?.ok ? 'ok' : ''} title="Genres and tags" sub="Every song in one of your 14 genres · no stale tags" end={<Go label="Check genres" job={job} onClick={() => act.run('music', 'genres')} />} />
          {verify && <Row dot={last(l, 'verify')!.ok ? 'ok' : 'warn'} title={last(l, 'verify')!.ok ? 'Nothing went missing' : 'Some songs are missing'} sub={`${n(verify.original).toLocaleString()} before = ${n(verify.new).toLocaleString()} in the library + ${n(verify.set_aside).toLocaleString()} set aside`} when={ago(last(l, 'verify')!.at)} />}
          {run && n(run.set_aside) > 0 && <Row dot="warn" title={`${count(n(run.set_aside), 'copy', 'copies')} set aside`} sub={`Mostly duplicates; they go to ${d.trash} when you free the space`} end={<button class="small" onClick={() => act.reveal(String(run.needs_attention || d.reports))}>Show</button>} />}
        </Rows>
      </Card>
    </FolderGone.Provider>
  );
}

// ------------------------------------------------------------ Books

function Books({ d, job, act, review, skip, toggle }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions; review: app.TidyBook[] | null; skip: Set<number>; toggle: (id: number) => void }) {
  const l = lib(d, 'books');
  const r = last(l, 'review');
  const changing = (review || []).filter((b) => !b.held && !skip.has(b.id));
  const apply = () => act.ask({
    title: `Apply the changes to ${count(changing.length, 'book')}?`, action: 'Apply',
    lead: `Calibre-Web is paused while Calibre's database is written, and started again after. ${skip.size ? count(skip.size, 'book') + ' you left alone stay as they are. ' : ''}Undo puts back what this changes.`,
    go: () => act.run('books', 'apply', skip.size ? ['--skip', [...skip].join(',')] : [], true),
  });
  return (
    <FolderGone.Provider value={!l.found}>
      <Gone l={l} />
      <Card kind="tidylib">
        <CardHead title="Your books"><span class="muted tidyfolder" title={l.folder}>{l.folder} · served by Calibre-Web</span></CardHead>
        <p>Tidies titles, series, publishers, and genre tags, finds sharper covers, and flags books that look misfiled. Nothing changes until you've looked it over.</p>
        <div class="actions">
          <Go primary={!review?.length} label={r ? 'Review again' : 'Review my books'} job={job} onClick={() => act.run('books', 'review')} />
          {!!review?.length && <Go primary label={`Apply to ${count(changing.length, 'book')}…`} job={job} onClick={apply} />}
          {last(l, 'apply')?.ok && <Go label="Undo the last apply" job={job} onClick={() => act.ask({ title: 'Undo the last apply?', action: 'Undo', lead: 'Puts back the titles, series, tags, and covers it changed.', go: () => act.run('books', 'undo', [], true) })} />}
        </div>
      </Card>
      {review && (
        <Card kind="alerts" id="tidyReview">
          <CardHead title="Review"><span class="muted">{review.length ? `${count(review.length, 'book')} · switch off what to leave alone` : ''}</span></CardHead>
          {review.length ? (
            <Rows kind="tidybooks">
              {review.map((b) => <BookRow key={b.id} b={b} on={!b.held && !skip.has(b.id)} toggle={() => toggle(b.id)} cover={act.cover} />)}
            </Rows>
          ) : <Empty>No review yet. Review my books looks first and changes nothing.</Empty>}
        </Card>
      )}
    </FolderGone.Provider>
  );
}

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

// ------------------------------------------------------------ Movies and TV

function Video({ kind, d, job, act }: { kind: 'movies' | 'tv'; d: app.TidyUp; job: TidyJob | null; act: TidyActions }) {
  const l = lib(d, kind);
  const c = l.counts || {};
  const scan = last(l, 'scan')?.result;
  const ready = !!d.tdarr?.[kind];
  const at = !scan ? 0 : n(c.queued) ? 2 : n(c.bloated) ? 1 : 3;
  return (
    <FolderGone.Provider value={!l.found}>
      <Gone l={l} />
      <div class="tiles facts tidytiles">
        <Tile label="Lean already" value={(n(c.lean)).toLocaleString()} sub="HEVC or AV1, your languages only" />
        <Tile label="Wasting space" value={(n(c.bloated)).toLocaleString()} sub={scan ? `About ${bytes(n(scan.saving))} to win back` : 'Scan to find them'} tone={n(c.bloated) ? 'warn' : ''} />
        <Tile label="With Tdarr" value={(n(c.queued) + n(l.waiting)).toLocaleString()} sub={n(l.waiting) ? `${count(n(l.waiting), 'download')} shrinking before ${n(l.waiting) === 1 ? "it's" : "they're"} filed` : "In Tdarr's queue"} />
        <Tile label="Freed" value={l.freed ? bytes(l.freed) : 'None yet'} sub={`Originals go to ${d.trash}`} />
      </div>
      <Card kind="tidylib">
        <CardHead title={kind === 'tv' ? 'Your TV' : 'Your films'}><span class="muted tidyfolder" title={l.folder}>{l.folder}</span></CardHead>
        <Steps label={`Shrinking your ${kind === 'tv' ? 'TV' : 'films'}`} at={at} steps={[
          ['Scan', 'H.264, lossless audio, extra tracks'],
          ['Shrink', `Tdarr: ${(d.settings.TIDY_VIDEO_CODEC || 'hevc').toUpperCase()}, ${languages(d.settings.TIDY_KEEP_LANGUAGES || 'eng')} only`],
          ['Replace', 'Checked, swapped in, subtitles aligned'],
          ['Free space', `Original to ${d.trash}`],
        ]} />
        <div class="actions">
          {!ready && <Go primary label="Set up Tdarr" job={job} title="Makes Tidy Up's library in Tdarr with the space-saving plugins" onClick={() => act.run('tdarr', 'setup', ['--apply'])} />}
          <Go primary={ready && at === 0} label={scan ? 'Scan again' : 'Scan'} job={job} onClick={() => act.run(kind, 'scan')} />
          {ready && n(c.bloated) > 0 && <Go primary label={`Shrink ${count(n(c.bloated), 'file')}`} job={job} title="Hands them to Tdarr's queue; Tdarr paces itself, and pauses on battery" onClick={() => act.run(kind, 'run')} />}
          {ready && (n(c.queued) > 0 || n(l.waiting) > 0) && <Go label="Collect what's done" job={job} title="Tidy Up checks every few minutes by itself" onClick={() => act.run(kind, 'collect')} />}
        </div>
        {kind === 'tv' && <p class="muted">Episodes are filed as Show/Season 01/Show - S01E01; a file with two episodes keeps both numbers (S01E01-E02), and anime numbered from the first episode keeps its number (Show - 112).</p>}
      </Card>
      {scan?.reasons && Object.keys(scan.reasons).length > 0 && (
        <Card kind="alerts">
          <CardHead title="What wastes space" />
          <Rows>{Object.entries(scan.reasons as Record<string, number>).map(([why, k]) => <Row key={why} dot="warn" title={(why[0].toUpperCase() + why.slice(1)).replace(/\b([Hh])\.?26([45])\b/g, 'H.26$2')} when={k.toLocaleString()} whenPlain />)}</Rows>
        </Card>
      )}
    </FolderGone.Provider>
  );
}

// ------------------------------------------------------------ Audiobooks

function Audiobooks({ d, job, act }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions }) {
  const l = lib(d, 'audiobooks');
  const scan = last(l, 'scan')?.result;
  return (
    <FolderGone.Provider value={!l.found}>
    <Gone l={l} />
    <Card kind="tidylib">
      <CardHead title="Your audiobooks"><span class="muted tidyfolder" title={l.folder}>{l.folder} · served by Audiobookshelf</span></CardHead>
      <Steps label="Merging your audiobooks" at={!scan ? 0 : n(scan.books) ? 1 : 2} steps={[
        ['Scan', scan ? `${count(n(scan.books), 'book')} in ${count(n(scan.files), 'file')}` : 'Books split into many files'],
        ['Merge', 'One .m4b each, a chapter per file, one cover'],
        ['Free space', l.freed ? `${bytes(l.freed)} back` : `The parts go to ${d.trash}`],
      ]} />
      <div class="actions">
        <Go primary={!scan} label={scan ? 'Scan again' : 'Scan'} job={job} onClick={() => act.run('audiobooks', 'scan')} />
        {!!n(scan?.books) && <Go primary label={`Merge ${count(n(scan!.books), 'book')}`} job={job} onClick={() => act.run('audiobooks', 'run')} />}
      </div>
    </Card>
    </FolderGone.Provider>
  );
}

// ------------------------------------------------------------ Inbox

function Inbox({ d, job, act }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions }) {
  const lastSweep = d.inbox.last;
  const filed = (lastSweep?.result?.filed || {}) as Record<string, string[]>;
  const waiting = (lastSweep?.result?.waiting || []) as { path: string; why: string }[];
  return (
    <div class="tidycols">
      <div>
        <Card kind="tidylib">
          <CardHead title="New downloads">
            <span class="actions"><Go label="Check now" job={job} onClick={() => act.run('inbox', 'scan', ['--apply'])} /></span>
          </CardHead>
          <p>Drop music, films, episodes, books, or audiobooks in Downloads. Each is matched, tagged, shrunk if it's bloated, and filed into its library the same way as everything else, then its player is told about that one folder.</p>
          <Steps label="How a download is filed" kind="three" at={-1} steps={[
            ['Spot it', 'New in Downloads'], ['Let it finish', 'Five quiet minutes, no .part files'], ['Sort it', 'Episode, film, song, audiobook, or book'],
            ['Shrink it', 'Bloated video through Tdarr first'], ['File it', 'Into its library'], ['Play it', 'Its player refreshes that folder'],
          ]} />
        </Card>
        <Card kind="alerts" id="tidyInboxLast">
          <CardHead title="Filed recently">{lastSweep && <span class="muted">{ago(lastSweep.at)}</span>}</CardHead>
          {Object.values(filed).flat().length || waiting.length ? (
            <Rows>
              {Object.entries(filed).flatMap(([kind, paths]) => paths.map((p) => <Row key={p} dot="ok" title={p.split(/[\\/]/).pop()} sub={names[kind] || kind} />))}
              {waiting.map((w) => <Row key={w.path} dot="" title={w.path.split(/[\\/]/).pop()} sub={w.why} />)}
            </Rows>
          ) : <Empty>Nothing new. Downloads is checked every minute.</Empty>}
        </Card>
      </div>
      <div>
        <Card kind="alerts">
          <CardHead title="Where new things come from" />
          <Rows>
            {d.inbox.folders.map((f) => <Row key={f} dot={d.inbox.watching ? 'ok' : ''} title={f} end={<span class="muted">{d.inbox.watching ? 'Watching' : 'Off'}</span>} />)}
            <Row dot="" title="The download apps" sub="Sonarr, Radarr, and Lidarr stop renaming and moving: Tidy Up files what they download" end={<Go label="Hand over" job={job} onClick={() => act.ask({ title: 'Let Tidy Up file the downloads?', action: 'Hand over', lead: 'Sonarr, Radarr, and Lidarr keep finding and downloading; they stop renaming files and stop moving finished downloads into the libraries. Tidy Up files them instead, so the two never rename each other\'s files.', go: () => act.run('arr', 'apply') })} />} />
          </Rows>
        </Card>
        <Card kind="alerts">
          <CardHead title="Rules" />
          <Rows>
            <Row title="Wait until a download has finished" sub="No changes for 5 minutes, no .part files" />
            <Row title="Keep the leaner copy of duplicates" sub={`HEVC beats H.264, high-quality AAC beats a huge FLAC; the other goes to ${d.trash}`} />
            <Row title="Shrink before filing" sub="A bloated film or episode goes through Tdarr before it enters the library" />
            <Row title="Pick up loose books" sub="Any .epub, and .pdf books, however deep in Downloads, into Calibre" />
            <Row title="Clean up after" sub={`What a download leaves behind (.nfo, samples, its folder) goes to ${d.trash}`} />
          </Rows>
          <div class="actions"><button class="small" onClick={act.settings}>Change in Settings…</button></div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Lyrics

function Lyrics({ d, job, act }: { d: app.TidyUp; job: TidyJob | null; act: TidyActions }) {
  const l = lib(d, 'music');
  const r = last(l, 'lyrics')?.result;
  const where = d.settings.TIDY_LYRICS === 'lrc' ? 'A .lrc file beside each song' : 'Inside each song file';
  return (
    <>
      <div class="tiles facts tidytiles">
        {(['synced', 'plain', 'none', 'instrumental'] as const).map((k) => (
          <Tile key={k} label={{ synced: 'Synced lyrics', plain: 'Plain lyrics', none: 'No lyrics', instrumental: 'Instrumental' }[k]} value={r ? n(r[k]).toLocaleString() : '—'} sub={{ synced: 'Lines light up as it plays', plain: 'Replaced when synced ones are found', none: 'LRCLIB had none yet', instrumental: 'Skipped' }[k]} />
        ))}
      </div>
      <Card kind="tidylib">
        <CardHead title="Lyrics">
          <span class="actions"><Go label="Check coverage" job={job} title="Reads the tags of every song; changes nothing" onClick={() => act.run('music', 'lyrics', ['--check'])} /><Go primary label="Add lyrics to my library" job={job} onClick={() => act.run('music', 'lyrics')} /></span>
        </CardHead>
        <p>Adds lyrics so they scroll along in Navidrome and Feishin: time-synced from LRCLIB where there are some, plain text otherwise. Fetched for your own listening and kept only in your library.</p>
        <Rows>
          <Row dot="ok" title="Prefer time-synced lyrics" sub="Plain lyrics a song already has are replaced when synced ones are found" />
          <Row dot="ok" title="Skip instrumentals" sub="By the title, and by LRCLIB's own word" />
          <Row dot="ok" title={where} sub="Old APE tags are removed first, so players read the new lyrics" end={<button class="small" onClick={act.settings}>Change…</button>} />
          <Row dot={d.settings.TIDY_LYRICS_NEW_MUSIC === 'false' ? '' : 'ok'} title="Add lyrics to new music automatically" sub="When it's filed from Downloads" />
        </Rows>
      </Card>
    </>
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

export function TidyScreen(p: TidyProps) {
  const { d, job, act } = p;
  return (
    <>
      <div class="row header">
        <div><h1>Tidy Up</h1><p class="lead">Your music, books, films, TV, and audiobooks: sorted, tagged, and lean.</p></div>
        <div class="toolbar"><button class="btn" onClick={act.settings}>Settings…</button></div>
      </div>
      <Segmented label="Tidy Up sections" value={p.tab} pick={(v) => p.pick(v as TidyTab)} options={[
        ['overview', 'Overview'], ['music', 'Music'], ['books', 'Books'], ['movies', 'Movies'], ['tv', 'TV'], ['audiobooks', 'Audiobooks'], ['inbox', 'New downloads'], ['lyrics', 'Lyrics'],
      ]} />
      {d?.lock && !job && <Card kind="notice" role="status"><strong>{names[d.lock.kind] || d.lock.kind}: {d.lock.action} is running</strong><span class="muted">Since {ago(d.lock.start)}. It carries on with this window closed.</span></Card>}
      {d?.stale && !d.lock && !job && <Card kind="notice"><strong>{names[d.stale.kind] || d.stale.kind}: {d.stale.action} stopped part-way</strong><span class="muted">Run it again to carry on where it left off. <button class="small" onClick={() => act.run(d.stale!.kind, d.stale!.action)}>Carry on</button></span></Card>}
      {job && <JobPanel job={job} stop={act.stop} done={p.closeJob} />}
      {p.error && !d && <Card kind="notice"><strong>Tidy Up couldn't read its record</strong><span class="muted">{p.error}</span></Card>}
      {!d ? (!p.error && <Empty>Reading…</Empty>) : (
        <div class="tidybody">
          {p.tab === 'overview' && <Overview d={d} job={job} act={act} pick={p.pick} />}
          {p.tab === 'music' && <Music d={d} job={job} act={act} />}
          {p.tab === 'books' && <Books d={d} job={job} act={act} review={p.review} skip={p.skip} toggle={p.toggle} />}
          {(p.tab === 'movies' || p.tab === 'tv') && <Video kind={p.tab} d={d} job={job} act={act} />}
          {p.tab === 'audiobooks' && <Audiobooks d={d} job={job} act={act} />}
          {p.tab === 'inbox' && <Inbox d={d} job={job} act={act} />}
          {p.tab === 'lyrics' && <Lyrics d={d} job={job} act={act} />}
        </div>
      )}
    </>
  );
}

/** Draws the screen into its box. */
export function mountTidy(el: Element, props: TidyProps) { render(<TidyScreen {...props} />, el); }
/** Draws the question sheet (closed until asked). */
export function mountTidySheet(el: Element, c: TidyConfirm | null, close: () => void) { render(<ConfirmSheet c={c} close={close} />, el); }
