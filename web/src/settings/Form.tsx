// Settings: .env as a form, in pages (each homelab-wide section, then one
// page per app). Secrets are never sent to the page; an empty secret field
// keeps the stored value. Logins, tokens, and folders have a Test button
// that checks the saved value against the real service. The form keeps
// what was typed; app.ts saves it.
import { render } from 'preact';
import { useState } from 'preact/hooks';

export interface Page {
  name: string;
  kind: 'general' | 'app';
  items: settings.Setting[];
}

/** A Test or Copy result under a setting. */
export interface Result {
  tone: 'ok' | 'bad' | 'muted';
  text: string;
}

export interface FormActions {
  /** What was typed and not saved yet, after each change. */
  edited: (edits: Record<string, string>) => void;
  /**
   * Saves a typed value first (when pending is set), then checks the saved
   * one. used: the typed value was saved (or was an empty secret, which
   * keeps the stored one), so it is no longer pending.
   */
  test: (key: string, pending?: string) => Promise<{ result: Result; used: boolean }>;
  copy: (key: string) => Promise<Result>;
  /** A folder picked for key, or '' when none was. */
  choose: (key: string) => Promise<string>;
}

export interface FormProps {
  pages: Page[];
  /** The everyday settings; the rest wait behind Show all on the homelab-wide pages. */
  wanted: Set<string>;
  /** Settings just asked for (a Setup step's): marked. */
  focus: string[];
  /** The Setup step each setting is for. */
  checks: Record<string, setup.Step>;
  testable: Set<string>;
  label: (key: string) => string;
  /** What is shown: the search, else the page (with the rarely changed settings when showAll). */
  view: View;
  on: FormActions;
}

export interface View {
  query: string;
  page: string;
  showAll: boolean;
}

/** What a view shows: the settings that match, how many per page, and how many wait behind Show all. */
export interface Shown {
  keys: Set<string>;
  counts: Record<string, number>;
  /** Rarely changed settings on the page, behind Show all. */
  pageMore: number;
}

/** Settings that hold a folder get a Choose… button. */
const folderKey = /(_ROOT|_DESTINATION|_LOCATION|_DIR)$/;

/**
 * Settings search: by name, key, help text, or page; every word must match,
 * across every page. Without a search, the chosen page shows; on the
 * homelab-wide pages, the rarely changed settings wait behind Show all.
 */
export function shown(pages: Page[], view: View, wanted: Set<string>, label: (key: string) => string, checks: Record<string, setup.Step>): Shown {
  const words = view.query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: Shown = { keys: new Set(), counts: {}, pageMore: 0 };
  for (const pg of pages) {
    const here = pg.name === view.page;
    for (const s of pg.items) {
      const more = pg.kind === 'general' && !wanted.has(s.key);
      if (here && more) out.pageMore++;
      const step = checks[s.key];
      const text = [pg.name, label(s.key), s.key.replace(/_/g, ' '), s.help || '', step ? step.title : '', 'setting-' + s.key].join(' ').toLowerCase();
      const match = words.length ? words.every((w) => text.includes(w)) : here && (view.showAll || !more);
      if (match) {
        out.keys.add(s.key);
        out.counts[pg.name] = (out.counts[pg.name] || 0) + 1;
      }
    }
  }
  return out;
}

/**
 * A setting's help in plain words: the commands behind it ("(./homelab
 * domain setup --ssl)") go, and for a switch so do the sentences that
 * spell out a value ("false lets it sleep as set.", "false: off."), since
 * the switch shows it.
 */
export function plainHelp(help: string, toggle: boolean): string {
  const words = help.replace(/\s*\((?:\.\/)?homelab [^)]*\)/g, '');
  if (!toggle) return words;
  return words.split(/(?<=\.)\s+/).filter((t) => !/^(true|false)\b/i.test(t)).join(' ');
}

interface RowProps {
  s: settings.Setting;
  p: FormProps;
  value: string | undefined;
  hidden: boolean;
  edit: (key: string, value: string | undefined) => void;
}

