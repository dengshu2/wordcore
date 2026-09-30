import { useSyncExternalStore } from 'react'

// Per-device preferences kept in localStorage (never synced to the account).
const KEY = 'wc-slow-playback'
const subscribers = new Set()

function read() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function setSlowPlayback(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* storage unavailable */ }
  subscribers.forEach(fn => fn())
}

export function useSlowPlayback() {
  return useSyncExternalStore(fn => { subscribers.add(fn); return () => subscribers.delete(fn) }, read, () => false)
}
