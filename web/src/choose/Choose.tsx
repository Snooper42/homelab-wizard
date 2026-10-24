// Choose stacks: the starter picks, the bundles, every app by category with
// a box to tick, and the plan of what installing the ticked ones does,
// with the settings they need. app.ts keeps the selection and plans.
import { render } from 'preact';
import { Icon } from '../Icon';

/** A starter's symbol and tint, as an app's icon in System Settings. */
const starterLooks: Record<string, [string, string]> = { photos: ['photos', '#ff9500'], passwords: ['lock', '#34c759'], movies: ['film', '#ff3b30'], music: ['music', '#ff2d55'], files: ['folder', '#007aff'] };

/** A pick is lit while all of its apps are ticked. */
const lit = (p: api.Preset, selected: Set<string>) => !!p.apps.length && p.apps.every((id) => selected.has(id));

export interface PicksProps {
  presets: api.Preset[];
  selected: Set<string>;
  status: Record<string, api.AppStatus>;
  toggle: (p: api.Preset) => void;
}

/** The starter picks: a card each, Running once all its apps run. */
export function Starters({ presets, selected, status, toggle }: PicksProps) {
  return (
    <>
      {presets.map((p) => {
        const running = p.apps.every((id) => status[id]?.state === 'running');
        const [glyph, tint] = starterLooks[p.id] || [];
        return (
          <button key={p.id} class={'starter' + (lit(p, selected) ? ' on' : '')} onClick={() => toggle(p)}>
            {glyph && <span class="glyph" style={`--tint:${tint}`}><Icon name={glyph} /></span>}
            <strong>{p.name}</strong>
            <span class="desc">{p.description || ''}</span>
            {running && <span class="state">Running</span>}
          </button>
        );
      })}
    </>
  );
}

/** The bundles, as chips. */
export function Bundles({ presets, selected, toggle }: PicksProps) {
  return <>{presets.map((p) => <button key={p.id} class={'chip' + (lit(p, selected) ? ' on' : '')} title={p.description || ''} onClick={() => toggle(p)}>{p.name}</button>)}</>;
}

export interface GroupsProps {
  catalog: api.Catalog;
  status: Record<string, api.AppStatus>;
  selected: Set<string>;
  /** The search, lower case. */
  query: string;
  tick: (id: string, on: boolean) => void;
  open: (url: string) => void;
  settings: (keys: string[]) => void;
}

/** The search box filters by name, what an app does, and what it replaces. */
const matches = (a: api.App, query: string) => !query || [a.name, a.id, a.description, ...(a.replaces || []), ...(a.aliases || [])].join(' ').toLowerCase().includes(query);

const stateBadge: Record<string, [string, string]> = { running: ['running', 'ok'], stopped: ['stopped', 'warn'], elsewhere: ['runs elsewhere', 'warn'] };

function AppRow({ a, p }: { a: api.App; p: GroupsProps }) {
  const native = a.kind === 'native';
  const st = p.status[a.id];
  const [stateText, stateCls] = (st && stateBadge[st.state]) || [];
  const target = st?.state === 'running' ? (st.address ? 'https://' + st.address : st.url) : '';
  // Links inside the label must not toggle the checkbox.
  const quiet = (fn: () => void) => (e: Event) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const links = [
    target && <a onClick={quiet(() => p.open(target!))}>Open</a>,
    !!a.inputs?.length && <a onClick={quiet(() => p.settings(a.inputs!))}>Settings</a>,
  ].filter(Boolean);
  return (
    <label class="app">
      <input type="checkbox" checked={p.selected.has(a.id)} disabled={native} onChange={(e) => p.tick(a.id, e.currentTarget.checked)} />
      <div class="grow">
        <strong>{a.name}</strong>
        {native && <span class="badge">runs natively</span>}
        {stateText && <span class={'badge ' + stateCls}>{stateText}</span>}
        <div class="desc">{a.description}</div>
        {!!a.replaces?.length && <div class="replaces">Replaces {a.replaces.join(', ')}</div>}
      </div>
      {!!links.length && <div class="links-inline">{links}</div>}
    </label>
  );
}

