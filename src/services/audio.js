import { requestClip } from './api'

// One player for the whole app: starting a clip stops the previous one.
// Recordings come from the server's voice (MiMo by default); if the server
// cannot produce one, the most natural voice this browser has reads it.

let current = null
let bestVoice = null
const listeners = new Set()

function notify(id) {
  for (const fn of listeners) fn(id)
}

export function onPlayingChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function pickVoice() {
  try {
    const voices = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang))
    const score = v => {
      const n = v.name
      let s = /en[-_]US/i.test(v.lang) ? 3 : 0
      if (/Online \(Natural\)/i.test(n)) s += 100
      else if (/\(Premium\)/i.test(n)) s += 90
      else if (/\(Enhanced\)/i.test(n)) s += 80
      else if (/^Google US English/i.test(n)) s += 70
      else if (/Samantha|Ava|Allison|Zoe/i.test(n)) s += 50
      return s
    }
    bestVoice = voices.sort((a, b) => score(b) - score(a))[0] || null
  } catch {
    bestVoice = null
  }
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

export function stop() {
  if (current?.audio) {
    current.audio.onended = null
    current.audio.pause()
  }
  try { speechSynthesis.cancel() } catch { /* no speech engine */ }
  current = null
  notify(null)
}

function browserSpeak(id, text, rate) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    if (bestVoice) u.voice = bestVoice
    u.lang = bestVoice?.lang || 'en-US'
    u.rate = rate
    u.onend = u.onerror = () => { if (current?.id === id) { current = null; notify(null) } }
    speechSynthesis.speak(u)
  } catch {
    current = null
    notify(null)
  }
}

/**
 * Play a clip. `clip` is { text, kind, url, ready } from the API; clips that are
 * not ready are recorded on demand first (about three seconds).
 */
export async function play(id, clip, { slow = false } = {}) {
  stop()
  const rate = slow ? 0.85 : 1
  current = { id }
  notify(id)
  let url = clip.ready ? clip.url : null
  if (!url) {
    try {
      const made = await requestClip(clip.text, clip.kind)
      url = made.url
      clip.ready = true
      clip.url = url
    } catch {
      url = null
    }
  }
  if (current?.id !== id) return // another clip started while this one was being recorded
  if (!url) return browserSpeak(id, clip.text, rate)
  const audio = new Audio(url)
  audio.playbackRate = rate
  current.audio = audio
  audio.onended = () => { if (current?.id === id) { current = null; notify(null) } }
  audio.onerror = () => { if (current?.id === id) browserSpeak(id, clip.text, rate) }
  audio.play().catch(() => audio.onerror?.())
}
