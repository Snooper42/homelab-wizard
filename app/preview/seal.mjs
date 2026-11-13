// A member's private Finances, sealed on her phone's page
// (web/src/finances/seal.ts, private-finances.md 3.1), checked under Node,
// whose WebCrypto is the browser's: scrypt against RFC 7914's own vectors,
// a seal opened by the recovery code, the passphrase and the passkey alike,
// and a wrong code, another member's name, a changed byte or a changed key
// refused. The envelope has the shape the computer keeps
// (internal/finance/sealed.go's check). make frontend-check runs it.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({ entryPoints: [join(here, '..', '..', 'web', 'src', 'finances', 'seal.ts')], bundle: true, format: 'esm', write: false, logLevel: 'warning' });
const s = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const fail = (why) => { console.error('seal.ts: ' + why); process.exit(1); };
const hex = (b) => Buffer.from(b).toString('hex');
const text = (t) => new TextEncoder().encode(t);
const refused = async (what, p) => { try { await p; } catch (e) { return String(e.message || e); } fail(what + ' was not refused'); };

// RFC 7914 section 12: the two vectors a phone can run in a moment.
const vectors = [
  ['password', 'NaCl', 1024, 8, 16, 'fdbabe1c9d3472007856e7190d01e9fe7c6ad7cbc8237830e77376634b3731622eaf30d92e22a3886ff109279d9830dac727afb94a83ee6d8360cbdfa2cc0640'],
  ['pleaseletmein', 'SodiumChloride', 16384, 8, 1, '7023bdcb3afd7348461c06cd81fd38ebfda8fbba904f8e3ea9b543f6545da1f2d5432955613f0fcf62d49705242a9af9e61e85dc0d651e40dfcf017b45575887'],
];
for (const [pw, salt, n, r, p, want] of vectors) {
  const got = hex(await s.scrypt(text(pw), text(salt), n, r, p, 64));
  if (got !== want) fail(`scrypt(${pw}, ${salt}, ${n}, ${r}, ${p}) = ${got}`);
}

// The recovery code: 16 random bytes, said as 16 words and read back from them however typed.
const code = s.newCode();
const words = s.codeWords(code);
if (words.length !== 16 || new Set(s.WORDS).size !== 256 || s.WORDS.some((w) => !/^[a-z]{3,7}$/.test(w))) fail('the recovery code is 16 of 256 plain words: ' + words.join(' '));
if (hex(s.codeFromWords('  ' + words.join('  ').toUpperCase() + '\n')) !== hex(code)) fail('the code was not read back from its words');
if (s.codeFromWords(words.slice(1).join(' ')) || s.codeFromWords(words.join(' ').replace(words[3], 'zzz'))) fail('a short code, or one with a word not on the list, was read');

// Made-up Finances, never anyone's.
const data = { plan: { cushion: 500, accounts: [{ id: 'checking', name: 'Checking', kind: 'checking', balance: 1234.5 }], payments: [] }, ledger: { transactions: [{ id: 't1', date: '2026-11-01', payee: 'Made-up Grocer', amount: -42.17 }] } };
const prf = { secret: crypto.getRandomValues(new Uint8Array(32)), credential: crypto.getRandomValues(new Uint8Array(16)) };

for (const how of [{ code, prf }, { code, passphrase: 'correct horse battery' }]) {
  const { envelope, key } = await s.turnOn(data, 'anna', how);
  // The shape the computer keeps, and nothing in the clear.
  const b = (v) => Buffer.from(v || '', 'base64');
  const k = envelope.kdf;
  if (envelope.version !== 1 || envelope.rev || k.name !== 'scrypt' || k.n !== 1 << 17 || k.r !== 8 || k.p !== 1 || b(k.salt).length !== 16) fail('the envelope: ' + JSON.stringify({ ...envelope, sealed: '…' }));
  if (b(envelope.wrappedByCode).length !== 60 || b(envelope.wrappedByPasskey).length !== 60) fail('a wrapped key is a nonce, the key and its tag');
  if (how.prf ? hex(b(k.passkey)) !== hex(prf.credential) || k.passphraseSalt : b(k.passphraseSalt).length !== 16 || k.passkey) fail('how the passkey or the passphrase wraps it: ' + JSON.stringify(k));
  if (Object.keys(envelope).sort().join() !== 'kdf,sealed,version,wrappedByCode,wrappedByPasskey') fail('the envelope has only its own fields: ' + Object.keys(envelope));
  if (JSON.stringify(envelope).includes('Made-up') || b(envelope.sealed).includes('Made-up')) fail('the plain Finances are in the envelope');

  // Each way opens the same data key, and the key the same Finances.
  const byCode = await s.unlockWithCode(envelope, 'anna', code);
  const other = how.prf ? await s.unlockWithPasskey(envelope, 'anna', prf.secret) : await s.unlockWithPassphrase(envelope, 'anna', 'correct horse battery');
  for (const kk of [key, byCode, other]) {
    if (JSON.stringify(await s.openSealed(kk, envelope, 'anna')) !== JSON.stringify(data)) fail('a key did not open the same Finances');
  }

  // Refused: a wrong code, a wrong passphrase or passkey, her envelope as another member's, a byte changed.
  const wrong = await refused('a wrong recovery code', s.unlockWithCode(envelope, 'anna', s.newCode()));
  if (!/recovery code/.test(wrong)) fail('a wrong code is said plainly: ' + wrong);
  await refused('a wrong second way', how.prf ? s.unlockWithPasskey(envelope, 'anna', new Uint8Array(32)) : s.unlockWithPassphrase(envelope, 'anna', 'correct horse battery!'));
  await refused('another member', s.unlockWithCode(envelope, 'sam', code));
  await refused('another member opening hers', s.openSealed(key, envelope, 'sam'));
  const bytes = b(envelope.sealed);
  bytes[bytes.length - 3] ^= 1;
  await refused('a changed byte (the tag)', s.openSealed(key, { ...envelope, sealed: bytes.toString('base64') }, 'anna'));

  // A save seals again with the same key: a new nonce, the same ways to open it.
  const next = { ...data, plan: { ...data.plan, cushion: 600 } };
  const saved = await s.reseal(key, envelope, 'anna', next);
  if (saved.sealed === envelope.sealed || saved.wrappedByCode !== envelope.wrappedByCode) fail('a save seals anew under the same key');
  if ((await s.openSealed(await s.unlockWithCode(saved, 'anna', code), saved, 'anna')).plan.cushion !== 600) fail('a save opened by the code');

  // A receipt, sealed as bytes: opened again, and refused for another member.
  const receipt = await s.sealText(key, 'anna', 'data:image/jpeg;base64,AAAA');
  if (receipt.includes('AAAA') || (await s.openText(key, 'anna', receipt)) !== 'data:image/jpeg;base64,AAAA') fail('a receipt sealed and opened');
  await refused('a receipt as another member', s.openText(key, 'sam', receipt));
}
await refused('a passphrase under 12 characters', s.turnOn(data, 'anna', { code, passphrase: 'short one' }));
console.log('seal.ts: scrypt matches RFC 7914; sealed Finances open by each way and refuse the rest');
