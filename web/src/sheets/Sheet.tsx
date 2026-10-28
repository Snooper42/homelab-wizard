// The command sheet and the log sheet, and what goes in their action rows:
// their buttons, an app's address as a QR code for a phone, and its sign-in
// details. screens/status.ts opens the sheets (#cliPanel and #logPanel)
// and mounts one of these in them.
import { render, type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { CardHead } from '../parts/Card';
import { Sheet } from '../parts/Sheet';

/** The command sheet: a command's title, its job's bar and apps, its log, and its buttons (jobs.ts). */
function CommandSheet() {
  return (
    <Sheet id="cliPanel" titleId="cliTitle">
      <h2 id="cliTitle" aria-live="polite"></h2>
      <div id="cliProgress" class="progress" hidden><div class="track"><span class="fill"></span></div><p class="step" aria-live="polite"></p></div>
      <div id="cliApps" aria-live="polite"></div>
      <details id="cliDetails" class="jobdetails" open><summary>Show details</summary><pre id="cliLog" role="log"></pre></details>
      <div id="cliActions" class="actions"></div>
    </Sheet>
  );
}

/** The log sheet: the end of an app's log, Explain this, and its buttons. */
function LogSheet() {
  return (
    <Sheet id="logPanel" titleId="logTitle">
      <CardHead id="logTitle" title=""><span class="actions" id="logActions"></span></CardHead>
      <div id="logExplain" hidden></div>
      <pre id="logText" role="log"></pre>
    </Sheet>
  );
}

/** Draws both sheets, closed, once at start. */
export function mountSheets(el: Element) { render(<><CommandSheet /><LogSheet /></>, el); }

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
  /** Copies it and says what was copied; none when it is not set. */
  copy?: () => Promise<string>;
}

/** Sign in: each detail with Copy; a password is copied, never shown. */
export function SignIns({ rows, close }: { rows: SignInRow[]; close: () => void }) {
  const [note, setNote] = useState('');
  return (
    <>
      <div class="signins">
        {rows.map((r) => (
          <div class="signin" key={r.label}>
            <span class="muted">{r.label}</span>
            <strong>{r.shown}</strong>
            {r.copy && <button class="small" onClick={async () => { try { setNote(await r.copy!()); } catch { /* app.ts says why */ } }}>Copy</button>}
          </div>
        ))}
      </div>
      <span class="muted">{note}</span>
      <button class="small" onClick={close}>Close</button>
    </>
  );
}

/** Mounts what an action row holds (null empties it). */
export function mountSheet(el: Element, node: ComponentChildren) { render(<>{node}</>, el); }
