// Settings › Phones: the phones (and wall screens) paired with the phone
// companion (homelab serve), and a one-time code with its QR code to pair
// another.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ago } from '../format';
import { CardHead } from '../parts/Card';
import { Row, Rows } from '../parts/Row';

export interface PhonesActions {
  setCanChange: (id: string, can: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  pair: (name: string, canChange: boolean) => Promise<app.PhonePairing>;
  /** After pairing: the list again, with the new phone. */
  reload: () => void;
}

/** The code, its QR code, and the links, until Done. */
function Pairing({ p, done }: { p: app.PhonePairing; done: () => void }) {
  const links = p.links || [];
  return (
    <div id="pairing">
      <div class="pairing">
        {p.qr && <img src={p.qr} alt="QR code for pairing" width={180} height={180} />}
        <div>
          <p>Scan this with the phone’s camera, or open a link on the phone, then tap <strong>Pair</strong>. The code is <code>{p.code}</code> and works once, for 10 minutes.</p>
          <ul>{links.map((l) => <li key={l}><code>{l}</code></li>)}</ul>
          {p.off && <p class="bad">The phone companion is off (PHONE_COMPANION=false): turn it on below and save first.</p>}
          <p class="muted">Then, in Safari: Share › Add to Home Screen.</p>
          {links.some((l) => l.startsWith('http:')) && <p class="muted">A phone paired with the <code>http:</code> link (the home Wi-Fi, without encryption) can only look, so that nobody else on the Wi-Fi can copy its key and make changes. To make changes from a phone, pair it with an <code>https:</code> link.</p>}
          {!!links.length && <p class="muted">A TV or a wall screen pairs the same way, with <code>&amp;kiosk</code> at the end of the link (<code>{links[0] + '&kiosk'}</code>): it then shows Status only, large, without buttons, and stays on. A screen can never make changes, even with <strong>Can make changes</strong> ticked.</p>}
          <button class="small" onClick={done}>Done</button>
        </div>
      </div>
    </div>
  );
}

export function Phones({ phones, on }: { phones: companion.Phone[]; on: PhonesActions }) {
  const [name, setName] = useState('');
  const [canChange, setCanChange] = useState(false);
  const [pairing, setPairing] = useState<app.PhonePairing | null>(null);
  const pair = async () => { try { setPairing(await on.pair(name, canChange)); } catch { /* shown by app.ts */ } };
  return (
    <>
      <CardHead title="Phones"><span class="muted">{phones.length ? `${phones.length} paired` : 'none paired yet'}</span></CardHead>
      <p class="muted">Status and Backups on your phones, at home and on the tailnet (never on the internet). Each phone pairs once with a code; it can only look unless you let it make changes.</p>
      {!!phones.length && (
        <Rows>
          {phones.map((p) => (
            <Row key={p.id} dot={p.canChange ? 'warn' : 'ok'} title={p.name}
              sub={<>{p.canChange ? 'Can make changes' : p.unencrypted ? 'Looks only (paired over the home Wi-Fi, without encryption)' : 'Looks only'} · last seen {ago(p.lastSeen)}</>} end={<>
              {!p.unencrypted && <button class="small" title={p.canChange ? 'Only look from now on' : 'Let it start, stop, restart, update, and back up'} onClick={() => on.setCanChange(p.id, !p.canChange)}>{p.canChange ? 'Make read-only' : 'Allow changes'}</button>}
              <button class="small" title="Unpair it: it stops working at once" onClick={() => on.remove(p.id)}>Remove</button>
            </>} />
          ))}
        </Rows>
      )}
      <div class="inputrow pairrow">
        <input id="phoneName" placeholder="Name, e.g. Anna’s iPhone" autocomplete="off" spellcheck={false} value={name} onInput={(e) => setName(e.currentTarget.value)} />
        <label class="check"><input type="checkbox" id="phoneCanChange" checked={canChange} onChange={(e) => setCanChange(e.currentTarget.checked)} /> Can make changes</label>
        <button class="small" id="pairPhone" onClick={pair}>Pair a phone</button>
      </div>
      {pairing ? <Pairing p={pairing} done={() => { setPairing(null); on.reload(); }} /> : <div id="pairing" hidden />}
    </>
  );
}

export const mountPhones = (el: Element, props: { phones: companion.Phone[]; on: PhonesActions }) => render(<Phones {...props} />, el);
