// After an install on Choose stacks: the apps ready to open, and the links
// the wiring made between them; and the categories a custom app can take.
import { render } from 'preact';
import { ActionLink } from '../ActionLink';
import { CardHead } from '../parts/Card';

/** The apps an install started, each opening in the browser. */
export function Started({ started, open }: { started: api.Started[]; open: (url: string) => void }) {
  return (
    <>
      <CardHead title="Ready to open" />
      {started.length
        ? <ul>{started.map((s) => <li key={s.id}>{s.url ? <ActionLink onClick={() => open(s.url!)}>{s.name}</ActionLink> : s.name}</li>)}</ul>
        : <p class="muted">Nothing new to start.</p>}
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

export function mountStarted(el: Element, props: { started: api.Started[]; open: (url: string) => void }) { render(<Started {...props} />, el); }
export function mountWiring(el: Element, props: { links: WireLink[]; note: string }) { render(<Wiring {...props} />, el); }
/** The categories, as the custom app form's options. */
export function mountCategories(el: Element, categories: api.Category[]) { render(<>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</>, el); }
