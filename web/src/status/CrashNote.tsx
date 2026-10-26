// Status's note after a crash: which part of the homelab stopped, when, and
// a button that makes the diagnostics report (which carries the crash's
// log) to send. app.ts reads the crash (LastCrash) and mounts this; once it
// is sent or hidden, CrashSeen keeps it from showing again.
import { render } from 'preact';

export interface CrashNoteProps {
  crash: crash.Crash | null;
  send: () => void;
  hide: () => void;
}

/** "today", "yesterday", "on Thursday", or "on 12 October". */
export function day(when: string, now = new Date()): string {
  const d = new Date(when);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return 'on ' + d.toLocaleDateString('en-GB', { weekday: 'long' });
  return 'on ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

export function CrashNote({ crash, send, hide }: CrashNoteProps) {
  if (!crash) return null;
  const who = crash.who.charAt(0).toUpperCase() + crash.who.slice(1);
  return (
    <div class="card notice crashnote" role="status">
      <strong>{who} stopped unexpectedly {day(crash.when)}</strong>
      <div class="muted">
        It started again by itself. The diagnostics report carries what happened ({crash.file}), with passwords and tokens taken out, for whoever helps you.
      </div>
      <div class="actions">
        <button class="primary small" onClick={send}>Send the report</button>
        <button class="small" onClick={hide}>Hide</button>
      </div>
    </div>
  );
}

export function mountCrashNote(el: HTMLElement, props: CrashNoteProps) {
  el.hidden = !props.crash;
  render(<CrashNote {...props} />, el);
}
