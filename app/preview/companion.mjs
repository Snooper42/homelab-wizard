// The phone's bridge (web/dist/companion.js) with a stand-in page and
// computer: an answer in lines (StatusBoard) is answered with its result
// while a slow card's line is still to come, each card is emitted as it
// comes, and an error line fails the call. The last Status is kept, and
// drawn with a line saying when while the computer can't be reached. make
// frontend-check runs it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', '..', 'web', 'dist', 'companion.js'), 'utf8');
globalThis.window = globalThis;
globalThis.location = { hash: '', pathname: '/' };
const stored = new Map([['homelab.companion.token', 'paired']]);
globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)), removeItem: (k) => stored.delete(k) };
const note = { hidden: true, textContent: '' };
const classes = new Set();
globalThis.document = { documentElement: { classList: { add: (c) => classes.add(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } }, getElementById: (id) => (id === 'awayNote' ? note : null) };
globalThis.addEventListener = () => {};
// Each call's answer is a stream the check writes to with send.
let send;
globalThis.fetch = async () => {
  const body = new ReadableStream({ start(c) { send = (t) => c.enqueue(new TextEncoder().encode(t)); send.end = () => c.close(); } });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
};
(0, eval)(src);
const keep = setInterval(() => {}, 100); // the stand-in stream holds no I/O open
const tick = () => new Promise((r) => setTimeout(r, 10));
const fail = (why) => { console.error('companion.js: ' + why); process.exit(1); };
setTimeout(() => fail('an answer never came'), 5000);

const got = [];
window.runtime.EventsOn('status:card', (c) => got.push(c.name));
const answer = window.go.main.App.StatusBoard(1, ['watchdog', 'week']);
await tick();
send('{"event":"status:card","data":{"name":"watchdog"}}\n{"result":{"apps":[]');
send('}}\n'); // a line split across two reads
const st = await answer;
if (!Array.isArray(st?.apps) || got.join() !== 'watchdog') fail('before the slow card: ' + JSON.stringify([st, got]));
send('{"event":"status:card","data":{"name":"week"}}');
send.end();
await tick();
if (got.join() !== 'watchdog,week') fail('the last card, with no newline after it: ' + got);

const failed = window.go.main.App.StatusBoard(2, []);
await tick();
send('{"error":"the container runtime is not running"}\n');
send.end();
await failed.then(() => fail('answered on an error line'), (e) => { if (e.message !== 'the container runtime is not running') fail(e.message); });
// A method the computer does not serve to phones (404): named, so the page
// can let it pass quietly (core.ts's notOnPhone); any other failure is not.
globalThis.fetch = async (url) => new Response(JSON.stringify({ error: url.endsWith('/Setup') ? 'not on the phone: use Homelab Wizard on the computer' : 'the container runtime is not running' }), { status: url.endsWith('/Setup') ? 404 : 500, headers: { 'Content-Type': 'application/json' } });
await window.go.main.App.Setup().then(() => fail('answered a 404'), (e) => { if (e.name !== 'NotOnPhone') fail('a 404 is named ' + e.name); });
await window.go.main.App.Status().then(() => fail('answered a 500'), (e) => { if (e.name === 'NotOnPhone') fail('a 500 named NotOnPhone'); });

// The computer that draws Status is kept too (Host, Catalog, Appearance), and nothing else.
globalThis.fetch = async (url) => new Response(JSON.stringify({ result: url.endsWith('/Host') ? { os: 'macOS', rootOK: true } : { jobs: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
await window.go.main.App.Host();
await window.go.main.App.Backups();

// The last Status, offline: the one answered above is kept, with when.
const last = JSON.parse(stored.get('homelab.companion.lastStatus') || 'null');
if (!Array.isArray(last?.answers?.StatusBoard?.apps) || !last.at) fail('the last Status was not kept: ' + JSON.stringify(last));
// The computer can't be reached: Status is the one kept, with a line saying when; anything else still fails.
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
const offline = await window.go.main.App.StatusBoard(3, []);
if (!Array.isArray(offline?.apps)) fail('no Status while away: ' + JSON.stringify(offline));
if (note.hidden || !/can't be reached from here.*Status as it was at /.test(note.textContent) || !classes.has('away')) fail('no line saying it is the last Status: ' + JSON.stringify([note, [...classes]]));
await window.go.main.App.Backups().then(() => fail('answered Backups while away'), (e) => { if (!/can't be reached from here/.test(e.message)) fail('Backups away: ' + e.message); });
if ((await window.go.main.App.Screen()) !== '') fail('Screen away is not "nothing asked"');
if ((await window.go.main.App.Host())?.os !== 'macOS') fail('Host away is not the one kept');
if ('Backups' in JSON.parse(stored.get('homelab.companion.lastStatus')).answers) fail('Backups was kept, though Status is not drawn from it');
// Reached again: the next Status puts the line away.
globalThis.fetch = async () => new Response('{"result":{"apps":[{"id":"navidrome"}]}}\n', { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } });
await window.go.main.App.StatusBoard(4, []);
await tick();
if (!note.hidden || classes.has('away')) fail('the line stayed once Status came through');
if (JSON.parse(stored.get('homelab.companion.lastStatus')).answers.StatusBoard.apps[0]?.id !== 'navidrome') fail('the newer Status was not kept');
// Unpaired (401): the kept Status goes with the token.
globalThis.fetch = async () => new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } });
// (the pairing form it then draws needs a page this stand-in hasn't, so its failure is let pass)
await window.go.main.App.Status().catch(() => {});
await tick();
if (stored.has('homelab.companion.lastStatus')) fail('the kept Status stayed after the phone was unpaired');
clearInterval(keep);
console.log('companion.js: an answer in lines is read as it comes, a method not served is named, and the last Status is kept for when the computer is away');
process.exit(0);
