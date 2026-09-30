import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { fetchCard, fetchWords } from '../services/api'
import { useAuth } from './AuthContext'

const ContentContext = createContext(null)

// Word entries use the lowercase record key as `word` so the scheduling and
// progress code can index records[word.word]; `display` keeps the proper case.
function toEntry(w) {
  return { word: w.key, display: w.word, rank: w.rank, level: w.level, kind: w.kind, pos: w.pos || [], ready: w.ready }
}

export function ContentProvider({ children }) {
  const { user } = useAuth()
  const [words, setWords] = useState([])
  const [status, setStatus] = useState(user ? 'loading' : 'idle') // idle | loading | error
  const cards = useRef(new Map())

  useEffect(() => {
    if (!user) {
      setWords([])
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('loading')
    fetchWords()
      .then(list => {
        if (cancelled) return
        setWords(list.map(toEntry))
        setStatus('idle')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
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

  return (
    <ContentContext.Provider value={{ words, status, getCard }}>
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
