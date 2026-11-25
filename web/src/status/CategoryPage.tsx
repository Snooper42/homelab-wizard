// A category's page on Status (the owner, Nov 25: computer-category-full-dark.png): its apps on this machine as big
// tiles, three across (two on a phone), each with its state's dot, one live line, Open or Start, and ⋯; then every
// catalog app of the category not installed yet, faded, each with Install (Choose apps' flow: the plan first).
// "Your own apps" has no shelf: they come from no catalog.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { AppMark } from '../parts/AppMark';
import { Icon } from '../Icon';
import { type AppListProps, Actions, matches, stateOf } from './AppList';
import { RowMenu } from './RowMenu';

export interface CategoryPageProps {
  /** Its name, as the menu has it. */
  label: string;
  /** Its apps on this machine, in the list's order. */
  apps: api.AppStatus[];
  /** Every catalog app of the category not installed; none for your own apps. */
  add: api.App[];
  /** "On this Mac", "On the server". */
  here: string;
  /** The app list's props: its actions, icons, what each button is doing. */
  list: AppListProps;
  /** Install: Choose apps with it ticked, its plan shown first. */
  install: (id: string) => void;
}

const doing: Record<string, string> = { start: 'Starting…', stop: 'Stopping…', restart: 'Restarting…', update: 'Updating…', rollback: 'Rolling back…' };

/** How long it's been up, as a tile says it: "Up 6 days". */
export function upFor(since: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000)), hours = Math.round(mins / 60);
  return mins < 2 ? 'Up a minute' : mins < 60 ? `Up ${mins} min` : hours < 48 ? `Up ${hours} ${hours === 1 ? 'hour' : 'hours'}` : `Up ${Math.round(hours / 24)} days`;
}

/** A tile's dot and its one live line: what its button is doing, else its state (how long it's been up when well). */
export function tileLine(a: api.AppStatus, p: Pick<AppListProps, 'pending' | 'batteryPaused' | 'held'>, now = Date.now()): [string, string] {
  const pend = p.pending[a.id];
  if (pend && !pend.failed) return ['warn', pend.note || doing[pend.action] || 'Working…'];
  const [cls, words] = stateOf(a, p.batteryPaused, p.held);
  if (pend?.failed) return ['bad', `Could not ${pend.action}`];
  if (cls === 'ok' && a.health === 'native') return [cls, 'Running'];
  return [cls, cls === 'ok' && a.since ? upFor(a.since, now) : words];
}

interface MenuAt { id: string; x: number; y: number; from: Element | null }

function Tile({ a, p, menu, setMenu }: { a: api.AppStatus; p: AppListProps; menu: MenuAt | null; setMenu: (m: MenuAt | null) => void }) {
  const [cls, line] = tileLine(a, p);
  const [said, say] = useState('');
  const entry = p.catalog?.apps.find((c) => c.id === a.id);
  const pend = p.pending[a.id];
  const menuable = a.state !== 'missing' && a.state !== 'elsewhere' && (!p.companion || document.documentElement.classList.contains('can-change'));
  const close = (refocus?: boolean) => {
    const from = menu?.from as HTMLElement | null;
    setMenu(null);
    if (refocus && from?.isConnected) from.focus();
  };
  return (
    <li class={'cattile' + (menu?.id === a.id ? ' menued' : '')} data-app={a.id}
      onClick={a.state !== 'missing' ? (e) => { if (!(e.target as Element).closest('button, .rowmenu')) p.on.page(a); } : undefined}>
      <span class={'dot ' + cls} role="img" aria-label={line} />
      {menuable && <button type="button" class="iconbtn catmore" aria-label={`${a.name}: more`} aria-haspopup="menu"
        onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ id: a.id, x: r.right - 200, y: r.bottom + 4, from: e.currentTarget }); }}>
        <Icon name="more" /></button>}
      <AppMark id={a.id} name={a.name} icon={p.icons?.[a.id] || ''} />
      <strong class="catname">{a.name}</strong>
      <span class={'catline' + (cls === 'bad' ? ' bad' : '')} title={line}>{said || line}</span>
      <span class="catbtn"><Actions a={a} entry={entry} busy={p.busy || (!!pend && !pend.failed)} os={p.os} on={p.on} marks /></span>
      {menu?.id === a.id && <RowMenu a={a} x={menu.x} y={menu.y} native={entry?.kind === 'native'} busy={p.busy} companion={p.companion} on={p.on.menu} close={close} said={say} />}
    </li>
  );
}

function Shelf({ app, icon, install, change }: { app: api.App; icon: string; install: (id: string) => void; change: boolean }) {
  return (
    <li class="cattile toadd" data-app={app.id}>
      <AppMark id={app.id} name={app.name} icon={icon} />
      <strong class="catname">{app.name}</strong>
      <span class="catline" title={app.description}>{app.description}</span>
      {change && <span class="catbtn"><button type="button" class="small" onClick={() => install(app.id)}><Icon name="update" />Install</button></span>}
    </li>
  );
}

export function CategoryPage({ label, apps, add, here, list, install }: CategoryPageProps) {
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [find, setFind] = useState('');
  const running = apps.filter((a) => a.state === 'running').length;
  const shown = find ? apps.filter((a) => matches(a, find)) : apps;
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const toAdd = find ? add.filter((x) => plain(x.name + ' ' + x.description).includes(plain(find))) : add;
  // A phone that only looks installs nothing.
  const change = !list.companion || document.documentElement.classList.contains('can-change');
  const facts = [`${apps.length} ${here.replace(/^On /, 'on ')}`, apps.length ? `${running} running` : '', add.length ? `${add.length} to add` : ''].filter(Boolean).join(' · ');
  return (
    <div class="catpage">
      <div class="row header">
        <div><h1>{label}</h1><p class="lead">{facts}</p></div>
        <label class="catfind"><Icon name="search" /><input type="search" placeholder="Find an app" aria-label="Find an app" value={find} onInput={(e) => setFind((e.currentTarget as HTMLInputElement).value)} /></label>
      </div>
      <h2 class="cathead">{here} <span class="n">{apps.length}</span></h2>
      {shown.length ? <ul class="cattiles">{shown.map((a) => <Tile key={a.id} a={a} p={list} menu={menu} setMenu={setMenu} />)}</ul>
        : <p class="muted catnone">{find ? 'None by that name' : 'None yet'}</p>}
      {add.length > 0 && <>
        <h2 class="cathead">Add to {label} <span class="n">{add.length}</span></h2>
        {toAdd.length ? <ul class="cattiles">{toAdd.map((x) => <Shelf key={x.id} app={x} icon={list.icons?.[x.id] || ''} install={install} change={change} />)}</ul>
          : <p class="muted catnone">None by that name</p>}
      </>}
    </div>
  );
}

export const mountCategoryPage = (el: Element, props: CategoryPageProps | null) => render(props && <CategoryPage {...props} />, el);
