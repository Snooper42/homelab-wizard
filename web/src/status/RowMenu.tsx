// An app's row's own menu on Status: a right-click on the row, Shift+F10,
// or the context-menu key opens it, with what its page offers, without
// opening the page. It works as a group's menu does: the arrow keys, Home,
// and End move through it, Escape closes it back where the focus was, and
// a press elsewhere closes it (read as the press begins, since WebKit moves
// no focus on a click). Stop asks for a second click; Stop for a while ›
// shows its times in place of the menu, and Send to my phone › the phones
// it can go to (the owner, Nov 12: pick a phone each time).
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { stopChoices } from './stopFor';

/** What the row's menu does; app.ts runs each. */
export interface RowMenuActions {
  open: (url: string) => void;
  phone: (a: api.AppStatus) => void;
  copy: (text: string) => Promise<void>;
  act: (a: api.AppStatus, action: string) => void;
  stopFor: (a: api.AppStatus, until: string) => void;
  /** Its page, at its log. */
  logs: (a: api.AppStatus) => void;
  backupNow: () => void;
  /** The watchdog's alerts about it, on or off. */
  alerts: (a: api.AppStatus, on: boolean) => void;
  /** Pinned to the top of Status (and the menu bar's Open an app), or back in its group. */
  pin: (a: api.AppStatus, on: boolean) => void;
  /** The paired phones its page can be sent to (none on a phone, or with none paired). */
  targets: (a: api.AppStatus) => app.SendTarget[];
  /** Sends its page to a phone, which shows it with one tap to open; resolves to what to say under the row. */
  send: (a: api.AppStatus, t: app.SendTarget) => Promise<string>;
}

export interface RowMenuProps {
  a: api.AppStatus;
  /** Where it opens: the pointer's spot, or under the app's name. */
  x: number;
  y: number;
  /** A native app (Jellyfin on a Mac): no Start, Stop, or alerts here. */
  native: boolean;
  /** An app's command runs: what changes it waits. */
  busy: boolean;
  /** The phone companion: no Open on a phone. */
  companion: boolean;
  on: RowMenuActions;
  /** Closes it; refocus puts the focus back where it was. */
  close: (refocus?: boolean) => void;
  /** Says what happened, under the row ("Address copied"). */
  said: (words: string) => void;
}

