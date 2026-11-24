// Settings' first page, as the redesign's picture (docs/images/redesign/computer-settings.png, redesign-loop R8): what
// the homelab is set to, a card each, and each card's › to its own page. The everyday switches work here as they do on
// their page: Automatic care's three and Alerts' one save at once.
import { render } from 'preact';
import { ago, never } from '../format';
import { Card, CardHead } from '../parts/Card';
import { Row, Rows } from '../parts/Row';

export interface GeneralProps {
  /** The household (Settings › People), or null while it's read or where it can't be. */
  people: people.Person[] | null;
  phones: companion.Phone[] | null;
  /** The .env settings as last read, by key. */
  values: Record<string, string | undefined>;
  /** The computer's name for itself: "This Mac". */
  machine: string;
  /** Storage and power in a few words ("412 GB free of 994 GB", "Plugged in"), when known. */
  storage?: string;
  power?: string;
  /** Opens a page of Settings by its name. */
  open: (page: string) => void;
  /** Saves one setting at once. */
  set: (key: string, value: string) => void;
  /** Pauses or resumes the nightly updates (as Status' Pause). */
  pauseUpdates: (paused: boolean) => void;
}

/** A setting that is on unless it says false (AUTO_HEAL, AUTO_ROLLBACK, DESKTOP_ALERTS). */
const onUnlessFalse = (v?: string) => !/^false$/i.test(v || '');

/** Quiet hours, 22-7, as "10 PM – 7 AM"; "Off" when empty. */
function quietWords(v?: string): string {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec((v || '').trim());
  if (!m) return v?.trim() ? v.trim() : 'Off';
  const h = (n: number) => (n % 12 || 12) + (n < 12 ? ' AM' : ' PM');
  return `${h(+m[1])} – ${h(+m[2])}`;
}

function Switch({ label, on, set }: { label: string; on: boolean; set: (on: boolean) => void }) {
  return <input type="checkbox" class="switch" role="switch" aria-label={label} checked={on} onChange={(e) => set(e.currentTarget.checked)} />;
}

const Letter = ({ name }: { name: string }) => <span class="genletter" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;

export function General(p: GeneralProps) {
  const v = p.values;
  const people = (p.people || []).filter((x) => never(x.removed));
  const phones = p.phones || [];
  const domain = (v.HOMELAB_DOMAIN || '').trim();
  return (
    <div class="genboard">
      <Card kind="gencard" id="genPeople">
        <CardHead title="People"><button type="button" class="small" onClick={() => p.open('People')}>Add a person</button></CardHead>
        {people.length ? <Rows kind="genrows">{people.slice(0, 4).map((x) => (
          <Row key={x.username} lead={<Letter name={x.name} />} title={x.name} sub={x.apps?.length ? `${x.apps.length} ${x.apps.length === 1 ? 'app' : 'apps'}` : 'Signs in with Pocket ID'}
            onOpen={() => p.open('People')} openLabel="open" />
        ))}</Rows> : <p class="gensub">Nobody added yet: each person gets a sign-in and a page of their apps.</p>}
      </Card>
      <Card kind="gencard" id="genPhones">
        <CardHead title="Phones"><button type="button" class="small" onClick={() => p.open('Phones')}>Pair a phone</button></CardHead>
        {phones.length ? <Rows kind="genrows">{phones.slice(0, 4).map((x) => (
          <Row key={x.id} lead={<Letter name={x.name} />} title={x.name}
            sub={[x.canChange ? 'Can make changes' : 'Looks only', x.personName ? `${x.personName}'s` : '', never(x.lastSeen) ? 'not seen yet' : `seen ${ago(x.lastSeen)}`].filter(Boolean).join(' · ')}
            onOpen={() => p.open('Phones')} openLabel="open" />
        ))}</Rows> : <p class="gensub">No phone paired yet: the Homelab app sees Status and Finances from anywhere.</p>}
      </Card>
      <Card kind="gencard" id="genCare">
        <CardHead title="Automatic care" />
        <Rows kind="genrows">
          <Row title="Update apps every night" sub="At 4:00 AM, each app backed up first" end={<Switch label="Update apps every night" on={!/^true$/i.test(v.UPDATES_PAUSED || '')} set={(on) => p.pauseUpdates(!on)} />} />
          <Row title="Restart an app that stops answering" sub="Checked every 15 minutes" end={<Switch label="Restart an app that stops answering" on={onUnlessFalse(v.AUTO_HEAL)} set={(on) => p.set('AUTO_HEAL', on ? 'true' : 'false')} />} />
          <Row title="Undo an update that breaks an app" sub="Puts the version before back by itself" end={<Switch label="Undo an update that breaks an app" on={onUnlessFalse(v.AUTO_ROLLBACK)} set={(on) => p.set('AUTO_ROLLBACK', on ? 'true' : 'false')} />} />
        </Rows>
      </Card>
      <Card kind="gencard" id="genAlerts">
        <CardHead title="Alerts" />
        <Rows kind="genrows">
          <Row title={`On ${p.machine}'s screen`} sub="A notification in the corner, as well as on your phones" end={<Switch label={`Alerts on ${p.machine}'s screen`} on={onUnlessFalse(v.DESKTOP_ALERTS)} set={(on) => p.set('DESKTOP_ALERTS', on ? 'true' : 'false')} />} />
          <Row title="Quiet hours" sub="Alerts arrive without a sound" end={<span class="muted">{quietWords(v.QUIET_HOURS)}</span>} onOpen={() => p.open('Notifications')} openLabel="open" />
        </Rows>
      </Card>
      <Card kind="gencard" id="genReach">
        <CardHead title="Reaching the apps" />
        <Rows kind="genrows">
          {domain
            ? <Row title="Your own domain" sub={`Addresses like photos.${domain}`} onOpen={() => p.open('Domain')} openLabel="open" />
            : <Row title="Home only" sub="Your phones and computers reach the apps through Tailscale, at home and away. Nothing is on the internet." />}
          {!domain && <Row title="Use your own domain" sub="Addresses like photos.yourname.com" end={<button type="button" class="small" onClick={() => p.open('Domain')}>Set it up…</button>} />}
        </Rows>
      </Card>
      <Card kind="gencard genmac" id="genMac">
        <CardHead title={p.machine} />
        <div class="gentiles">
          <button type="button" class="gentile" onClick={() => p.open(p.machine)}><strong>Storage</strong><span>{p.storage || 'Its disks and drives'}</span></button>
          <button type="button" class="gentile" onClick={() => p.open(p.machine)}><strong>Power</strong><span>{p.power || 'Keep awake, battery saver'}</span></button>
          <button type="button" class="gentile" onClick={() => p.open('Appearance')}><strong>Appearance</strong><span>Light, dark, or as {p.machine}</span></button>
          <button type="button" class="gentile" onClick={() => p.open(p.machine)}><strong>Advanced</strong><span>Each app's own settings, keys and tokens</span></button>
        </div>
      </Card>
    </div>
  );
}

export const mountGeneral = (el: Element, props: GeneralProps | null) => render(props && <General {...props} />, el);
