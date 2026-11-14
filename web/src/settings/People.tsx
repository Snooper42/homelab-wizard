// Settings › People: the household, each with a Pocket ID sign-in and a
// welcome page (homelab person). Adding someone needs Pocket ID running.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { CardHead } from '../parts/Card';
import { Row, Rows } from '../parts/Row';

export interface PeopleActions {
  /** homelab person add|welcome|password|remove, its lines into the log; false when it failed. */
  act: (action: string, who: string, email?: string, apps?: string[]) => Promise<boolean>;
  openWelcome: (username: string) => void;
  /** Their sheet for the fridge: their apps, no sign-in link or password. */
  openSheet: (username: string) => void;
  installPocket: () => void;
  /** After adding someone: the list again, and the note on how to hand them their welcome page. */
  added: (name: string) => void;
  /** The note read: it goes. */
  doneAdding: () => void;
  reload: () => void;
}

export interface PeopleProps {
  people: people.Person[];
  /** Pocket ID runs: people can be added. */
  pocket: boolean;
  /** The apps someone can be given: running ones with an address. */
  apps: { id: string; name: string }[];
  /** What the last command printed. */
  log: string;
  /** Who keeps their Finances private, and when they last saved them (username → RFC 3339): all the computer knows of them. */
  privateFinances?: Record<string, string>;
  /** Just added: the note that says so, and how their welcome page reaches them. */
  justAdded?: { name: string; username: string };
  on: PeopleActions;
}

const active = (p: people.Person) => !p.removed || p.removed.startsWith('0001');

/** "Keeps their Finances private (last saved Nov 13)", for a member whose Finances only their phone opens. */
function privately(at: string | undefined) {
  if (at === undefined) return '';
  const d = new Date(at);
  return `Keeps their Finances private${isNaN(d.getTime()) ? '' : ` (last saved ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`}`;
}

function Person({ p, on, sealed }: { p: people.Person; on: PeopleActions; sealed?: string }) {
  const [busy, setBusy] = useState('');
  const [sure, setSure] = useState(false);
  const run = async (action: string) => {
    setBusy(action);
    const ok = await on.act(action, p.username);
    setBusy('');
    return ok;
  };
  const apps = p.apps || [];
  return (
    <Row dot="ok" title={p.name} sub={[p.email, apps.length ? `${apps.length} app${apps.length === 1 ? '' : 's'}` : 'every app', privately(sealed)].filter(Boolean).join(' · ')} end={<>
      <button class="small" title="Open their welcome page, to print or send" onClick={() => on.openWelcome(p.username)}>Welcome page</button>
      <button class="small" title="A new sign-in link (the old one stops working) and a fresh welcome page" disabled={busy === 'welcome'}
        onClick={async () => { if (await run('welcome')) on.openWelcome(p.username); }}>New sign-in link</button>
      <button class="small" title="A new password for their Jellyfin and Navidrome accounts (Infuse and music apps), on a fresh welcome page" disabled={busy === 'password'}
        onClick={async () => { if (await run('password')) on.openWelcome(p.username); }}>Reset password</button>
      <button class="small danger" title={'Turn their sign-in off; their photos, documents, and the rest stay' + (sealed !== undefined ? '. Their private Finances stay too: you can delete them, but never open them' : '')} disabled={busy === 'remove'}
        onClick={async () => { if (!sure) { setSure(true); return; } if (await run('remove')) on.reload(); }}>{sure ? 'Click again to remove' : 'Remove'}</button>
    </>} />
  );
}

/**
 * After Add them (usability task 7, item 13): who was added, and ways to
 * hand them their welcome page: on this screen, where they scan their
 * sign-in with their phone's camera; or printed. It holds their sign-in
 * link (and the music and films password), so it is theirs alone: what to
 * email or hang up is the fridge sheet, which has neither.
 */
function Added({ who, on }: { who: { name: string; username: string }; on: PeopleActions }) {
  return (
    <div id="personAdded" class="addednote" role="status">
      <p><strong>{who.name} is added.</strong> Next, hand them their welcome page: it has their sign-in and the apps they use.</p>
      <div class="actions">
        <button class="small primary" onClick={() => on.openWelcome(who.username)}>Show their sign-in to scan</button>
        <button class="small" onClick={() => on.openSheet(who.username)}>Open the fridge sheet</button>
        <button class="small" onClick={on.doneAdding}>Done</button>
      </div>
      <p class="muted">The welcome page opens here, on this computer: they scan its code with their phone's camera, or you print it for them. It's for them alone, as it holds their sign-in link and their music and films password, so don't email it. To send something, send the fridge sheet: their apps with a code each, and neither of those.</p>
    </div>
  );
}

function AddPerson({ apps, open, on }: { apps: { id: string; name: string }[]; open: boolean; on: PeopleActions }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const toggle = (id: string, on: boolean) => setPicked((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const add = async () => {
    const who = name.trim();
    if (!who) { (document.getElementById('personName') as HTMLInputElement | null)?.focus(); return; }
    setBusy(true);
    const ok = await on.act('add', who, email.trim(), apps.map((a) => a.id).filter((id) => picked.has(id)));
    setBusy(false);
    if (ok) on.added(who);
  };
  return (
    <details class="addperson" open={open}>
      <summary><strong>Add a person</strong></summary>
      <div class="inputrow">
        <input id="personName" placeholder="Name, e.g. Anna Smith" autocomplete="off" spellcheck={false} value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <input id="personEmail" type="email" placeholder="Email (optional)" autocomplete="off" spellcheck={false} value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
      </div>
      {!!apps.length && (
        <div class="picks">
          <div class="muted small">The apps they use (none ticked: all of them)</div>
          {apps.map((a) => <label key={a.id} class="check"><input type="checkbox" value={a.id} checked={picked.has(a.id)} onChange={(e) => toggle(a.id, e.currentTarget.checked)} /> {a.name}</label>)}
        </div>
      )}
      <button class="small primary" id="addPerson" disabled={busy} onClick={add}>Add them</button>
    </details>
  );
}

export function People({ people, pocket, apps, log, on, privateFinances, justAdded }: PeopleProps) {
  const here = people.filter(active);
  const head = <CardHead title="People"><span class="muted">{here.length ? `${here.length} in the household` : 'just you so far'}</span></CardHead>;
  const why = <p class="muted">Each person gets one sign-in for the apps (with a passkey, no password to remember) and a welcome page with their apps and the phone apps to install. Jellyfin and Navidrome have a password of their own, for Infuse and music apps: with their keys in Settings, the homelab makes those accounts too, and Reset password gives a new one.</p>;
  if (!pocket) {
    return (
      <>
        {head}{why}
        <div class="row">
          <span class="muted">Adding people uses Pocket ID, the household’s sign-in.</span>
          <button class="small" id="installPocket" onClick={on.installPocket}>Install Pocket ID</button>
        </div>
      </>
    );
  }
  return (
    <>
      {head}{why}
      {justAdded && <Added who={justAdded} on={on} />}
      {!!here.length && <Rows>{here.map((p) => <Person key={p.username} p={p} on={on} sealed={privateFinances?.[p.username]} />)}</Rows>}
      <AddPerson apps={apps} open={!here.length} on={on} />
      <pre id="peopleLog" hidden={!log}>{log}</pre>
    </>
  );
}

export const mountPeople = (el: Element, props: PeopleProps) => render(<People {...props} />, el);
