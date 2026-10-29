// How this machine looks after the homelab: the background agent, the
// container runtime, the power, and the room on its disk. Setup shows them
// as four tiles while there is setting up to do; Status keeps them as one
// line at its top, so they stay in sight once Setup leaves the sidebar.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { ago, never } from '../format';
import { Tile } from '../status/Tiles';

export interface HealthProps {
  h: app.HealthInfo;
  i: app.HostInfo;
  /** "this Mac", "this PC", "this machine". */
  machine: string;
  /** Starts the agent again (homelab resume); rejects with why it could not. */
  startAgent: () => Promise<void>;
  /** Opens Setup, where the tiles say more. */
  openSetup?: () => void;
}

type Tone = 'ok' | 'warn' | 'bad' | '';
interface Fact { key: string; label: string; value: string; tone: Tone; sub: string; short: string; used?: number }

/** The four facts, each with its tone, its words, and its words for one line. */
export function facts({ h, i, machine }: Pick<HealthProps, 'h' | 'i' | 'machine'>): Fact[] {
  const checked = never(h.lastCheck) ? 'no check yet' : `last check ${ago(h.lastCheck)}`;
  const agent: Fact = h.agent === 'running'
    ? { key: 'agent', label: 'Looks after the homelab', value: 'Running', tone: 'ok', sub: `Backs up every night at 03:30 and checks every app every 15 minutes; ${checked}`, short: 'Backups and checks on' }
    : h.agent === 'quit'
      ? { key: 'agent', label: 'Looks after the homelab', value: 'Stopped by Quit', tone: 'warn', sub: 'No backup or check runs until it starts again', short: 'Backups and checks stopped by Quit' }
      : h.agent === 'stopped'
        ? { key: 'agent', label: 'Looks after the homelab', value: 'Stopped', tone: 'bad', sub: 'No nightly backup, check, or update runs until it starts again', short: 'Backups and checks stopped' }
        : { key: 'agent', label: 'Looks after the homelab', value: 'Not set up', tone: 'warn', sub: 'Finish setting up adds it (Scheduled jobs)', short: 'Backups and checks not set up' };
  const name = (i.runtimeFound || i.runtime || 'The runtime').split(',')[0];
  const runtime: Fact = i.runtimeOK
    ? { key: 'runtime', label: 'Runs the apps', value: name, tone: 'ok', sub: (i.runtimeFound || '').split(',').slice(1).join(',').trim() || 'Running', short: name }
    : { key: 'runtime', label: 'Runs the apps', value: `${i.runtime} is not running`, tone: 'bad', sub: i.runtimeHint || '', short: `${i.runtime} is not running` };
  const power: Fact = h.power === 'battery'
    ? { key: 'power', label: 'Power', value: 'On battery', tone: 'warn', sub: `The apps sleep when ${machine} does: plug it in`, short: 'On battery' }
    : h.power === 'plugged'
      ? h.keptAwake
        ? { key: 'power', label: 'Power', value: 'Plugged in', tone: 'ok', sub: 'Kept awake while plugged in; the screen still sleeps', short: 'Plugged in' }
        : { key: 'power', label: 'Power', value: 'Plugged in', tone: 'warn', sub: `${cap(machine)} may sleep: keeping it awake is off in Settings`, short: 'Plugged in, may sleep' }
      : h.keptAwake
        ? { key: 'power', label: 'Sleep', value: 'Kept awake', tone: 'ok', sub: 'The screen still sleeps', short: 'Kept awake' }
        : { key: 'power', label: 'Sleep', value: 'May sleep', tone: 'warn', sub: 'Keeping it awake is off in Settings; the apps go away while it sleeps', short: 'May sleep' };
  const d = (i.disks || [])[0];
  const free = d ? d.space.replace(/\s*\(\d+%\)$/, '') : '';
  const [freeWords, ofWords] = free.includes(' free of ') ? free.split(' free of ') : [free, ''];
  const disk: Fact | null = d
    ? { key: 'disk', label: `Room on ${machine}`, value: `${freeWords} free`, tone: d.low ? 'bad' : 'ok', sub: d.low ? d.hint || '' : ofWords ? `of ${ofWords}` : '', short: `${freeWords} free`,
      used: d.total ? Math.min(100, Math.max(1, Math.round(100 * (1 - d.free / d.total)))) : undefined }
    : null;
  return [agent, runtime, power, ...(disk ? [disk] : [])];
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The agent's Start it: says why when it could not. */
function StartAgent({ id, start }: { id: string; start: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await start(); } finally { setBusy(false); } };
  return <button id={id} class="small" disabled={busy} onClick={go}>{busy ? 'Starting…' : 'Start it'}</button>;
}

/** Setup's four tiles. */
export function HealthTiles(p: HealthProps) {
  return (
    <>
      {facts(p).map((f) => (
        <Tile key={f.key} id={'health-' + f.key} label={f.label} tone={f.tone === 'ok' ? '' : f.tone}
          value={<><span class={'dot ' + f.tone} />{f.value}</>}
          sub={<>
            {f.used !== undefined && <span class="storagebar" role="meter" aria-valuenow={f.used} aria-valuemin={0} aria-valuemax={100} aria-label={`${f.used}% used`}><span style={`width:${f.used}%`} /></span>}
            <span>{f.sub}</span>
            {f.key === 'agent' && (p.h.agent === 'stopped' || p.h.agent === 'quit') && <StartAgent id="startAgent" start={p.startAgent} />}
          </>} />
      ))}
    </>
  );
}

/** Status' line: each fact in a few words, what needs a look in its tone. */
export function HealthLine(p: HealthProps) {
  const all = facts(p);
  const stopped = p.h.agent === 'stopped' || p.h.agent === 'quit';
  return (
    <>
      <span class="label">{p.machine.charAt(0).toUpperCase() + p.machine.slice(1)}</span>
      {all.map((f) => <span key={f.key} class={'item ' + f.tone} title={f.sub}><span class={'dot ' + f.tone} />{f.short}</span>)}
      {stopped && <StartAgent id="startAgentLine" start={p.startAgent} />}
    </>
  );
}

export const mountHealthTiles = (el: Element, props: HealthProps | null) => render(props && <HealthTiles {...props} />, el);
export const mountHealthLine = (el: Element, props: HealthProps | null) => render(props && <HealthLine {...props} />, el);
