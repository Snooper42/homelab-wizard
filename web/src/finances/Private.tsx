// A household member's private Finances on her phone's page (privacy.ts):
// above Finances, the card that turns privacy on (what it means, the page's
// one limit, her recovery code once, two of its words typed back, then
// Face ID or a passphrase), the one that unlocks them (Face ID, her
// passphrase, or her recovery code), and, while they're open, Lock.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { errorText } from '../core';
import { Card } from '../parts/Card';
import * as priv from './privacy';
import { codeWords, MIN_PASSPHRASE, newCode } from './seal';

type Step = 'idle' | 'why' | 'code' | 'check' | 'passphrase';

function TurnOn() {
  const [step, setStep] = useState<Step>('idle');
  const [code] = useState(newCode);
  const [ask] = useState(() => { const a = Math.floor(Math.random() * 8); return [a, 8 + Math.floor(Math.random() * 8)]; });
  const [typed, setTyped] = useState(['', '']);
  const [pass, setPass] = useState(['', '']);
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState('');
  const words = codeWords(code);
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setSaid('');
    try { await fn(); } catch (e) { setSaid(errorText(e)); } finally { setBusy(''); }
  };
  const checked = typed.every((t, i) => t.trim().toLowerCase() === words[ask[i]]);
  const withPasskey = () => run('Asking for Face ID…', async () => {
    const prf = await priv.makePasskey();
    if (!prf) { setStep('passphrase'); setSaid('This phone’s passkeys can’t lock them on this page, so choose a passphrase instead.'); return; }
    await priv.turnOn({ code, prf });
  });
  const withPassphrase = () => run('Making them private…', async () => {
    if (pass[0].length < MIN_PASSPHRASE) throw new Error(`A passphrase is ${MIN_PASSPHRASE} characters or more.`);
    if (pass[0] !== pass[1]) throw new Error('The two passphrases are different. Type the same one twice.');
    await priv.turnOn({ code, passphrase: pass[0] });
  });

  if (step === 'idle') {
    return <Card kind="fx-private" id="finPrivateOn">
      <p><b>Only you can see these?</b> Make your Finances private: only you can open them, with Face ID or your recovery code. Not even the person who runs the homelab can.</p>
      <button class="primary small" onClick={() => setStep('why')}>Make them private…</button>
    </Card>;
  }
  return <Card kind="fx-private" id="finPrivateOn">
    <h2>Make your Finances private</h2>
    {step === 'why' && <>
      <p>Your accounts, bills and bank files are locked on this phone before they go to the homelab, which keeps them without being able to open them. Only you can open them, with Face ID or your recovery code.</p>
      <p class="lead warn" id="finPrivateLimit">This page comes from the homelab computer, so they stay private as long as that page is the homelab’s own. The Homelab app on your iPhone is the stronger place to keep them.</p>
      <p>If you lose both your passkey and your recovery code, no one can open them, you included. What the household shares with you stays as it is.</p>
      <div class="fx-privatebtns"><button class="primary small" onClick={() => setStep('code')}>Continue</button><button class="linkbtn" onClick={() => setStep('idle')}>Cancel</button></div>
    </>}
    {step === 'code' && <>
      <p>Your recovery code. Write these 16 words down, in order, and keep them somewhere safe: they open your Finances on a new phone. They’re shown only now.</p>
      <ol class="fx-code" id="finPrivateCode">{words.map((w) => <li>{w}</li>)}</ol>
      <div class="fx-privatebtns"><button class="primary small" onClick={() => setStep('check')}>I wrote them down</button><button class="linkbtn" onClick={() => setStep('idle')}>Cancel</button></div>
    </>}
    {step === 'check' && <>
      <p>To be sure they’re written down, type two of them.</p>
      {ask.map((n, i) => <label class="field">Word {n + 1} <input value={typed[i]} autocapitalize="none" autocomplete="off" spellcheck={false} onInput={(e) => { const t = [...typed]; t[i] = e.currentTarget.value; setTyped(t); }} /></label>)}
      <div class="fx-privatebtns">
        <button class="primary small" disabled={!checked || !!busy} onClick={withPasskey}>Make them private with Face ID</button>
        <button class="linkbtn" disabled={!checked || !!busy} onClick={() => { setSaid(''); setStep('passphrase'); }}>Use a passphrase instead</button>
        <button class="linkbtn" onClick={() => setStep('code')}>Show the words again</button>
      </div>
    </>}
    {step === 'passphrase' && <>
      <p>A passphrase opens them on this phone ({MIN_PASSPHRASE} characters or more); your recovery code still opens them anywhere.</p>
      <label class="field">Passphrase <input type="password" autocomplete="new-password" value={pass[0]} onInput={(e) => setPass([e.currentTarget.value, pass[1]])} /></label>
      <label class="field">The same again <input type="password" autocomplete="new-password" value={pass[1]} onInput={(e) => setPass([pass[0], e.currentTarget.value])} /></label>
      <div class="fx-privatebtns"><button class="primary small" disabled={!!busy} onClick={withPassphrase}>Make them private</button><button class="linkbtn" onClick={() => setStep('idle')}>Cancel</button></div>
    </>}
    {busy && <p class="muted" role="status">{busy}</p>}
    {said && <p class="formerr bad" role="alert">{said}</p>}
  </Card>;
}

