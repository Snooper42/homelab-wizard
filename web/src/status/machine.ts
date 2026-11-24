// This machine's facts as Setup last read them (screens/setup.ts drawHealth), for Status' This Mac card: here so
// Status reads them without importing Setup, which imports Status.
import type { HealthProps } from '../setup/Health';

let now: HealthProps | null = null;
const listeners = new Set<() => void>();

/** Setup's latest: the card redraws. */
export function setMachine(p: HealthProps | null) { now = p; listeners.forEach((f) => f()); }
/** What Setup read last, or null (not read yet, or a phone). */
export const machineNow = () => now;
/** Calls back when Setup reads the machine again. */
export const onMachine = (f: () => void) => { listeners.add(f); };
