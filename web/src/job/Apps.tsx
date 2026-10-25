// A job's apps, one row each: what is happening to it in plain words, and a
// bar for how far along it is. The rows come from what Compose prints
// (internal/progress, as job:app events); the raw lines stay under Show
// details.
import { render } from 'preact';

/** How far along each stage is, for its bar when a download has no percent. */
const reached: Record<string, number> = {
  waiting: 0.05, downloading: 0.1, downloaded: 0.6, building: 0.3, 'setting-up': 0.7, replacing: 0.7,
  starting: 0.85, running: 1, stopping: 0.5, stopped: 1, removing: 0.5, removed: 1, failed: 1,
};

/** How far along u is, 0 to 1. */
export function share(u: progress.Update): number {
  if (u.stage === 'downloading' && u.percent >= 0) return 0.1 + 0.5 * (u.percent / 100);
  return reached[u.stage] ?? 0.1;
}

/** The whole job's share, from its apps: their average. */
export function overall(apps: progress.Update[]): number {
  return apps.length ? apps.reduce((t, u) => t + share(u), 0) / apps.length : 0;
}

function Mark({ u }: { u: progress.Update }) {
  if (u.failed) return <span class="jobmark bad" aria-hidden="true">!</span>;
  if (u.done) return <span class="jobmark ok" aria-hidden="true">✓</span>;
  return <span class="jobmark busy" aria-hidden="true" />;
}

export function JobApps({ apps }: { apps: progress.Update[] }) {
  if (!apps.length) return null;
  return (
    <ul class="jobapps" aria-label="Apps">
      {apps.map((u) => (
        <li key={u.app} class={u.failed ? 'failed' : u.done ? 'done' : ''}>
          <Mark u={u} />
          <span class="jobname">{u.name}</span>
          <span class="jobwords" title={u.words}>{u.failed ? `Couldn’t finish: ${u.words}` : u.words}</span>
          <span class={'jobbar' + (!u.done && u.percent < 0 ? ' moving' : '')} role="progressbar" aria-label={u.name}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share(u) * 100)}>
            <span style={{ width: `${Math.round(share(u) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function mountJobApps(el: HTMLElement, apps: progress.Update[]) { render(<JobApps apps={apps} />, el); }
