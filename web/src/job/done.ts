
export function jobStarted(details: HTMLDetailsElement | null, done: HTMLElement) {
  if (details) details.open = true;
  done.hidden = true;
}

export function jobFinished(details: HTMLDetailsElement | null, done: HTMLElement, ok: boolean) {
  if (details) details.open = !ok;
  done.hidden = false;
}
