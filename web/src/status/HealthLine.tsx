// Health in one line: at the top of every screen but Status (whose tiles
// and Needs a look say it already), "All well", or the one thing that needs
// you, with Status a click away. Status gives it the apps in trouble (in
// their rows' own words) and the watchdog's failing checks as it draws
// them; app.ts draws it again on each screen change.
import { render } from 'preact';

export interface HealthTrouble {
  id: string;
  name: string;
  words: string; // as its row on Status says it: "Unhealthy", "Not answering: …"
}

let apps: HealthTrouble[] | null = null; // null until Status has been read
let checks: string[] = [];
let open: (() => void) | null = null;

/** The apps in trouble, from each Status drawn. */
export function setHealthApps(list: HealthTrouble[], toStatus: () => void) { apps = list; open = toStatus; drawHealth(); }
/** The watchdog's failing checks that are no app's own (an app's is in its row). */
export function setHealthChecks(list: string[]) { checks = list; drawHealth(); }

const listed = (names: string[]) => (names.length <= 3 ? names.slice(0, -1).join(', ') + (names.length > 1 ? ' and ' : '') + names[names.length - 1] : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`);

function Line() {
  if (!apps) return null;
  let text = '';
  if (apps.length === 1) text = `${apps[0].name}: ${apps[0].words}`;
  else if (apps.length) text = `${apps.length} apps need a look: ${listed(apps.map((a) => a.name))}`;
  else if (checks.length === 1) text = `The watchdog's check of ${checks[0]} is failing`;
  else if (checks.length) text = `${checks.length} of the watchdog's checks are failing: ${listed(checks)}`;
  if (!text) return <span class="ok">✓ All well</span>;
  return <><span class="bad">{text}</span> <button class="linkbtn" onClick={() => open?.()}>Open Status</button></>;
}

/** Draws the line for the screen showing: none on Status or an app's page. */
export function drawHealth() {
  const el = document.getElementById('healthLine');
  if (!el) return;
  const on = document.querySelector('.screen.active')?.id;
  el.hidden = !apps || on === 'status' || on === 'app';
  el.classList.toggle('trouble', !!apps && (apps.length > 0 || checks.length > 0));
  render(<Line />, el);
}
