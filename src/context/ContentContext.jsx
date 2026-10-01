import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { fetchCard, fetchWords } from '../services/api'
import { useAuth } from './AuthContext'

const ContentContext = createContext(null)

// The word list barely changes between visits, so the last copy is shown at once
// and refreshed in the background; the last studied word's card is fetched
// while progress is still loading, since it is usually the word that opens.
const WORDS_KEY = 'wc-words-v1'
const LAST_KEY = 'wc-last-word'

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key)) } catch { return null }
}

function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked */ }
}

// eslint-disable-next-line react-refresh/only-export-components -- tiny helper shared with Study
export function rememberWord(word) {
  writeCache(LAST_KEY, word)
}

// Warms the browser cache with what a card shows first: its icon and the word audio.
function warm(card) {
  const icon = card.visual?.kind === 'icon' && card.visual.icons?.[0]
  if (icon) new Image().src = `/icons/${icon}.svg`
  const clip = card.audio?.word
  if (clip?.ready && clip.url) fetch(clip.url, { priority: 'low' }).catch(() => {})
}

// Word entries use the lowercase record key as `word` so the scheduling and
// progress code can index records[word.word]; `display` keeps the proper case.
function toEntry(w) {
  return { word: w.key, display: w.word, rank: w.rank, level: w.level, kind: w.kind, pos: w.pos || [], ready: w.ready }
}

export function ContentProvider({ children }) {
  const { user } = useAuth()
  const [words, setWords] = useState(() => (user && readCache(WORDS_KEY)) || [])
  const [status, setStatus] = useState(() => (user && !readCache(WORDS_KEY) ? 'loading' : 'idle')) // idle | loading | error
  const cards = useRef(new Map())

  useEffect(() => {
    if (!user) {
      setWords([])
      setStatus('idle')
      return
    }
    let cancelled = false
    const cached = readCache(WORDS_KEY)
    if (!cached) setStatus('loading')
    fetchWords()
      .then(list => {
        if (cancelled) return
        const entries = list.map(toEntry)
        writeCache(WORDS_KEY, entries)
        setWords(entries)
        setStatus('idle')
      })
      .catch(() => { if (!cancelled && !cached) setStatus('error') })
    return () => { cancelled = true }
  }, [user])

  // Cards are fetched once per word and shared; the promise is cached so
  // concurrent callers (Study prefetching the next word) do not refetch.
  const getCard = useCallback(word => {
    const key = word.toLowerCase()
    if (!cards.current.has(key)) {
      const p = fetchCard(key).catch(err => {
        cards.current.delete(key)
        throw err
      })
      cards.current.set(key, p)
    }
    return cards.current.get(key)
  }, [])

  const prefetch = useCallback(word => {
    getCard(word).then(warm, () => {})
  }, [getCard])

  useEffect(() => {
    const last = user && readCache(LAST_KEY)
    if (last) prefetch(last)
  }, [user, prefetch])

  return (
    <ContentContext.Provider value={{ words, status, getCard, prefetch }}>
      {children}
    </ContentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- intentional: Provider and hook are co-located for cohesion
export function useContent() {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used within ContentProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components -- small hook that belongs with the provider
export function useCard(word) {
  const { getCard } = useContent()
  const [state, setState] = useState({ word: null, card: null, error: null })
  useEffect(() => {
    if (!word) return
    let cancelled = false
    getCard(word)
      .then(card => { if (!cancelled) setState({ word, card, error: null }) })
      .catch(error => { if (!cancelled) setState({ word, card: null, error }) })
    return () => { cancelled = true }
  }, [word, getCard])
  return state.word === word ? state : { word, card: null, error: null }
}
