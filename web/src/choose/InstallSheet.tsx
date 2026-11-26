import { render } from 'preact';
import { AppMark } from '../parts/AppMark';
import { Card, CardHead } from '../parts/Card';
import { type Crumb, Crumbs } from '../parts/Crumbs';
import { Sheet } from '../parts/Sheet';
import { Tile } from '../status/Tiles';
import { questions } from './questions';

export function CustomSheet({ close }: { close: () => void }) {
  return (
    <Sheet id="customSheet" titleId="customTitle" onClose={close}>
      <div class="row sheethead"><h2 id="customTitle">Add your own app</h2><button type="button" class="btn" onClick={close}>Close</button></div>
      <div id="customBody" />
    </Sheet>
  );
}

export interface StoreHeadProps {
  app?: api.App;
  set?: api.Preset;
  catalog: api.Catalog;
  icons?: Record<string, string>;
  /** Choose apps' lines for it: how it runs on this system, an app you run that does the same, one it goes with. */
  notes?: string[];
  /** Status, then the page it was opened from. */
  trail: Crumb[];
  /** A set's apps already here, by ID. */
  here?: string[];
  /** Opens another app's page (one it goes with, one of a set's). */
  open: (id: string) => void;
  /** Its note (AppGuide): what it's for, setup, everyday use; undefined while it's read. */
  guide?: docs.Guide;
  /** The subscriptions it replaces (SavingsRows' rows naming it). */
  offers?: savings.Offer[];
  /** Opens a web page (Learn more). */
  openURL?: (url: string) => void;
}

