import { render, type ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Sheet } from '../parts/Sheet';

/** The command sheet: a command's title, its job's bar and apps, its log, and its buttons (jobs.ts). */
function CommandSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet id="cliPanel" titleId="cliTitle" onClose={onClose}>
      <h2 id="cliTitle" aria-live="polite"></h2>
      <div id="cliProgress" class="progress" hidden><div class="track"><span class="fill"></span></div><p class="step" aria-live="polite"></p></div>
      <div id="cliApps" aria-live="polite"></div>
      <p id="cliPlan" class="jobplan" aria-live="polite" hidden></p>
      <details id="cliDetails" class="jobdetails" open><summary>Show details</summary><pre id="cliLog" role="log"></pre></details>
      <div id="cliActions" class="actions"></div>
    </Sheet>
  );
}

/** Draws the command sheet, closed, once at start; closed is called when it closes. */
export function mountSheets(el: Element, closed: () => void) { render(<CommandSheet onClose={closed} />, el); }

export interface SheetButton {
  label: string;
  primary?: boolean;
  title?: string;
  /** A button whose click starts something waits until it is done. */
  onClick: () => void | Promise<void>;
}

/** A row of buttons; one that starts something is disabled while it runs. */
export function Buttons({ buttons }: { buttons: SheetButton[] }) {
  const [running, setRunning] = useState(-1);
  return (
    <>
      {buttons.map((b, i) => (
        <button key={b.label} class={b.primary ? 'primary small' : 'small'} title={b.title} disabled={running === i}
          onClick={async () => { setRunning(i); try { await b.onClick(); } finally { setRunning(-1); } }}>{b.label}</button>
      ))}
    </>
  );
}

export interface PhoneCodeProps {
  /** The app's address, https://… */
  url: string;
  /** The QR code, as an image the Go side drew. */
  img: string;
  /** On the tailnet: the phone needs Tailscale. */
  tailnet: boolean;
  /** The app's own phone app, if it has one. */
  phoneApp?: string;
  close: () => void;
}

/** Open on a phone: the address as a QR code for the phone's camera. */
export function PhoneCode({ url, img, tailnet, phoneApp, close }: PhoneCodeProps) {
  return (
    <div class="pairing">
      <img src={img} alt={`QR code for ${url}`} width={180} height={180} />
      <div>
        <p>Point the phone’s camera at the code and tap the link. <code>{url}</code></p>
        <p class="muted">{tailnet ? 'The phone needs the Tailscale app, signed in to the same tailnet; then it works at home and away.' : 'The phone needs to be on the home Wi-Fi (or on Tailscale away from home).'}</p>
        {phoneApp && <p class="muted">Its phone app: {phoneApp}.</p>}
        <button class="small" onClick={close}>Close</button>
      </div>
    </div>
  );
}

export interface SignInRow {
  label: string;
  /** What shows: the value, dots for a secret, or "not set". */
  shown: string;
  /** Copies it (a secret straight to the clipboard, never the page); none when it is not set. Rejects with why. */
  copy?: () => Promise<void>;
  /** A password or key: ticked Saved once it is in the password manager (by its name, never its value). */
  kept?: boolean;
  keep?: (saved: boolean) => Promise<void>;
}

/** One kind of detail, by what a person does with it. */
export interface SignInGroup {
  title: string;
  /** Said under the title (Keep safe's warning). */
  note?: string;
  rows: SignInRow[];
}

/** Sign-in details: the address, then each detail under what it's for,
 * with Copy. A copy shows on the button itself: a highlight and a small
 * bounce (none with Reduce Motion), then where to paste it. */
export function SignIns({ address, groups, empty, close }: { address?: SignInRow; groups: SignInGroup[]; empty?: string; close: () => void }) {
  const [copied, setCopied] = useState('');
  const [why, setWhy] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(''), 4000);
    return () => clearTimeout(t);
  }, [copied]);
  const row = (r: SignInRow, id: string) => (
    <div class="signin" key={id}>
      <span class="muted">{r.label}</span>
      <strong>{r.shown}</strong>
      {r.copy && <button class={'small copybtn' + (copied === id ? ' copied' : '')} aria-live="polite"
        onClick={async () => { try { await r.copy!(); setWhy((w) => ({ ...w, [id]: '' })); setCopied(id); setDone((d) => new Set(d).add(id)); } catch (e) { setWhy((w) => ({ ...w, [id]: errorWords(e) })); } }}>
        {copied === id ? 'Copied. Paste it into Proton Pass' : 'Copy'}</button>}
      {why[id] && <span class="signinwhy muted" role="status">{why[id]}</span>}
      {/* Offered once it is copied, or already ticked: a quiet tick, kept by name. */}
      {r.keep && (r.kept || done.has(id) || ticked[id] !== undefined) && (
        <label class="signinkept muted">
          <input type="checkbox" checked={ticked[id] ?? !!r.kept}
            onChange={async (e) => { const on = e.currentTarget.checked; setTicked((t) => ({ ...t, [id]: on })); try { await r.keep!(on); } catch (err) { setTicked((t) => ({ ...t, [id]: !on })); setWhy((w) => ({ ...w, [id]: errorWords(err) })); } }} />
          Saved in Proton Pass
        </label>
      )}
    </div>
  );
  return (
    <>
      <div class="signins">
        {address && row(address, 'address')}
        {groups.map((g) => (
          <div class="signingroup" key={g.title}>
            <h4>{g.title}</h4>
            {g.note && <p class="muted">{g.note}</p>}
            {g.rows.map((r) => row(r, g.title + '/' + r.label))}
          </div>
        ))}
        {empty && <p class="muted signinempty">{empty}</p>}
      </div>
      {copied && copied !== 'address' && <span class="muted">The clipboard clears in 90 seconds.</span>}
      <button class="small" onClick={close}>Close</button>
    </>
  );
}

const errorWords = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error: /, '');

/** Mounts what an action row holds (null empties it). */
export function mountSheet(el: Element, node: ComponentChildren) { render(<>{node}</>, el); }
