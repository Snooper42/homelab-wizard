// One job at a time, in turn. The Go side runs one install, setup step,
// command, or app action at a time (its install lock), and the window has
// one bar and one log for it (jobs.ts): a job asked for while another
// runs used to be refused ("another install or setup step is running").
// Now it waits its turn, in the order asked, says so where it was asked
// (a row, a panel, the command sheet), and runs by itself when the one
// before it ends, however that ends.

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

/**
 * Runs job in its turn: at once when nothing runs, else after the jobs
 * before it. wait is told what it waits for (the job running now) when it
 * must wait, so its place can say so. It resolves or rejects as job does.
 */
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
