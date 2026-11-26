import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ago, clockText, dayText } from '../format';
import { CardHead } from '../parts/Card';
import { Row, Rows, type Tone } from '../parts/Row';

/** Who sent it, in words. */
const topicName: Record<string, string> = { watchtower: 'Updates', 'duplicati-alerts': 'Backups', 'uptime-kuma': 'Uptime Kuma', 'tunnel-watchdog': 'Watchdog' };

/** When a snooze ends, in words: "3:40 PM" today, "Sat 9:15 AM" after. */
const wakeText = (t: string) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? clockText(d) : `${dayText(d, { weekday: 'short' })} ${clockText(d)}`;
};

/** What became of a kept alert: when its problem cleared, or who snoozed it until when; "" for neither. */
export function alertFate(a: history.Alert, now = Date.now()): string {
  if (a.clearedAt) return `Cleared at ${wakeText(a.clearedAt)}`;
  if (a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now) return a.snoozedBy ? `Snoozed by ${a.snoozedBy} until ${wakeText(a.snoozedUntil)}` : `Snoozed until ${wakeText(a.snoozedUntil)}`;
  return a.checks?.length ? 'Not cleared yet' : '';
}

/** The checks of an alert that still fail, by the watchdog's last run: those can be snoozed. */
export function snoozable(a: history.Alert, w: health.Summary | null | undefined): string[] {
  if (a.clearedAt || !w) return [];
  const failing = new Set((w.failing || []).map((f) => f.name));
  return (a.checks || []).filter((c) => failing.has(c));
}

function SnoozePick({ check, until, snooze }: { check: string; until?: string; snooze: (check: string, hours: number) => void }) {
  return (
    <select class="snoozepick" aria-label={`Snooze the alerts about ${check}`} value="" onChange={(e) => { const v = e.currentTarget.value; if (v !== '') snooze(check, Number(v)); }}>
      <option value="" disabled>{until ? `Snoozed until ${wakeText(until)}` : 'Snooze…'}</option>
      <option value="1">For an hour</option>
      <option value="24">For a day</option>
      {until && <option value="0">Alert again now</option>}
    </select>
  );
}

/** An alert's message, one line each: a long list shows its first 3 lines and Show the N more. */
function Lines({ text }: { text: string }) {
  const [all, setAll] = useState(false);
  const lines = text.split('\n').filter((l) => l.trim());
  const cut = !all && lines.length > 4;
  return (
    <>
      {(cut ? lines.slice(0, 3) : lines).map((line, i) => <div key={i}>{line}</div>)}
      {lines.length > 4 && <button type="button" class="linkbtn morelines" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show less' : `Show ${lines.length - 3} more`}</button>}
    </>
  );
}

export interface AlertHistoryProps {
  /** Every alert the computer kept (internal/history), newest first; null while read. */
  alerts: history.Alert[] | null;
  /** Why they could not be read. */
  problem?: string;
  /** The watchdog's last run, for Snooze… on an alert whose check still fails. */
  watch: health.Summary | null;
  /** Snoozes a failing check's alerts for hours (0: alerts again now). */
  snooze: (check: string, hours: number) => void;
}

/** How many show before Show all. */
const first = 8;

/** Settings › Alerts: the alerts sent, each saying when it cleared or who snoozed it, with Snooze… on one whose check still fails. */
export function AlertHistory({ alerts, problem, watch, snooze }: AlertHistoryProps) {
  const [all, setAll] = useState(false);
  const tone = (a: history.Alert): Tone => (a.clearedAt ? 'ok' : (a.priority || 0) >= 4 ? 'bad' : '');
  const shown = alerts && !all ? alerts.slice(0, first) : alerts || [];
  return (
    <>
      <CardHead title="Alerts sent">{alerts && alerts.length > 0 ? <span class="muted">{alerts.length === 1 ? '1 kept' : `${alerts.length} kept`}</span> : undefined}</CardHead>
      {problem ? <p class="muted">{problem}</p>
        : alerts === null ? <p class="muted">Reading…</p>
          : !alerts.length ? <p class="muted">No alerts yet. When one is sent, it's kept here, with when its problem cleared.</p>
            : (
              <Rows>
                {shown.map((a) => {
                  const fate = alertFate(a);
                  return (
                    <Row key={a.id} dot={tone(a)} title={a.title}
                      sub={<>{a.body && <Lines text={a.body} />}{fate && <div class="fate">{fate}</div>}</>}
                      end={<>{snoozable(a, watch).map((c) => <SnoozePick key={c} check={c} until={watch?.snoozed?.[c]} snooze={snooze} />)}<span class="badge">{topicName[a.topic] || a.topic}</span></>} when={ago(a.at)} />
                  );
                })}
              </Rows>
            )}
      {alerts && alerts.length > first && <button type="button" class="linkbtn more" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${alerts.length}`}</button>}
    </>
  );
}

export const mountAlertHistory = (el: Element, p: AlertHistoryProps | null) => render(p && <AlertHistory {...p} />, el);
