// The update, as one line at the top of every screen: ready (already
// downloaded) with What's new, Later, and Update now; a bar while it goes
// in place; "Updated to …" once the new version opens; why, in one
// sentence, when it cannot finish by itself; and when the app opened again
// on the version it was (Windows blocked the new one), that it did not
// install, with the release page to install it by hand. Settings › This Mac keeps its
// two choices: looking now, and installing when the app quits.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ActionLink } from '../ActionLink';
import { ago, never } from '../format';
import { Row, Rows } from '../parts/Row';

export interface UpdateLineProps {
  s: app.UpdateState;
  /** Update now's progress while it runs (and its failure); null before. */
  step: app.UpdateStep | null;
  /** The new build's download, while Update now waits for it. */
  download: app.Download | null;
  /** What the update printed, for Details after a failure. */
  log: string;
  update: () => void;
  later: () => void;
  close: () => void;
  open: (url: string) => void;
}

const running = (step: app.UpdateStep | null) => !!step && step.step !== 'done' && step.step !== 'failed';

/** Whether the line has anything to say. */
export const lineShown = (s: app.UpdateState | null, step: app.UpdateStep | null) =>
  !!step || !!s && (s.state === 'ready' || s.state === 'blocked' || !!s.updated || !!s.notInstalled);

function Notes({ notes }: { notes: string[] }) {
  return (
    <ul id="updateNotes">
      {notes.slice(0, 12).map((n, i) => <li key={i}>{n}</li>)}
      {notes.length > 12 && <li class="muted">{`and ${notes.length - 12} more`}</li>}
    </ul>
  );
}

export function UpdateLine({ s, step, download, log, update, later, close, open }: UpdateLineProps) {
  const [more, setMore] = useState(false);
  const v = s.version;
  const whatsNew = (notes: string[]) => !!notes.length && (
    <ActionLink id="updateWhatsNew" cls="small" onClick={() => setMore(!more)}>{more ? 'Hide' : 'What’s new'}</ActionLink>
  );
  let mark = '↑', tone = 'ready', head = '', sub = '', end = null, below = null, bar = -1;
  if (running(step)) {
    mark = '↻';
    head = s.finish ? 'Finishing the update…' : 'Updating…';
    sub = 'Your apps keep running';
    // The download fills the middle of the bar while the app waits for it.
    bar = step!.step === 'app' && download && download.percent >= 0 ? 60 + Math.round(download.percent * 0.35) : step!.percent;
  } else if (step?.step === 'failed') {
    mark = '!'; tone = 'failed';
    head = 'The update stopped';
    sub = step.error || 'The details say why';
    end = <>
      {!!log && <ActionLink id="updateDetails" cls="small" onClick={() => setMore(!more)}>{more ? 'Hide the details' : 'Details'}</ActionLink>}
      <button id="updateRetry" class="small" onClick={update}>Try again</button>
    </>;
    below = more && !!log && <pre id="updateLog">{log}</pre>;
  } else if (s.notInstalled && !step) {
    mark = '!'; tone = 'failed';
    head = v ? `Homelab Wizard ${v} did not install` : 'The update did not install';
    sub = s.notInstalled;
    end = <>
      {s.page && <button id="updateDownload" class="small" onClick={() => open(s.page!)}>Download it</button>}
      {s.state === 'ready' && <button id="updateRetry" class="small" onClick={update}>Try again</button>}
      <button id="updateClose" class="iconbtn" aria-label="Close" onClick={close}>×</button>
    </>;
  } else if (s.updated && (step?.step === 'done' || s.state !== 'ready')) {
    mark = '✓'; tone = 'done';
    head = s.updated.version ? `Updated to ${s.updated.version}` : 'Updated';
    end = <>{whatsNew(s.updated.notes || [])}<button id="updateClose" class="iconbtn" aria-label="Close" onClick={close}>×</button></>;
    below = more && <Notes notes={s.updated.notes || []} />;
  } else if (s.state === 'blocked') {
    mark = '!'; tone = 'blocked';
    head = v ? `Homelab Wizard ${v} is ready` : 'An update is ready';
    sub = s.blocked || '';
    end = s.page ? <button id="updateDownload" class="small" onClick={() => open(s.page!)}>Download it</button> : null;
  } else if (s.state === 'ready') {
    head = v ? `Homelab Wizard ${v} is ready` : 'An update is ready';
    end = <>
      {whatsNew(s.notes || [])}
      <button id="updateLater" class="small" onClick={later}>Later</button>
      <button id="updateNow" class="primary small" onClick={update}>Update now</button>
    </>;
    below = more && <Notes notes={s.notes || []} />;
  } else {
    return null;
  }
  return (
    <>
      <div class={'line ' + tone}>
        <span class="mark" aria-hidden="true">{mark}</span>
        <strong class="head">{head}</strong>
        <span class="sub muted">{sub}</span>
        {bar >= 0 && (
          <span class="bar" role="progressbar" aria-label="Updating" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bar}>
            <span class="fill" style={{ width: `${Math.max(4, Math.min(100, bar))}%` }} />
          </span>
        )}
        {end}
      </div>
      {below}
    </>
  );
}

export interface UpdateSettingsProps {
  s: app.UpdateState;
  looking: boolean;
  look: () => void;
  setInstallOnQuit: (on: boolean) => void;
}

/** Settings › This Mac › Updates: when it last looked, Look now, and installing when the app quits. */
export function UpdateSettings({ s, looking, look, setInstallOnQuit }: UpdateSettingsProps) {
  return (
    <Rows>
      <Row title="Look for updates" sub="Every 15 minutes, and when you bring the window forward"
        end={<>
          <span class="muted small">{looking ? 'Looking…' : never(s.looked) ? 'Not yet' : `Last looked ${ago(s.looked)}`}</span>
          <button id="lookNow" class="small" disabled={looking} onClick={look}>Look now</button>
        </>} />
      {s.canInstallOnQuit && (
        <Row title="Install updates when I quit the app" sub="A downloaded update goes in place as the app quits; the next open is the new version"
          end={<input id="installOnQuit" type="checkbox" class="switch" role="switch" aria-label="Install updates when I quit the app" checked={s.installOnQuit}
            onChange={(e) => setInstallOnQuit(e.currentTarget.checked)} />} />
      )}
    </Rows>
  );
}

export const mountUpdateLine = (el: Element, props: UpdateLineProps | null) => render(props && <UpdateLine {...props} />, el);
export const mountUpdateSettings = (el: Element, props: UpdateSettingsProps | null) => render(props && <UpdateSettings {...props} />, el);
