// Explain this log: the Ollama on this machine reads the app's last lines
// and says what is wrong, why, and what to try. The log stays here.
import { render } from 'preact';
import { useState } from 'preact/hooks';

export interface ExplainProps {
  /** The Ollama model that answers. */
  model: string;
  ask: () => Promise<string>;
}

export function Explain({ model, ask }: ExplainProps) {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [problem, setProblem] = useState('');
  const go = async () => {
    setBusy(true);
    setProblem('');
    try { setAnswer(await ask()); } catch (e: any) { setProblem(String(e?.message || e)); } finally { setBusy(false); }
  };
  return (
    <div class="explain">
      <div class="row">
        <button class="small" disabled={busy} onClick={go}>{busy ? 'Reading the log…' : answer ? 'Ask again' : 'Explain this log'}</button>
        <span class="muted">{model.replace(/:latest$/, '')}, on this machine: the log stays here</span>
      </div>
      {answer && !busy && <p class="answer">{answer}</p>}
      {problem && <p class="muted">{problem}</p>}
    </div>
  );
}

export function mountExplain(el: Element, props: ExplainProps) { render(<Explain {...props} />, el); }
