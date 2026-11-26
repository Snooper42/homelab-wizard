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
