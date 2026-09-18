import { useSyncExternalStore } from 'react';
import type { WvWReport } from '../types/report';
import type { RawCapture } from '../lib/insight/rawCapture';
const listeners = new Set<() => void>();
let state: { capture: RawCapture | null; report: WvWReport | null } = { capture: null, report: null };
export function setRawCapture(capture: RawCapture | null, report: WvWReport | null = null) { state = { capture, report }; listeners.forEach(fn => fn()); }
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function useRawCapture() { return useSyncExternalStore(subscribe, () => state); }
