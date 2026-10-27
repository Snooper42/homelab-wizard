// What works differently on this system, said on the screen where it shows
// (docs/Host.md's parity table, its "said on screen" rows). Each function
// returns "" where the system works the same as the others.

/** The system the app runs on, as the parity table's columns name it. */
export type System = 'mac' | 'windows' | 'linux' | 'steamos';

/** The system from the platform's name (osName) and the machine card's OS line. */
export const systemOf = (osName: string, hostOS: string): System =>
  osName === 'mac' ? 'mac' : osName === 'windows' ? 'windows' : hostOS.includes('SteamOS') ? 'steamos' : 'linux';

/** The system from the machine card's OS line alone ("macOS 26.0", "Windows 11 24H2", "Linux (SteamOS 3.7)"). */
export const systemOfHost = (os: string): System =>
  os.startsWith('macOS') ? 'mac' : os.startsWith('Windows') ? 'windows' : os.includes('SteamOS') ? 'steamos' : 'linux';

/** A line under an app on Choose stacks, where it does less on this system. */
export function appNote(id: string, system: System): string {
  if (id === 'beszel' || id === 'beszel-agent') {
    if (system === 'mac') return "On a Mac it sees OrbStack's Linux VM, not the Mac's own processor, memory, and sensors.";
    if (system === 'windows') return "On Windows it sees Docker Desktop's WSL VM, not the PC's own processor, memory, and sensors.";
  }
  if (id === 'frigate') {
    if (system === 'mac') return 'On a Mac it detects on the processor: containers reach no Coral and no Apple graphics.';
    if (system === 'windows') return "It detects on the processor until an NVIDIA card is added by hand through WSL 2 (Frigate's note); a USB Coral can't be passed through.";
    if (system === 'linux') return "It detects on the processor until a Coral or the graphics are added by hand (Frigate's note).";
    if (system === 'steamos') return "It detects on the processor until the AMD graphics are added by hand (Frigate's note).";
  }
  return '';
}

/** Under the tray icon on the machine card: where it shows, and how something that needs a look shows. */
export function trayNote(system: System, desktop: string): string {
  if (system === 'windows') return 'Something that needs a look shows as an orange dot on the tray icon: Windows has no count on the taskbar for this kind of app.';
  if (system === 'linux' && desktop !== 'kde') return "The tray icon shows on GNOME only with the AppIndicator extension (Ubuntu's is on). Something that needs a look shows as a count on Ubuntu's dock, or as a dot on the tray icon.";
  return '';
}

/** Under Accent in Appearance, when the system gives none. */
export function noAccentNote(system: System): string {
  return system === 'linux' ? 'This desktop gives no accent colour: KDE does, and GNOME from version 47.' : '';
}
