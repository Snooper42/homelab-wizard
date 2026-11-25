// Small notes the screens show: Status's line (or why Status is not
// available), and what to do with a report once it is made.
import { render } from 'preact';
import { Card } from './Card';

/** Status's line under the cards; down: why Status could not be read. */
export function StatusNote({ text, down }: { text: string; down?: string }) {
  if (!down) return <>{text}</>;
  return (
    <Card kind="notice">
      <strong>{/not running/.test(down) ? 'The container runtime is not running' : 'Status is not available'}</strong>
      <div class="muted">{down}</div>
      <div class="muted">Every app is paused until it starts.</div>
    </Card>
  );
}

/** The report made: show the file, or start an email to the helper with it. */
export function ReportActions({ reveal, show, email }: { reveal: string; show: () => void; email: () => void }) {
  return (
    <div class="actions reveal">
      <button class="small" onClick={show}>{reveal}</button>
      <button id="emailReport" class="small" onClick={email}>Email it to my helper</button>
      <span class="muted">Read it through before you share it.</span>
    </div>
  );
}

export function mountStatusNote(el: Element, props: { text: string; down?: string }) { render(<StatusNote {...props} />, el); }
export function mountReportActions(el: Element, props: { reveal: string; show: () => void; email: () => void } | null) { render(props ? <ReportActions {...props} /> : null, el); }
