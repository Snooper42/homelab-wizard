// Settings › Appearance: how the app looks on this computer. Each choice
// shows at once and is kept beside the window's place (app/tray/appearance.go),
// not in .env: it is this person's, not the homelab's.
import { render } from 'preact';

/** Accents to pick in one click; Any colour… opens the system's picker. */
export const swatches: [string, string][] = [
  ['Blue', '#2563eb'], ['Purple', '#7c3aed'], ['Pink', '#db2777'], ['Red', '#dc2626'],
  ['Orange', '#ea580c'], ['Yellow', '#ca8a04'], ['Green', '#16a34a'], ['Teal', '#0d9488'], ['Graphite', '#52525b'],
];

export interface AppearanceProps {
  look: tray.Appearance;
  /** The accent the system gave, if it gave one. */
  system?: app.Accent;
  /** What to say when the system gives no accent, where that differs (differs.ts). */
  noAccent?: string;
  set: (look: tray.Appearance) => void;
}

/** One choice of several, as a row of buttons. */
function Choice({ label, value, options, pick }: { label: string; value: string; options: [string, string][]; pick: (v: string) => void }) {
  return (
    <div class="look-row" role="radiogroup" aria-label={label}>
      <span class="look-label">{label}</span>
      <div class="seg">
        {options.map(([v, text]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} class={value === v ? 'on' : ''} onClick={() => pick(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

/** The swatches, the system's accent, and the picker for any other. */
function Colours({ label, value, system, systemLabel, pick }: { label: string; value: string; system?: string; systemLabel: string; pick: (v: string) => void }) {
  const custom = !!value && value.startsWith('#') && !swatches.some(([, c]) => c === value);
  return (
    <div class="look-row" role="radiogroup" aria-label={label}>
      <span class="look-label">{label}</span>
      <div class="swatches">
        <button type="button" role="radio" aria-checked={!value} title={systemLabel} class={'swatch system' + (!value ? ' on' : '')}
          style={system ? { '--c': system } : undefined} onClick={() => pick('')}><span class="sr">{systemLabel}</span></button>
        {swatches.map(([name, c]) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} title={name} class={'swatch' + (value === c ? ' on' : '')}
            style={{ '--c': c }} onClick={() => pick(c)}><span class="sr">{name}</span></button>
        ))}
        <label class={'swatch any' + (custom ? ' on' : '')} title="Any colour…" style={custom ? { '--c': value } : undefined}>
          <input type="color" aria-label={label + ': any colour'} value={value.startsWith('#') ? value : '#2563eb'}
            onInput={(e) => pick(e.currentTarget.value)} />
        </label>
      </div>
    </div>
  );
}

export function Appearance({ look, system, noAccent, set }: AppearanceProps) {
  const put = (k: keyof tray.Appearance) => (v: string) => set({ ...look, [k]: v });
  const iconMode = !look.icon ? '' : look.icon === 'accent' ? 'accent' : 'own';
  return (
    <>
      <div class="row"><h2>Appearance</h2><span class="muted">on this computer</span></div>
      <Choice label="Theme" value={look.theme} options={[['system', 'Like the system'], ['light', 'Light'], ['dark', 'Dark']]} pick={put('theme')} />
      <Colours label="Accent" value={look.accent} system={system?.light} systemLabel={system ? 'The system’s accent' : 'The usual blue'} pick={put('accent')} />
      {!system && !!noAccent && <p id="noAccent" class="muted look-help">{noAccent}</p>}
      <Choice label="Contrast" value={look.contrast} options={[['system', 'Like the system'], ['more', 'More']]} pick={put('contrast')} />
      <Choice label="Layout" value={look.layout} options={[['classic', 'Classic'], ['islands', 'Islands']]} pick={put('layout')} />
      <p class="muted look-help">Islands sets the sidebar and the page apart as panels of their own, with space around them.</p>
      <Choice label="Tray icon" value={iconMode} options={[['', 'Usual'], ['accent', 'Accent'], ['own', 'Its own colour']]}
        pick={(v) => set({ ...look, icon: v === 'own' ? (look.icon.startsWith('#') ? look.icon : look.accent || '#2563eb') : v })} />
      {iconMode === 'own' && <Colours label="Icon colour" value={look.icon} systemLabel="The usual icon" pick={(v) => set({ ...look, icon: v })} />}
      <p class="muted look-help">The icon in the menu bar (the system tray on Windows and Linux) takes its new colour within a few seconds.</p>
    </>
  );
}

export function mountAppearance(el: HTMLElement, props: AppearanceProps) { render(<Appearance {...props} />, el); }
