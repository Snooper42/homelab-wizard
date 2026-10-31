// The phone's bridge (web/dist/companion.js) with a stand-in page and
// computer: an answer in lines (StatusBoard) is answered with its result
// while a slow card's line is still to come, each card is emitted as it
// comes, and an error line fails the call. make frontend-check runs it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', '..', 'web', 'dist', 'companion.js'), 'utf8');
globalThis.window = globalThis;
globalThis.location = { hash: '', pathname: '/' };
globalThis.localStorage = { getItem: () => 'paired', setItem() {}, removeItem() {} };
globalThis.document = { documentElement: { classList: { add() {}, toggle() {} } }, getElementById: () => null };
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
clearInterval(keep);
console.log('companion.js: an answer in lines is read as it comes, and a method not served is named');
process.exit(0);