function Row({ s, p, value, hidden, edit }: RowProps) {
  const [result, setResult] = useState<Result | null>(null);
  const [testing, setTesting] = useState(false);
  // A value Test saved: shown until the form is read again.
  const [kept, setKept] = useState<string | undefined>(undefined);
  const step = p.checks[s.key];
  const toggle = !s.secret && /^(true|false)$/i.test(s.value || '');
  const label = p.label(s.key);
  const input = toggle
    ? <input type="checkbox" class="switch" role="switch" aria-label={label} checked={/^true$/i.test(value ?? kept ?? s.value)} onChange={(e) => edit(s.key, e.currentTarget.checked ? 'true' : 'false')} />
    : <input type={s.secret ? 'password' : 'text'} autocomplete="off" spellcheck={false} aria-label={label}
        value={value ?? kept ?? (s.secret ? '' : s.value || '')} placeholder={s.secret ? (s.set ? 'set · leave empty to keep' : 'not set') : ''}
        onInput={(e) => edit(s.key, e.currentTarget.value)} />;
  const test = async () => {
    setTesting(true);
    setResult({ tone: 'muted', text: 'Testing…' });
    const { result: r, used } = await p.on.test(s.key, value);
    if (used) {
      if (!s.secret) setKept(value);
      edit(s.key, undefined);
    }
    setResult(r);
    setTesting(false);
  };
  const buttons = [
    !s.secret && folderKey.test(s.key) && <button class="small" title="Pick the folder" onClick={async () => { const dir = await p.on.choose(s.key); if (dir) edit(s.key, dir); }}>Choose…</button>,
    s.secret && s.set && <button class="small" title="Copy the saved value, to keep it in the password manager; the clipboard clears after 90 seconds" onClick={async () => setResult(await p.on.copy(s.key))}>Copy</button>,
    p.testable.has(s.key) && <button class="small" title="Check the saved value with the service it is for" disabled={testing} onClick={test}>Test</button>,
  ].filter(Boolean);
  return (
    // Its .env name shows on hover, and under it while searching.
    <div class={'setting' + (toggle ? ' toggle' : '') + (p.focus.includes(s.key) ? ' focus' : '') + (p.wanted.has(s.key) ? '' : ' more')} id={'setting-' + s.key} hidden={hidden}>
      <div class="key" title={s.key}><span class="label">{label}</span><code>{s.key}</code></div>
      {buttons.length ? <div class="inputrow">{input}{buttons}</div> : input}
      <div class={'test' + (result ? ' ' + result.tone : '')} hidden={!result}>{result?.text}</div>
      {s.help && <div class="help">{plainHelp(s.help, toggle)}</div>}
      {step && step.state !== 'waiting' && (
        <div class={'check ' + (step.state === 'done' ? 'ok' : 'warn')}>{step.state === 'done' ? `✓ ${step.title}` : `${step.title}: ${step.detail || 'to do'}`}</div>
      )}
    </div>
  );
}

export function Form(p: FormProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const edit = (key: string, value: string | undefined) => {
    setEdits((old) => {
      const next = { ...old };
      if (value === undefined) delete next[key];
      else next[key] = value;
      p.on.edited(next);
      return next;
    });
  };
  const show = shown(p.pages, p.view, p.wanted, p.label, p.checks);
  const searching = !!p.view.query.trim();
  return (
    <>
      {p.pages.map((pg) => (
        <div class="group" data-page={pg.name} data-kind={pg.kind} key={pg.name} hidden={!show.counts[pg.name]}>
          <h2 hidden={!searching}>{pg.name}</h2>
          {pg.items.map((s) => <Row key={s.key} s={s} p={p} value={edits[s.key]} hidden={!show.keys.has(s.key)} edit={edit} />)}
        </div>
      ))}
    </>
  );
}

/** Renders the form; a new version starts it afresh (what was typed is dropped, after a save). */
export function mountForm(el: Element, props: FormProps, version: number) { render(<Form key={version} {...props} />, el); }

/** Shows only why the settings could not be read. */
export function formProblem(el: Element, problem: string) { render(<p class="bad">{problem}</p>, el); }
