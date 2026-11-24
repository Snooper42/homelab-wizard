// Where a page sits, and the way back up (the owner, Nov 23: proper
// breadcrumbs and back buttons). A page under another (an app's page under
// Status, an account's under Net worth, a card's under the Collection,
// Transactions opened from a Dashboard card) leads with its trail: a round
// back button to the step above, then each step as a link and the page
// itself. On the phone's page only the back button shows, with the step
// above's name (docs/Redesign.md, The phone: a detail page has a back
// button and its own title). ⌘[ and the trackpad's swipe go back through
// what was opened (app.ts), this up through where it sits.
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