export function RowMenu({ a, x, y, native, busy, companion, on, close, said }: RowMenuProps) {
  const box = useRef<HTMLDivElement>(null);
  const [sure, setSure] = useState(false);
  const [later, setLater] = useState(false);
  const [sending, setSending] = useState(false);
  const phones = companion ? [] : on.targets(a);
  const [at, setAt] = useState({ left: x, top: y });
  const items = () => [...(box.current?.querySelectorAll<HTMLButtonElement>('[role^=menuitem]:not([disabled])') || [])];
  // Inside the window: moved left or up when it would run past an edge.
  useLayoutEffect(() => {
    const m = box.current?.getBoundingClientRect();
    if (!m) return;
    setAt({ left: Math.max(8, Math.min(x, innerWidth - m.width - 8)), top: y + m.height > innerHeight - 8 ? Math.max(8, y - m.height) : y });
  }, [x, y, later]);
  useEffect(() => {
    // At once, as the menu is drawn: a key pressed right after the one that opened it lands in the menu.
    items()[0]?.focus();
    const outside = (e: Event) => { if (!box.current?.contains(e.target as Node)) close(); };
    const gone = () => close();
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('blur', gone);
    window.addEventListener('resize', gone);
    return () => { document.removeEventListener('mousedown', outside, true); window.removeEventListener('blur', gone); window.removeEventListener('resize', gone); };
  }, []);
  const showLater = (to: boolean) => { setLater(to); setSure(false); requestAnimationFrame(() => (to ? items()[0] : box.current?.querySelector<HTMLButtonElement>('.stoplater'))?.focus()); };
  const showSend = (to: boolean) => { setSending(to); setSure(false); requestAnimationFrame(() => (to ? items()[0] : box.current?.querySelector<HTMLButtonElement>('.sendphone'))?.focus()); };
  const pick = (fn: () => void) => () => { close(true); fn(); };
  const url = a.address ? 'https://' + a.address : a.url || '';
  const running = a.state === 'running', stopped = a.state === 'stopped';
  const item = (label: string, fn: () => void, opts: { cls?: string; disabled?: boolean } = {}) =>
    <button type="button" role="menuitem" class={opts.cls} disabled={opts.disabled} onClick={fn}>{label}</button>;
  return (
    <div ref={box} class="menu rowmenu" role="menu" aria-label={later ? `Stop ${a.name} for a while` : sending ? `Send ${a.name} to a phone` : a.name} style={{ left: at.left + 'px', top: at.top + 'px' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (later) showLater(false); else if (sending) showSend(false); else close(true); return; }
        const all = items(), i = all.indexOf(document.activeElement as HTMLButtonElement);
        const to = ({ ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[e.key];
        if (to === undefined || !all.length) return;
        e.preventDefault();
        all[(to + all.length) % all.length].focus();
      }}>
      {sending ? (
        <>
          <p class="menuhead">Send {a.name} to</p>
          {phones.map((t) => <button key={t.id} type="button" role="menuitem" onClick={pick(() => { on.send(a, t).then(said, (e) => said(String(e?.message || e))); })}>{t.name}</button>)}
          {item('‹ Back', () => showSend(false), { cls: 'menuback' })}
          <p class="menufoot muted">It shows there with one tap to open.</p>
        </>
      ) : later ? (
        <>
          <p class="menuhead">Stop {a.name} for a while</p>
          {stopChoices().map((c) => <button key={c.until} type="button" role="menuitem" disabled={busy} onClick={pick(() => on.stopFor(a, c.until))}>{c.label}</button>)}
          {item('‹ Back', () => showLater(false), { cls: 'menuback' })}
          <p class="menufoot muted">It starts again by itself then.</p>
        </>
      ) : (
        <>
          {running && url && item('Open', pick(() => on.open(url)))}
          {running && a.address && !companion && item('Open on a phone', pick(() => on.phone(a)))}
          {url && item('Copy address', pick(() => { on.copy(url).then(() => said('Address copied'), () => said('Could not copy the address')); }))}
          {!!phones.length && <button type="button" role="menuitem" class="sendphone" aria-haspopup="menu" onClick={() => showSend(true)}>Send to my phone ›</button>}
          {!native && url && <hr />}
          {!native && stopped && item('Start', pick(() => on.act(a, 'start')), { disabled: busy })}
          {!native && running && item('Restart', pick(() => on.act(a, 'restart')), { disabled: busy })}
          {!native && running && item(sure ? `Click again to stop ${a.name}` : 'Stop', () => { if (!sure) { setSure(true); return; } close(true); on.act(a, 'stop'); }, { cls: sure ? 'danger' : undefined, disabled: busy })}
          {!native && running && <button type="button" role="menuitem" class="stoplater" aria-haspopup="menu" disabled={busy} onClick={() => showLater(true)}>Stop for a while ›</button>}
          {!native && <hr />}
          {!native && item('Logs', pick(() => on.logs(a)))}
          {/* On the phone, the quick ones: what is done to this app now. */}
          {!companion && item('Back up now', pick(() => on.backupNow()))}
          {!native && !companion && (
            <button type="button" role="menuitemcheckbox" aria-checked={!a.quiet} onClick={pick(() => on.alerts(a, !!a.quiet))}>
              Tell me if it stops<span class="check" aria-hidden="true">{a.quiet ? '' : '✓'}</span>
            </button>
          )}
          {!companion && (
            <button type="button" role="menuitemcheckbox" aria-checked={!!a.pinned} onClick={pick(() => on.pin(a, !a.pinned))}>
              Pin to the top<span class="check" aria-hidden="true">{a.pinned ? '✓' : ''}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