/** A note's line: `code` and **bold** kept, the rest as written. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return <>{parts.map((t, i) => t.startsWith('`') && t.endsWith('`') && t.length > 1 ? <code key={i}>{t.slice(1, -1)}</code>
    : t.startsWith('**') && t.endsWith('**') && t.length > 3 ? <strong key={i}>{t.slice(2, -2)}</strong> : t)}</>;
}

const money = (n: number) => '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** The page's head (#storeHead) and its facts (#storeFacts); the plan sits beside the facts (#storePlan). */
export function StoreHead(p: StoreHeadProps) { return <Store {...p} part="head" />; }
export function StoreFacts(p: StoreHeadProps) { return <Store {...p} part="facts" />; }
export function StoreNotes(p: StoreHeadProps) { return <Store {...p} part="notes" />; }
function Store({ app, set, catalog, icons, notes = [], trail, here = [], open, guide, offers = [], openURL, part }: StoreHeadProps & { part: 'head' | 'facts' | 'notes' }) {
  const name = (id: string) => catalog.apps.find((a) => a.id === id)?.name || id;
  if (set) {
    const apps = set.apps.map((id) => catalog.apps.find((a) => a.id === id)).filter(Boolean) as api.App[];
    if (part === 'head') return (
      <>
        <Crumbs trail={trail} here={set.name} />
        <div class="pagehead storehead">
          <div class="who">
            <span class="storemarks">{apps.slice(0, 4).map((a) => <AppMark key={a.id} id={a.id} name={a.name} icon={icons?.[a.id] || ''} />)}</span>
            <div><div class="titlerow"><h1>{set.name}</h1></div>{set.description && <p class="lead">{set.description}</p>}</div>
          </div>
        </div>
      </>
    );
    if (part === 'facts') return null;
    return (
      <>
        <ul class="storeapps card">
          {apps.map((a) => (
            <li key={a.id}><button type="button" class="storeapp" onClick={() => open(a.id)}>
              <AppMark id={a.id} name={a.name} icon={icons?.[a.id] || ''} small />
              <span><strong>{a.name}</strong><span class="muted">{here.includes(a.id) ? 'Already here' : a.description}</span></span>
            </button></li>
          ))}
        </ul>
      </>
    );
  }
  if (!app) return null;
  const cat = catalog.categories.find((c) => c.id === app.category)?.label || 'Your own';
  const goes = Object.entries(app.goesWith || {});
  const needs = (app.dependsOn || []).filter((d) => catalog.apps.find((a) => a.id === d)?.kind !== 'helper');
  // What the plan will ask: its settings and those of what it brings, and the plain questions asked for it.
  const keys = new Set([app, ...(app.dependsOn || []).map((d) => catalog.apps.find((a) => a.id === d))].flatMap((a) => a?.inputs || []));
  for (const [key, q] of Object.entries(questions)) if (q.apps.includes(app.id)) keys.add(key);
  const asks = keys.size;
  if (part === 'head') return (
    <>
      <Crumbs trail={trail} here={app.name} />
      <div class="pagehead storehead">
        <div class="who">
          <AppMark id={app.id} name={app.name} icon={icons?.[app.id] || ''} />
          <div>
            <div class="titlerow"><h1>{app.name}</h1><span class="pill">{app.kind === 'native' ? 'Runs natively' : 'Not installed'}</span></div>
            <p class="lead">{app.description}</p>
          </div>
        </div>
      </div>
    </>
  );
  if (part === 'facts') return (
    <>
      <div class="tiles facts storefacts">
        <Tile label="Kind" value={cat} sub={app.kind === 'native' ? 'Installed on this machine itself' : 'Runs in the homelab'} />
        <Tile label="Replaces" value={app.replaces?.length ? app.replaces[0] : <span class="muted">Nothing</span>} sub={app.replaces && app.replaces.length > 1 ? app.replaces.slice(1).join(', ') : ''} />
        <Tile label="Goes with" value={goes.length ? name(goes[0][0]) : needs.length ? name(needs[0]) : <span class="muted">Works alone</span>}
          sub={goes.length ? goes[0][1] : needs.length ? 'Installed with it' : ''} />
        <Tile label="Asks you" value={asks ? `${asks} ${asks === 1 ? 'thing' : 'things'}` : 'Nothing'} sub={asks ? 'Beside, before it installs' : 'Ready as it comes'} />
      </div>
    </>
  );
  const mine = offers.filter((o) => o.apps.includes(app.id));
  const yearly = mine.filter((o) => o.counted).reduce((t, o) => t + o.annual, 0);
  const g = guide || {};
  const facts = [
    g.memory ? `Uses about ${g.memory >= 1000 ? (g.memory / 1000).toFixed(1).replace(/\.0$/, '') + ' GB' : g.memory + ' MB'} of memory when busy.` : '',
    g.updates ? `Updates: ${g.updates}` : '',
  ].filter(Boolean);
  return (
    <>
      {g.purpose && g.purpose.length > 0 && (
        <Card kind="storenotes storeabout">
          <h2>What it does</h2>
          {g.purpose.length > 1
            ? <ul>{g.purpose.map((p) => <li key={p}><Rich text={p} /></li>)}</ul>
            : g.purpose.map((p) => <p key={p}><Rich text={p} /></p>)}
        </Card>
      )}
      {mine.length > 0 && (
        <Card kind="storenotes storesaves">
          <CardHead title="What it can replace">{yearly > 0 ? <span class="pill ok">Up to {money(yearly)} a year</span> : undefined}</CardHead>
          <ul class="saves">
            {mine.map((o) => (
              <li key={o.replaces + o.kind}>
                <span class="what"><strong>{o.replaces}</strong><span class="muted">{o.kind}</span></span>
                <span class="price">{money(o.monthly)}<span class="muted"> a month</span></span>
                {o.condition && <span class="cond muted">{o.condition}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {(notes.length > 0 || app.warning || goes.length > 1 || facts.length > 0) && (
        <Card kind="storenotes">
          <h2>To know</h2>
          <ul>
            {app.warning && <li class="warn">{app.warning}</li>}
            {notes.map((n) => <li key={n} class="aboutnote">{n}</li>)}
            {goes.slice(1).map(([id, why]) => <li key={id}>Goes with <button type="button" class="linkbtn" onClick={() => open(id)}>{name(id)}</button>: {why}</li>)}
            {facts.map((f) => <li key={f} class="guidefact"><Rich text={f} /></li>)}
          </ul>
        </Card>
      )}
      {g.everyday && g.everyday.length > 0 && (
        <Card kind="storenotes storeuse">
          <h2>Day to day</h2>
          <ul>{g.everyday.map((t) => <li key={t}><Rich text={t} /></li>)}</ul>
        </Card>
      )}
      {g.connects && g.connects.length > 0 && (
        <Card kind="storenotes storeworks">
          <h2>Works with</h2>
          <ul class="storeapps">
            {g.connects.map((l) => (
              <li key={l.id}><button type="button" class="storeapp" onClick={() => open(l.id!)}>
                <AppMark id={l.id!} name={l.label} icon={icons?.[l.id!] || ''} small />
                <span><strong>{name(l.id!)}</strong>{l.text && <span class="muted"><Rich text={l.text} /></span>}</span>
              </button></li>
            ))}
          </ul>
        </Card>
      )}
      {((g.setup && g.setup.length > 0) || (g.ideas && g.ideas.length > 0)) && (
        <Card kind="storenotes storedocs">
          {g.setup && g.setup.length > 0 && (
            <details open>
              <summary><h2>Setting it up</h2></summary>
              <ol>{g.setup.map((t) => <li key={t}><Rich text={t} /></li>)}</ol>
            </details>
          )}
          {g.ideas && g.ideas.length > 0 && (
            <details>
              <summary><h2>Ideas to try</h2></summary>
              <ul>{g.ideas.map((t) => <li key={t}><Rich text={t} /></li>)}</ul>
            </details>
          )}
        </Card>
      )}
      {g.learn && g.learn.length > 0 && (
        <div class="storelearn">
          <span class="muted">Learn more</span>
          {g.learn.map((l) => <a key={l.url} href={l.url} class="btn" onClick={(e) => { e.preventDefault(); openURL?.(l.url!); }}>{l.label}</a>)}
        </div>
      )}
    </>
  );
}

export const mountCustomSheet = (el: Element, close: () => void) => render(<CustomSheet close={close} />, el);
export function mountStore(head: Element, facts: Element, notes: Element, p: StoreHeadProps | null) {
  render(p && <StoreHead key={p.app?.id || p.set?.id} {...p} />, head);
  render(p && <StoreFacts key={p.app?.id || p.set?.id} {...p} />, facts);
  render(p && <StoreNotes key={p.app?.id || p.set?.id} {...p} />, notes);
}
