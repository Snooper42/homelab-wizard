// What's using power: each busy app's share of a processor core now, with a
// line of the last five minutes (Status samples every 10 seconds while it
// is open), and a word on what to do about it.
import { render } from 'preact';
import { CardHead } from '../parts/Card';
import { Row, Rows } from '../parts/Row';
import { Spark } from '../Spark';
import { formatMem, parseMem } from './memory';

/** Samples kept per app: five minutes at one every 10 seconds. */
export const keep = 30;

/** CPU samples per app, oldest first, from record(). */
export type History = Map<string, number[]>;

/** Adds one sample of every app to history; apps that went away are dropped. */
export function record(history: History, stats: docker.Stat[]) {
  const now = new Set(stats.map((s) => s.name));
  for (const name of history.keys()) if (!now.has(name)) history.delete(name);
  for (const s of stats) {
    const h = history.get(s.name) || [];
    h.push(s.cpu);
    if (h.length > keep) h.shift();
    history.set(s.name, h);
  }
}

export interface UsageProps {
  stats: docker.Stat[];
  history: History;
  /** An app's name from its compose service name. */
  nameOf: (id: string) => string;
}

export function Usage({ stats, history, nameOf }: UsageProps) {
  const busy = stats.filter((s) => s.cpu >= 1);
  const total = stats.reduce((t, s) => t + s.cpu, 0);
  const held = stats.reduce((t, s) => t + parseMem(s.mem), 0);
  const most = Math.max(busy[0]?.cpu || 0, 100);
  const heavy = busy.filter((s) => s.cpu >= 50);
  const minutes = Math.round(((history.get(busy[0]?.name)?.length || 1) * 10) / 60);
  return (
    <>
      <CardHead title="What’s using power">
        <span class="muted" title="Percent of one processor core; 100% is one core kept busy">
          {Math.round(total)}% of a core in all{held ? ` · ${formatMem(held)} in memory` : ''} · {minutes > 1 ? `live, the last ${minutes} minutes` : minutes === 1 ? 'live, the last minute' : 'just now'}
        </span>
      </CardHead>
      <Rows kind="usage">
        {busy.slice(0, 6).map((s) => {
          const past = history.get(s.name) || [];
          return (
            <Row key={s.name} title={nameOf(s.name)} whenPlain when={<>{Math.round(s.cpu)}%{s.mem ? ' · ' + s.mem : ''}</>}
              end={past.length >= 3 ? <Spark values={past} w={72} h={20} title={`${nameOf(s.name)}'s use over the last minutes`} /> : null}>
              <div class="bar"><span style={{ width: `${Math.max(2, Math.round((s.cpu / most) * 100))}%` }} /></div>
            </Row>
          );
        })}
      </Rows>
      <p class="muted">
        {heavy.length
          ? `${heavy.map((s) => nameOf(s.name)).join(' and ')} ${heavy.length === 1 ? 'is' : 'are'} busy. Some apps work hard for a while after you add files (Immich reads new photos); if it lasts, stop what you don’t use. On battery, the battery saver pauses the heaviest apps.`
          : 'Nothing is working hard. On battery, the battery saver pauses the heaviest apps.'}
      </p>
    </>
  );
}

/** Draws the card into el; it hides while nothing is busy. */
export function mountUsage(el: HTMLElement, props: UsageProps) {
  el.hidden = !props.stats.some((s) => s.cpu >= 1);
  render(el.hidden ? null : <Usage {...props} />, el);
}
