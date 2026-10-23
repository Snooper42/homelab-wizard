// What an update brings, before it goes ahead: the releases of the app's
// project newer than the version it runs, with the start of each one's
// notes and a link to the rest. Update stays available while they load or
// when none are known.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export interface ReleaseNotesProps {
  name: string;
  load: () => Promise<releases.Preview>;
  onUpdate: () => void;
  onCancel: () => void;
  open: (url: string) => void;
}

/** One line on what the update brings. */
export function summary(name: string, p: releases.Preview): string {
  const n = p.releases.length;
  if (!p.repo) return `${name}'s image does not say where its releases are published. Updating pulls its newest image.`;
  if (p.placed && n === 0) return `${name} runs ${p.running}, the newest release. Updating pulls that release's newest build.`;
  if (n === 0) return `${name}'s project has published no releases.`;
  if (!p.placed) return p.running
    ? `${name} runs ${p.running}; the newest release is ${p.releases[0].tag}.`
    : `The newest release of ${name} is ${p.releases[0].tag}. Its image does not say which version it runs now.`;
  return `${name} runs ${p.running}; updating brings ${n === 1 ? p.releases[0].tag : `${n} releases, up to ${p.releases[0].tag}`}.`;
}

const day = (when: string) => {
  const d = new Date(when);
  return isNaN(d.getTime()) || d.getFullYear() < 2000 ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export function ReleaseNotes({ name, load, onUpdate, onCancel, open }: ReleaseNotesProps) {
  const [preview, setPreview] = useState<releases.Preview | null>(null);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let live = true;
    load().then((p) => live && setPreview(p), (e) => live && setProblem(String(e?.message || e)));
    return () => { live = false; };
  }, []);
  const shown = preview?.releases.slice(0, 5) || [];
  return (
    <div class="notes">
      {!preview && !problem && <p class="muted">Reading what is new…</p>}
      {problem && <p class="muted">Its release notes could not be read ({problem}). Updating still works.</p>}
      {preview && <p>{summary(name, preview)}</p>}
      {shown.map((r) => (
        <section class="release" key={r.tag}>
          <div class="row">
            <strong>{r.tag}{r.name ? ` — ${r.name}` : ''}</strong>
            <span class="muted">{day(r.when)}</span>
          </div>
          {r.notes && <pre>{r.notes}</pre>}
          <a href="#" onClick={(e) => { e.preventDefault(); open(r.url); }}>Full notes</a>
        </section>
      ))}
      {preview && preview.releases.length > shown.length && preview.page && (
        <p class="muted">And {preview.releases.length - shown.length} older ones: <a href="#" onClick={(e) => { e.preventDefault(); open(preview.page!); }}>all releases</a>.</p>
      )}
      <div class="actions">
        <button class="primary small" onClick={onUpdate}>Update</button>
        <button class="small" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function mountReleaseNotes(el: Element, props: ReleaseNotesProps) { render(<ReleaseNotes {...props} />, el); }
