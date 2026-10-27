// What every part of the frontend uses: the Go methods, finding elements,
// saying an error, and which system this is.

export const go = () => window.go.main.App;
/** An element by ID, loosely typed: it may be an input, a button, a details. */
export const $ = (id: string): any => document.getElementById(id);
/** The elements a selector finds, loosely typed like $. */
export const $$ = (sel: string, root: ParentNode = document): any[] => [...root.querySelectorAll(sel)];
/** The first element a selector finds, or null; loosely typed like $. */
export const $1 = (sel: string, root: ParentNode = document): any => root.querySelector(sel);


let errorTimer = 0;
export function showError(e) {
  const el = $('error');
  el.textContent = String((e && e.message) || e);
  el.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => (el.hidden = true), 6000);
}

// Each platform's conventions (style.css): html.os-mac, os-windows, or os-linux.
const platform = navigator.platform || navigator.userAgent;
export const osName = /Mac/.test(platform) ? 'mac' : /Win/.test(platform) ? 'windows' : 'linux';
document.documentElement.classList.add('os-' + osName);
export const isMac = osName === 'mac';
// This computer, as each system calls it (.env.example's "This Mac" section).
export const thisMachine = isMac ? 'This Mac' : osName === 'windows' ? 'This PC' : 'This machine';
export const mod = isMac ? '⌘' : 'Ctrl+';

/** How old a screen's data may be when it is picked before it is read again (app.ts). */
export const minute = 60000;

/** What an error says, in plain text. */
export const errorText = (e) => String((e && e.message) || e);
