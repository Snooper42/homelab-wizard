import type { ComponentChildren } from 'preact';

export interface Crumb {
  label: string;
  /** Opens that step; none for a step that is only a name. */
  go?: () => void;
}

export function Crumbs({ trail, here }: { trail: Crumb[]; here: ComponentChildren }) {
  const up = [...trail].reverse().find((c) => c.go);
  return (
    // A div, not a <nav>: style.css draws every nav as the sidebar.
    <div class="crumbs" role="navigation" aria-label="Where you are">
      {up && (
        <button type="button" class="back" title={`Back to ${up.label}`} aria-label={`Back to ${up.label}`} onClick={up.go}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          <span class="backlabel" aria-hidden="true">{up.label}</span>
        </button>
      )}
      <ol>
        {trail.map((c) => (
          <li key={c.label}>
            {c.go ? <button type="button" class="crumb" onClick={c.go}>{c.label}</button> : <span class="crumb">{c.label}</span>}
            <span class="crumbsep" aria-hidden="true">›</span>
          </li>
        ))}
        <li aria-current="page"><span class="crumb here">{here}</span></li>
      </ol>
    </div>
  );
}
