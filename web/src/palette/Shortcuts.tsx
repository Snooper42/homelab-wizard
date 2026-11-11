// The sheet of shortcuts: ? (Shift+/ on most keyboards) on any screen, with
// the focus not in a field, or Keyboard shortcuts in the command palette.
// The shortcuts of the screen you are on come first, then those that work
// everywhere, then each screen's own key. Not on the phone or a wall
// screen, nor over another sheet or the palette. A new shortcut needs its
// line here too: the lists below are what the keyboard handlers do (app.ts,
// the Status filter, the menus, the calendar), written out by hand.
import { render } from 'preact';
import { Sheet } from '../parts/Sheet';
import { isMac, mod, onPhone } from '../core';

/** One line: its keys (pressed together, or each alone where there are more), and what it does. */
type Line = [keys: string[], what: string];

const names: Record<string, string> = {
  choose: 'Choose apps', status: 'Status', backups: 'Backups', setup: 'Setup', settings: 'Settings', finances: 'Finances', tidy: 'Tidy Up',
};

/** What each screen adds to the shortcuts that work everywhere. */
function here(screen: string): Line[] {
  switch (screen) {
    case 'status':
      return [
        [['a–z'], 'Start typing an app’s name to show only the apps that match; Escape shows them all again'],
        [['↑', '↓'], 'In an app’s or a group’s menu, the item above or below'],
      ];
    case 'choose':
      return [[[mod + 'F'], 'Search the apps']];
    case 'settings':
      return [[[mod + 'F'], 'Search the settings']];
    case 'finances':
      return [
        [['←', '→'], 'On the calendar, the day before or after'],
        [['↑', '↓'], 'The week before or after'],
        [['Page Up', 'Page Down'], 'The month before or after'],
        [['Home', 'End'], 'The week’s first or last day'],
        [['T'], 'On the calendar, today'],
        [[mod + 'F'], 'In Transactions, search them'],
        [[mod + 'A'], 'In Transactions, after Select, every transaction shown; Escape stops selecting'],
      ];
    default:
      return [];
  }
}

function everywhere(): Line[] {
  const lines: Line[] = [
    [['?'], 'These shortcuts'],
    [[mod + 'K'], 'The command palette: an app, a screen or a command by name'],
    [isMac ? ['⌘[', '⌘]'] : ['Alt+←', 'Alt+→'], 'Back to the screen before, or Forward again; a two-finger swipe right or left on a trackpad does the same'],
    [isMac ? ['⌘R'] : ['Ctrl+R', 'F5'], 'Check the screen again'],
    [[mod + '+', mod + '−', mod + '0'], 'Bigger text, smaller, or the usual size'],
    [[isMac ? '⌘⇧H' : 'Ctrl+Shift+H'], 'Hide every amount, or show them again'],
    [[mod + 'Z'], 'Undo a stop or a delete, while its note shows'],
    [isMac ? ['Shift+F10'] : ['Shift+F10', 'Menu key'], 'The menu of what has the focus: a screen in the sidebar, an app’s row, a group’s heading'],
    [['Escape'], 'Close a menu or a sheet'],
  ];
  if (!isMac) lines.push([['F1'], 'The guide']);
  return lines;
}

const screens = (): Line[] => [
  [[mod + '1'], 'Choose apps'], [[mod + '2'], 'Status'], [[mod + '3'], 'Backups'], [[mod + '4'], 'Setup'],
  [[mod + ','], 'Settings'], [[mod + '6'], 'Finances'], [[mod + '7'], 'Tidy Up'],
];

function Table({ lines }: { lines: Line[] }) {
  return (
    <table class="keys">
      <tbody>
        {lines.map(([keys, what]) => (
          <tr key={what}>
            <th scope="row">{keys.map((k, i) => <>{i > 0 && ' '}<kbd>{k}</kbd></>)}</th>
            <td>{what}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Shortcuts({ screen }: { screen: string }) {
  const mine = here(screen);
  return (
    <Sheet id="keysSheet" titleId="keysTitle">
      <h2 id="keysTitle">Keyboard shortcuts</h2>
      {mine.length > 0 && <><h3>On {names[screen]}</h3><Table lines={mine} /></>}
      <h3>Everywhere</h3>
      <Table lines={everywhere()} />
      <h3>The screens</h3>
      <Table lines={screens()} />
      <div class="actions"><button class="small" onClick={closeShortcuts}>Close</button></div>
    </Sheet>
  );
}

let el: HTMLElement | null = null;
const sheet = () => el?.querySelector<HTMLElement>('#keysSheet') || null;

/** Opens the sheet for the screen shown; false where it does not open (the phone, a wall screen, a sheet or the palette open). */
export function openShortcuts(): boolean {
  const html = document.documentElement.classList;
  if (onPhone() || html.contains('kiosk') || html.contains('sheet-open') || html.contains('palette-open')) return false;
  el ||= document.getElementById('keys');
  if (!el) return false;
  const screen = document.querySelector('.screen.active')?.id || '';
  render(<Shortcuts screen={screen} />, el);
  // An open menu (a row's, a group's) closes, as a press elsewhere closes it.
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  sheet()!.hidden = false;
  return true;
}

export function closeShortcuts() {
  const s = sheet();
  if (s) s.hidden = true;
}