/** Every app (helpers aside) by category, with how many run. */
export function Groups(p: GroupsProps) {
  const byCategory: Record<string, api.App[]> = {};
  for (const a of p.catalog.apps) if (a.kind !== 'helper' && matches(a, p.query)) (byCategory[a.category] ??= []).push(a);
  if (p.query && !Object.keys(byCategory).length) return <p class="muted empty">No app matches “{p.query}”. Add your own below.</p>;
  return (
    <>
      {p.catalog.categories.filter((c) => byCategory[c.id]).map((c) => {
        const apps = byCategory[c.id];
        const running = apps.filter((a) => p.status[a.id]?.state === 'running').length;
        return (
          <div class="group" key={c.id}>
            <h2>{c.label}<span class="n">{running} of {apps.length} running</span></h2>
            {apps.map((a) => <AppRow key={a.id} a={a} p={p} />)}
          </div>
        );
      })}
    </>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function List({ title, items, cls }: { title: string; items: preact.ComponentChildren[]; cls?: string }) {
  if (!items.length) return null;
  return <><h2>{title}</h2><ul class={cls}>{items.map((i, n) => <li key={n}>{i}</li>)}</ul></>;
}

export interface PlanProps {
  /** null before anything is ticked; a string when planning failed. */
  plan: api.Plan | string | null;
  appName: (id: string) => string;
  /** A skip's reason in plain words. */
  reason: (r: string) => string;
}

/**
 * The plan in a few lines: the apps that will start, what still needs a
 * setting, and anything wrong. Helpers (databases, queues), apps already
 * running, port moves, and settings written wait under Details.
 */
export function Plan({ plan: p, appName, reason }: PlanProps) {
  if (p === null) return <>Nothing selected yet. Pick something to start with, or tick an app.</>;
  if (typeof p === 'string') return <p class="bad">{p}</p>;
  const picked = p.start.filter((id) => !p.added[id]);
  const helpers = p.start.filter((id) => p.added[id]);
  const running = p.skips.filter((s) => /^already running/.test(s.reason));
  const quiet = p.skips.filter((s) => /^only needed by/.test(s.reason));
  // Apps that run on the computer itself (Jellyfin): installed by hand, or there already.
  const outside = p.skips.filter((s) => /^(runs natively|is installed on)/.test(s.reason));
  const needs = p.skips.filter((s) => !running.includes(s) && !quiet.includes(s) && !outside.includes(s));
  const lead = picked.length ? `Installs ${plural(picked.length, 'app', 'apps')}` + (helpers.length ? `, with ${plural(helpers.length, 'helper', 'helpers')} they need` : '') + '.' : '';
  const details = [
    { title: 'Helpers that start with them', items: helpers.map((id) => `${appName(id)} (for ${appName(p.added[id])})`) },
    { title: 'Port changes', items: p.portChanges.map((c) => `${c.var}: ${c.from} → ${c.to} (${c.reason})`) },
    { title: 'Settings written', items: p.envChanges.map((c) => (c.secret ? `${c.key} (hidden)` : `${c.key} = ${c.value}`)) },
  ].filter((d) => d.items.length);
  return (
    <>
      {lead && <p class="planLead">{lead}</p>}
      {!!picked.length && <ul class="ok planApps">{picked.map((id) => <li key={id}>{appName(id)}</li>)}</ul>}
      <List title="Waiting for a setting" cls="warn" items={needs.map((s) => <span><strong>{appName(s.app)}</strong>: {reason(s.reason)}</span>)} />
      <List title="Runs outside the homelab" items={outside.map((s) => <span><strong>{appName(s.app)}</strong> {reason(s.reason)}</span>)} />
      <List title="Problems" cls="bad" items={p.problems} />
      <List title="Worth knowing" cls="warn" items={p.warnings} />
      {!!running.length && <p class="muted small">Already running: {running.map((s) => appName(s.app)).join(', ')}.</p>}
      {!!details.length && (
        <details class="planDetails">
          <summary class="muted">Details</summary>
          {details.map((d) => <List key={d.title} title={d.title} items={d.items} />)}
        </details>
      )}
      {/* Install greys out when nothing would start; say why instead of leaving a blank button. */}
      {!p.start.length && <p id="nothingToInstall" class="muted">{needs.length ? 'Fill in the settings below to install the rest.' : 'Nothing left to install: everything you picked is already running.'}</p>}
    </>
  );
}

export interface InputsProps {
  keys: string[];
  /** What .env holds for each: its help, whether it is secret or set. */
  meta: Record<string, settings.Setting>;
  values: Record<string, string>;
  label: (key: string) => string;
  input: (key: string, value: string) => void;
}

/**
 * The settings the chosen apps need, by their names for people and with
 * their help (where to find a key, what it is for).
 */
export function Inputs({ keys, meta, values, label, input }: InputsProps) {
  return (
    <>
      {!!keys.length && <h2>Settings they need</h2>}
      {keys.map((k) => {
        const m: Partial<settings.Setting> = meta[k] || {};
        const secret = m.secret ?? /KEY|TOKEN|PASS|SECRET/.test(k);
        return (
          <label class="field" key={k}>
            <span class="fieldName">{label(k)}</span>
            <input type={secret ? 'password' : 'text'} value={values[k] || ''} autocomplete="off" spellcheck={false}
              placeholder={m.set ? 'set already · leave empty to keep it' : 'not set yet'} onInput={(e) => input(k, e.currentTarget.value)} />
            {m.help && <span class="help">{m.help}</span>}
          </label>
        );
      })}
    </>
  );
}

export const mountStarters = (el: Element, props: PicksProps) => render(<Starters {...props} />, el);
export const mountBundles = (el: Element, props: PicksProps) => render(<Bundles {...props} />, el);
export const mountGroups = (el: Element, props: GroupsProps) => render(<Groups {...props} />, el);
// The plan's box holds index.html's first words until the first plan;
// Preact renders beside what it did not render, so they go first.
const planned = new WeakSet<Element>();
export const mountPlan = (el: Element, props: PlanProps) => {
  if (!planned.has(el)) { el.replaceChildren(); planned.add(el); }
  render(<Plan {...props} />, el);
};
export const mountInputs = (el: Element, props: InputsProps) => render(<Inputs {...props} />, el);
/** Shows only why the catalog could not be read. */
export const catalogProblem = (el: Element, problem: string) => render(<p class="bad">{problem}</p>, el);
