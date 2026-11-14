// After an install on Choose apps: the apps ready to open, and the links
// the wiring made between them; and the categories a custom app can take.
import { render } from 'preact';
import { ActionLink } from '../ActionLink';
import { CardHead } from '../parts/Card';

/** The apps an install started, each opening in the browser, and Close, which takes the finished install away. */
export interface AlsoStarted { name: string; what: string; by: string }

export function Started({ started, also = [], open, close }: { started: api.Started[]; also?: AlsoStarted[]; open: (url: string) => void; close: () => void }) {
  return (
    <>
      <CardHead title="Ready to open" />
      {started.length
        ? <ul>{started.map((s) => <li key={s.id}>{s.url ? <ActionLink onClick={() => open(s.url!)}>{s.name}</ActionLink> : s.name}{s.next && <div class="muted startednext">{s.next}</div>}</li>)}</ul>
        : <p class="muted">Nothing new to start.</p>}
      {/* What started with them, so nothing installed goes unsaid. */}
      {!!also.length && <p class="muted" id="alsoStarted">{also.map((x) => `With ${x.by}: ${x.name}, ${x.what.charAt(0).toLowerCase() + x.what.slice(1)}.`).join(' ')}</p>}
      <button type="button" id="installClose" class="small" onClick={close}>Close</button>
    </>
  );
}

/** One link the wiring made (internal/wiring), as it reports it. */
export interface WireLink { state: string; text: string; detail?: string }
const marks: Record<string, [string, string]> = { done: ['✓', 'ok'], already: ['✓', 'ok'], manual: ['!', 'warn'], failed: ['✗', 'bad'] };

/** Connected for you: each link as it finishes, with what is still going on. */
export function Wiring({ links, note }: { links: WireLink[]; note: string }) {
  return (
    <>
      <CardHead title="Connected for you" />
      <p class="muted">{note}</p>
      <ul class="links">
        {links.map((l, i) => {
          const [mark, cls] = marks[l.state] || ['•', 'muted'];
          return <li key={i}><span class={cls}>{mark} </span>{l.text}{l.detail && <span class="detail">{l.detail}</span>}</li>;
        })}
      </ul>
    </>
  );
}

export function mountStarted(el: Element, props: { started: api.Started[]; also?: AlsoStarted[]; open: (url: string) => void; close: () => void } | null) { render(props && <Started {...props} />, el); }
export function mountWiring(el: Element, props: { links: WireLink[]; note: string } | null) { render(props && <Wiring {...props} />, el); }
/** The categories, as the custom app form's options. */
export function mountCategories(el: Element, categories: api.Category[]) { render(<>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</>, el); }
