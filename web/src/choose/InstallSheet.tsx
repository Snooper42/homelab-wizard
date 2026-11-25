// Installing, now that Choose apps is gone (the owner, Nov 25: "remove choose apps entirely", "no addition by
// subtraction"): a sheet over whichever screen asked, with the app's own page at its top (its logo, what it does, what
// it replaces, what it goes with) and the plan under it (what installing does, the settings it needs, Connect the
// apps for me, Install, its progress and what started). Add your own app is a sheet of its own. Both are drawn once;
// screens/choose.ts moves the plan's and the form's parts in and fills them by their IDs, as Choose apps did.
import { render } from 'preact';
import { AppMark } from '../parts/AppMark';
import { Sheet } from '../parts/Sheet';

export function InstallSheets({ close, closeCustom }: { close: () => void; closeCustom: () => void }) {
  return (
    <>
      <Sheet id="installSheet" titleId="installTitle" onClose={close}>
        <div class="row sheethead"><h2 id="installTitle">Install</h2><button type="button" class="btn" onClick={close}>Close</button></div>
        <div id="installAbout" />
        <div id="installBody" />
      </Sheet>
      <Sheet id="customSheet" titleId="customTitle" onClose={closeCustom}>
        <div class="row sheethead"><h2 id="customTitle">Add your own app</h2><button type="button" class="btn" onClick={closeCustom}>Close</button></div>
        <div id="customBody" />
      </Sheet>
    </>
  );
}

/** The app's own page atop the plan: one app's, or a set's apps as marks. */
export function About({ app, set, catalog, icons }: { app?: api.App; set?: api.Preset; catalog: api.Catalog; icons?: Record<string, string> }) {
  if (set) {
    const apps = (set.apps || []).map((id) => catalog.apps.find((a) => a.id === id)).filter(Boolean) as api.App[];
    return (
      <div class="installabout">
        <div class="aboutmarks">{apps.slice(0, 5).map((a) => <AppMark key={a.id} id={a.id} name={a.name} icon={icons?.[a.id] || ''} />)}</div>
        <p class="aboutwhat">{set.description}</p>
        <p class="muted aboutfacts">{apps.map((a) => a.name).join(' · ')}</p>
      </div>
    );
  }
  if (!app) return null;
  const name = (id: string) => catalog.apps.find((a) => a.id === id)?.name || id;
  const cat = catalog.categories.find((c) => c.id === app.category)?.label;
  const facts = [
    cat,
    app.replaces?.length ? `Instead of ${app.replaces.join(', ')}` : '',
    app.public ? 'Can be reached away from home' : '',
  ].filter(Boolean);
  const goes = Object.keys(app.goesWith || {});
  return (
    <div class="installabout">
      <AppMark id={app.id} name={app.name} icon={icons?.[app.id] || ''} />
      <p class="aboutwhat">{app.description}</p>
      {!!facts.length && <p class="muted aboutfacts">{facts.join(' · ')}</p>}
      {!!goes.length && <p class="muted aboutfacts">Goes with {goes.map(name).join(', ')}</p>}
      {app.warning && <p class="warn aboutfacts">{app.warning}</p>}
    </div>
  );
}

export const mountInstallSheets = (el: Element, p: { close: () => void; closeCustom: () => void }) => render(<InstallSheets {...p} />, el);
export const mountAbout = (el: Element, p: { app?: api.App; set?: api.Preset; catalog: api.Catalog; icons?: Record<string, string> } | null) => render(p && <About {...p} />, el);