function Unlock() {
  const [how, setHow] = useState<'main' | 'code'>('main');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setSaid('');
    try { await fn(); } catch (e) { setSaid(errorText(e)); setBusy(false); }
  };
  return <Card kind="fx-private" id="finPrivateLocked">
    <h2>Your Finances are private</h2>
    <p>Only you can open them, with {priv.byPasskey() ? 'Face ID' : 'your passphrase'} or your recovery code.</p>
    {how === 'main' && (priv.byPasskey()
      ? <button class="primary small" disabled={busy} onClick={() => run(priv.unlockWithPasskey)}>Unlock with Face ID</button>
      : <form onSubmit={(e) => { e.preventDefault(); run(() => priv.unlockWithPassphrase(text)); }}>
        <label class="field">Passphrase <input type="password" autocomplete="current-password" value={text} onInput={(e) => setText(e.currentTarget.value)} /></label>
        <button class="primary small" disabled={busy || !text}>Unlock</button>
      </form>)}
    {how === 'code' && <form onSubmit={(e) => { e.preventDefault(); run(() => priv.unlockWithCode(text)); }}>
      <label class="field">Your recovery code, its 16 words <textarea id="finPrivateWords" rows={3} autocapitalize="none" autocomplete="off" spellcheck={false} value={text} onInput={(e) => setText(e.currentTarget.value)} /></label>
      <button class="primary small" disabled={busy || !text.trim()}>Unlock</button>
    </form>}
    <div class="fx-privatebtns">
      {how === 'main' ? <button class="linkbtn" onClick={() => { setHow('code'); setText(''); setSaid(''); }}>Use your recovery code</button>
        : <button class="linkbtn" onClick={() => { setHow('main'); setText(''); setSaid(''); }}>{priv.byPasskey() ? 'Use Face ID instead' : 'Use your passphrase instead'}</button>}
    </div>
    {busy && <p class="muted" role="status">Opening…</p>}
    {said && <p class="formerr bad" role="alert">{said}</p>}
  </Card>;
}

function PrivateCard() {
  const s = priv.privateState();
  if (s === 'locked') return <Unlock />;
  if (s === 'open') {
    return <p class="fx-privateon" id="finPrivateOpen"><span>Private: only you can open these.</span> <button class="linkbtn" onClick={priv.lock}>Lock</button></p>;
  }
  if (s === 'plain' && priv.mayChange()) return <TurnOn />;
  return null;
}

/** Draws the card above Finances, as her Finances are now. */
export function mountPrivate(el: Element) { render(<PrivateCard />, el); }
