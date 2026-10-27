// One screen's data, kept between visits: the last reading, when it was
// read, and why the last read failed. The engine's changes and the
// screen's actions read it again; picking the screen, or a click inside
// it, draws what is kept instead of asking the backend.

export interface Store<T> {
  /** The last reading that worked. */
  readonly value: T | undefined;
  /** Why the last read failed; undefined once one works. */
  readonly error: unknown;
  /** When it was last read or set (0: never, failed, or marked out of date). */
  readonly at: number;
  /**
   * Reads it now and tells the watchers. One read at a time: asked during
   * one, it reads once more after it. Never rejects; see error.
   */
  load(): Promise<void>;
  /** Reads it only when never read, marked out of date, or older than maxAge (ms); waits for a read that runs. */
  fresh(maxAge: number): Promise<void>;
  /** Keeps an answer that came another way (an action's). */
  set(v: T): void;
  /** Marks it out of date: the next fresh() reads it. */
  stale(): void;
  /** Calls fn after every read or set. */
  watch(fn: () => void): void;
}

export function store<T>(read: () => Promise<T>): Store<T> {
  const watchers: (() => void)[] = [];
  let running: Promise<void> | null = null;
  let again: Promise<void> | null = null;
  const tell = () => watchers.forEach((fn) => fn());
  const s = {
    value: undefined as T | undefined,
    error: undefined as unknown,
    at: 0,
    load(): Promise<void> {
      if (running) return (again ??= running.then(() => { again = null; return s.load(); }));
      running = (async () => {
        try {
          s.value = await read();
          s.error = undefined;
          s.at = Date.now();
        } catch (e) {
          s.error = e;
          s.at = 0; // read again on the next visit
        }
        running = null;
        tell();
      })();
      return running;
    },
    fresh(maxAge: number) {
      if (running) return running;
      return !s.at || Date.now() - s.at > maxAge ? s.load() : Promise.resolve();
    },
    set(v: T) {
      s.value = v;
      s.error = undefined;
      s.at = Date.now();
      tell();
    },
    stale() { s.at = 0; },
    watch(fn: () => void) { watchers.push(fn); },
  };
  return s;
}
