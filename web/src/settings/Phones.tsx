// Settings › Phones: the phones (and wall screens) paired with the phone
// companion (homelab serve), what each may do (make changes; see or change
// Finances), and a one-time code with its QR code to pair another.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ago, clockText, dayText } from '../format';
import { CardHead } from '../parts/Card';
import { Row, Rows } from '../parts/Row';

export interface PhonesActions {
  setCanChange: (id: string, can: boolean) => Promise<void>;
  /** "" hides Finances from the phone, "card" shows only the money card (a wall screen), "view" shows them, "edit" lets it change them. */
  setFinances: (id: string, level: string) => Promise<void>;
  /** Ends its changes and Finances in hours from now; 0: until you change it. */
  setUntil: (id: string, hours: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  pair: (name: string, canChange: boolean, finances: string) => Promise<app.PhonePairing>;
  /** After pairing: the list again, with the new phone. */
  reload: () => void;
}

const financesChoices: [string, string][] = [['', 'No Finances'], ['view', 'Sees Finances'], ['edit', 'Changes Finances']];
// A screen paired already may show the money card on its Status: the next payday, what is left after it, the next 3 bills.
const pairedChoices: [string, string][] = [['', 'No Finances'], ['card', 'Money card only'], ['view', 'Sees Finances'], ['edit', 'Changes Finances']];

/** What a phone may do on Finances, as a pick; a phone paired without encryption gets none. */
function FinancesPick({ value, set, label, id, paired }: { value: string; set: (level: string) => void; label: string; id?: string; paired?: boolean }) {
  return <select id={id} class="finpick" aria-label={label} value={value} onChange={(e) => set(e.currentTarget.value)}>{(paired ? pairedChoices : financesChoices).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;
}

// How long a phone keeps more than looking: a guest's phone for a week, say.
const untilChoices: [number, string][] = [[0, 'Until you change it'], [24, 'For a day'], [24 * 7, 'For a week'], [24 * 30, 'For a month']];

/** When a phone's changes and Finances end: "Thu, Nov 12, 3:00 PM". */
const untilText = (t: string) => { const d = new Date(t); return `${dayText(d, { weekday: 'short', month: 'short', day: 'numeric' })}, ${clockText(d)}`; };

/**
 * The code, its QR code, and the link to use, until Done: for a phone, or
 * for a TV or a wall screen (its own QR code, the link with &kiosk in it, so
 * nothing is typed onto a link). asked is what was picked for the phone.
 */
function Pairing({ p, wall, asked, done }: { p: app.PhonePairing; wall: boolean; asked: { canChange: boolean; finances: string }; done: () => void }) {
  const links = p.links || [];
  const secure = links.find((l) => l.startsWith('https:'));
  const wifi = links.find((l) => l.startsWith('http:'));
  const use = links[0] ? links[0] + (wall ? '&kiosk' : '') : '';
  // With no secure link the phone pairs over the home Wi-Fi, so it can only
  // look, without Finances: say so when something more was picked for it.
  const onlyLooks = !wall && !!links.length && !secure && (asked.canChange || !!asked.finances);
  const qr = wall ? p.wallQR : p.qr;
  return (
    <div id="pairing" data-kind={wall ? 'wall' : 'phone'}>
      <div class="pairing">
        {qr && <img src={qr} alt={wall ? 'QR code for pairing a wall screen' : 'QR code for pairing a phone'} width={180} height={180} />}
        <div>
          {wall
            ? <p id="pairSay">Scan this with the TV’s or the wall screen’s camera, or open the link below in its browser, then tap <strong>Pair</strong>. It shows Status only, large, without buttons, and stays on. It never makes changes or shows Finances.</p>
            : <p id="pairSay">Scan this with the phone’s camera, then tap <strong>Pair</strong>. Then, in Safari: Share › Add to Home Screen.</p>}
          {use && <p class="pairuse">The link to use{qr ? ' (the QR code holds it)' : ''}: <code>{use}</code></p>}
          <p class="muted">It works once, for 10 minutes. The code in it is <code>{p.code}</code>.</p>
          {onlyLooks && <p class="warn" id="pairOnlyLooks">This phone will only look, without Finances, whatever is picked: there is no secure link yet, so it pairs over the home Wi-Fi. Set up your domain in Setup first to give it more.</p>}
          {p.off && <p class="bad">The phone companion is off: turn it on below and save first.</p>}
          {secure && wifi && (
            <details class="pairwifi">
              <summary>If {wall ? 'the screen' : 'the phone'} can’t open it</summary>
              <p class="muted">Use the home Wi-Fi link instead: <code>{wifi + (wall ? '&kiosk' : '')}</code>. {wall ? 'A screen' : 'A phone'} paired with it can only look, and never sees Finances, so nobody else on the Wi-Fi can copy what it signs in with or read your money.</p>
            </details>
          )}
          {wall && <p class="muted">Once it’s paired, <strong>Money card only</strong> beside it puts the next payday, what’s left after it, and the next 3 bills on its Status (their amounts hidden while Finances hides them).</p>}
          <button class="small" onClick={done}>Done</button>
        </div>
      </div>
    </div>
  );
}

/** It may do more than look (make changes, or see Finances beyond the money card): that is what can end. */
const more = (p: companion.Phone) => p.canChange || p.finances === 'view' || p.finances === 'edit';

export function Phones({ phones, on }: { phones: companion.Phone[]; on: PhonesActions }) {
  const [name, setName] = useState('');
  const [canChange, setCanChange] = useState(false);
  const [finances, setFinances] = useState('');
  const [pairing, setPairing] = useState<app.PhonePairing | null>(null);
  const [wall, setWall] = useState(false);
  // A wall screen pairs to look only, without Finances, whatever is picked for a phone.
  const pair = async (screen: boolean) => {
    try { setWall(screen); setPairing(await on.pair(name || (screen ? 'Wall screen' : ''), screen ? false : canChange, screen ? '' : finances)); } catch { /* shown by app.ts */ }
  };
  return (
    <>
      <CardHead title="Phones"><span class="muted">{phones.length ? `${phones.length} paired` : 'none paired yet'}</span></CardHead>
      <p class="muted">Status and Backups on your phones, at home and on your own private network (never on the internet). Each pairs once; it can only look unless you let it make changes, and it sees Finances only if you pick that for it.</p>
      {!!phones.length && (
        <Rows>
          {phones.map((p) => (
            <Row key={p.id} dot="ok" title={p.name}
              sub={<>{p.canChange ? 'Can make changes' : p.unencrypted ? 'Looks only (paired over the home Wi-Fi)' : 'Looks only'}{p.finances === 'edit' ? ' · changes Finances' : p.finances === 'view' ? ' · sees Finances' : p.finances === 'card' ? ' · shows the money card' : ''}{p.until && more(p) ? <span class="phoneuntil">, until {untilText(p.until)}, then it only looks</span> : ''} · last seen {ago(p.lastSeen)}</>} end={<>
              {/* The same controls on every phone, in the same places: what it may do, Finances, for how long, Remove. */}
              {!p.unencrypted && (
                <select class="changepick" aria-label={`What ${p.name} may do`} value={p.canChange ? 'change' : 'look'} onChange={(e) => on.setCanChange(p.id, e.currentTarget.value === 'change')}>
                  <option value="look">Looks only</option>
                  <option value="change">Can make changes</option>
                </select>
              )}
              {!p.unencrypted && <FinancesPick paired value={p.finances || ''} set={(level) => on.setFinances(p.id, level)} label={`Finances on ${p.name}`} />}
              {!p.unencrypted && (
                <select class="untilpick" aria-label={`How long ${p.name} keeps it`} value={p.until && more(p) ? 'set' : '0'} disabled={!more(p)}
                  title={more(p) ? undefined : 'Only for a phone that may make changes or see Finances'} onChange={(e) => on.setUntil(p.id, Number(e.currentTarget.value))}>
                  {p.until && more(p) && <option value="set" disabled>Until {untilText(p.until)}</option>}
                  {untilChoices.map(([h, t]) => <option key={h} value={String(h)}>{t}</option>)}
                </select>
              )}
              <button class="small" title="Unpair it: it stops working at once" onClick={() => on.remove(p.id)}>Remove</button>
            </>} />
          ))}
        </Rows>
      )}
      <div class="inputrow pairrow">
        <input id="phoneName" placeholder="Name, e.g. Anna’s iPhone" autocomplete="off" spellcheck={false} value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <label class="check"><input type="checkbox" id="phoneCanChange" checked={canChange} onChange={(e) => setCanChange(e.currentTarget.checked)} /> Can make changes</label>
        <FinancesPick id="phoneFinances" value={finances} set={setFinances} label="Finances on the new phone" />
        <button class="small" id="pairPhone" onClick={() => pair(false)}>Pair a phone</button>
        <button class="small" id="pairWall" onClick={() => pair(true)}>Pair a wall screen</button>
      </div>
      {pairing ? <Pairing p={pairing} wall={wall} asked={{ canChange, finances }} done={() => { setPairing(null); on.reload(); }} /> : <div id="pairing" hidden />}
    </>
  );
}

export const mountPhones = (el: Element, props: { phones: companion.Phone[]; on: PhonesActions }) => render(<Phones {...props} />, el);
