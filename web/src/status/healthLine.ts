// Health in one line: at the top of every screen but Status (whose tiles
// and Needs a look say it already), "All well", or the one thing that needs
// you, with Status a click away. Status gives it the apps in trouble (in
// their rows' own words) and the watchdog's failing checks as it draws
// them; app.ts draws it again on each screen change. Its markup is fixed
// in index.html and only its words change, so drawing it never runs a
// render while a screen's own is under way.

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
/** The watchdog's failing checks that are no app's (an app's is in its row). */
export function setHealthChecks(list: string[]) { checks = list; drawHealth(); }

const listed = (names: string[]) => (names.length <= 3 ? names.slice(0, -1).join(', ') + (names.length > 1 ? ' and ' : '') + names[names.length - 1] : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`);

/** What the line says: empty when all is well. */
function trouble(): string {
  if (!apps) return '';
  if (apps.length === 1) return `${apps[0].name}: ${apps[0].words}`;
  if (apps.length) return `${apps.length} apps need a look: ${listed(apps.map((a) => a.name))}`;
  if (checks.length === 1) return `The watchdog's check of ${checks[0]} is failing`;
  if (checks.length) return `${checks.length} of the watchdog's checks are failing: ${listed(checks)}`;
  return '';
}

/** Draws the line for the screen showing: none on Status or an app's page. */
export function drawHealth() {
  const el = document.getElementById('oneLine');
  const text = document.getElementById('oneText');
  const btn = document.getElementById('oneOpen') as HTMLButtonElement | null;
  if (!el || !text || !btn) return;
  const on = document.querySelector('.screen.active')?.id;
  const said = trouble();
  el.hidden = !apps || on === 'status' || on === 'app';
  el.classList.toggle('trouble', !!said);
  text.className = said ? 'bad' : 'ok';
  text.textContent = said || '✓ All well';
  btn.hidden = !said;
  btn.onclick = () => open?.();
}
