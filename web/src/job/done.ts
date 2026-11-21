// A finished job's panel (the owner, Nov 20: results "just kinda stick
// around"): once it ends, its log folds away when it went fine (it stays
// open when it didn't, to be read), and its Done button shows, which takes
// the panel off the screen. A new job opens the log and hides Done again.

export function jobStarted(details: HTMLDetailsElement | null, done: HTMLElement) {
  if (details) details.open = true;
  done.hidden = true;
}

export function jobFinished(details: HTMLDetailsElement | null, done: HTMLElement, ok: boolean) {
  if (details) details.open = !ok;
  done.hidden = false;
}
