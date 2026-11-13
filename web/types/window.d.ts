// The globals the frontend runs with: Wails's bridge in the desktop app, or
// companion.js's on a phone. backend.d.ts (generated) has the Go side's types.

interface WailsRuntime {
  /** Calls fn with each of the Go side's events of this name; the result stops it. */
  EventsOn<K extends keyof BackendEvents>(name: K, fn: (data: BackendEvents[K]) => void): () => void;
  EventsEmit<K extends keyof BackendEvents>(name: K, data?: BackendEvents[K]): void;
  ClipboardSetText?(text: string): Promise<boolean>;
}

interface Window {
  go: { main: { App: Backend } };
  runtime: WailsRuntime;
}

/** What only a phone can call: homelab serve answers it (phoneMethods in cmd/homelab/serve.go). */
interface Backend {
  /** A diagnostics report with every secret removed, and who to send it to. */
  Report?(): Promise<{ text: string; helper: string }>;
  /** A member's private Finances, as the computer keeps them (null: not private). Her own phone only. */
  FinancesSealed?(): Promise<import('../src/finances/seal').Envelope | null>;
  /** Keeps her sealed Finances: "new" turns privacy on; a stale rev is refused. */
  SaveFinancesSealed?(rev: string, e: import('../src/finances/seal').Envelope): Promise<{ rev: string }>;
  /** A sealed receipt, by its name, as her phone sealed it. */
  FinancesSealedReceipt?(name: string): Promise<string>;
  /** Keeps a sealed receipt; answers its name. */
  SaveFinancesSealedReceipt?(sealed: string): Promise<string>;
}
