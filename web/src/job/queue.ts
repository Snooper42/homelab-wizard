
interface Turn {
  title: string;
  go: () => void;
}

let running = '';
const waiting: Turn[] = [];
const watchers: (() => void)[] = [];

/** The job running now, by its title; "" when none. */
export const jobNow = () => running;
/** The jobs waiting their turn, first first. */
export const jobsWaiting = () => waiting.map((t) => t.title);
/** Calls fn whenever a job starts, ends, or joins the queue. */
export function watchJobs(fn: () => void) { watchers.push(fn); }
const tell = () => watchers.forEach((fn) => fn());

export function inTurn<T>(title: string, job: () => Promise<T>, wait?: (behind: string) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const go = () => {
      running = title;
      tell();
      job().then(resolve, reject).finally(() => {
        running = '';
        const next = waiting.shift();
        if (next) next.go(); else tell();
      });
    };
    if (!running) { go(); return; }
    waiting.push({ title, go });
    wait?.(running);
    tell();
  });
}

/** How a waiting job says what it waits for. */
export const waitWords = (behind: string) => `Waiting for “${behind}” to finish`;
