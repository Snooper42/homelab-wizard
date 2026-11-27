// After an install on Choose apps: the apps ready to open, and the links
// the wiring made between them; and the categories a custom app can take.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { CardHead } from '../parts/Card';
import { AppMark } from '../parts/AppMark';

/** The apps an install started, each opening in the browser, and Close, which takes the finished install away. */
export interface AlsoStarted { name: string; what: string; by: string }

export function Started({ started, also = [], open, close }: { started: api.Started[]; also?: AlsoStarted[]; open: (url: string) => void; close: () => void }) {
  return (
    <>
      <CardHead title="Ready to open" />
      {started.length
        ? <ul>{started.map((s) => <li key={s.id}><AppMark id={s.id} name={s.name} icon="" small />{s.url ? <ActionLink onClick={() => open(s.url!)}>{s.name}</ActionLink> : s.name}{s.next && <div class="muted startednext">{s.next}</div>}</li>)}</ul>
        : <p class="muted">Nothing new to start.</p>}
      {/* What started with them, so nothing installed goes unsaid. */}
      {!!also.length && <p class="muted" id="alsoStarted">{also.map((x) => `With ${x.by}: ${x.name}, ${x.what.charAt(0).toLowerCase() + x.what.slice(1)}.`).join(' ')}</p>}
      <button type="button" id="installClose" class="small" onClick={close}>Close</button>
    </>
  );
}

/** One link the wiring made (internal/wiring), as it reports it. */
export interface WireLink { state: string; text: string; detail?: string; fix?: string }
/** A link's one-click fix (wiring.Link.Fix), by its name: the button's words. */
const fixes: Record<string, string> = { 'inbox-arrive': 'Let Library file downloads as they arrive', 'seerr-signin': 'Sign Seerr in', 'qbit-password': 'Give qBittorrent the password in Settings' };

function SeerrSignIn({ send }: { send: (user: string, password: string) => void }) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  return (
    <form class="detail wireForm" onSubmit={(e) => { e.preventDefault(); if (!user.trim()) return; const p = password; setPassword(''); send(user.trim(), p); }}>
      <label>A Jellyfin administrator <input type="text" autocomplete="username" spellcheck={false} value={user} onInput={(e) => setUser(e.currentTarget.value)} /></label>
      <label>Password <input type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword(e.currentTarget.value)} /></label>
      <button type="submit" class="small tint" disabled={!user.trim()}>{fixes['seerr-signin']}</button>
      <span class="muted small">Used once to set Seerr up, never saved.</span>
    </form>
  );
}
const marks: Record<string, [string, string]> = { done: ['✓', 'ok'], already: ['✓', 'ok'], manual: ['!', 'warn'], failed: ['✗', 'bad'] };

/** Connected for you: each link as it finishes, with what is still going on. */
export function Wiring({ links, note, fix, close }: { links: WireLink[]; note: string; fix?: (name: string, user?: string, password?: string) => void; close?: () => void }) {
  const finished = !note;
  const fine = links.filter((l) => l.state === 'done' || l.state === 'already');
  const fold = finished && fine.length > 0;
  const shown = fold ? links.filter((l) => !fine.includes(l)) : links;
  const item = (l: WireLink, i: number) => {
    const [mark, cls] = marks[l.state] || ['•', 'muted'];
    return (
      <li key={i}>
        <span class={cls}>{mark} </span>{l.text}{l.detail && <span class="detail">{l.detail}</span>}
        {l.fix === 'seerr-signin' && fix && <SeerrSignIn send={(u, p) => fix(l.fix, u, p)} />}
        {l.fix && l.fix !== 'seerr-signin' && fixes[l.fix] && fix && links.find((x) => x.fix === l.fix) === l && <span class="detail"><button type="button" class="small tint" onClick={() => fix(l.fix)}>{fixes[l.fix]}</button></span>}
      </li>
    );
  };
  return (
    <>
      <CardHead title="Connected for you">{finished && close ? <button type="button" class="small" onClick={close}>Done</button> : undefined}</CardHead>
      <p class="muted">{note}</p>
      {fold && (
        <details class="okLinks">
          <summary><span class="ok">✓ </span>{fine.length} connected</summary>
          <ul class="links">{fine.map(item)}</ul>
        </details>
      )}
      {!!shown.length && <ul class="links">{shown.map(item)}</ul>}
    </>
  );
}

export function mountStarted(el: Element, props: { started: api.Started[]; also?: AlsoStarted[]; open: (url: string) => void; close: () => void } | null) { render(props && <Started {...props} />, el); }
export function mountWiring(el: Element, props: { links: WireLink[]; note: string; fix?: (name: string, user?: string, password?: string) => void; close?: () => void } | null) { render(props && <Wiring {...props} />, el); }
/** The categories, as the custom app form's options. */
export function mountCategories(el: Element, categories: api.Category[]) { render(<>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</>, el); }
