import { useEffect, useReducer, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getNextWord } from './studySession'
import { computeNextReviewAt } from '../hooks/useProgress'

export const REQUIRED_ACCEPTED_ATTEMPTS = 3

export function getStoredFeedback(record) {
  if (!record?.lastCheckedSentence) return null
  return {
    checkedSentence: record.lastCheckedSentence,
    isAcceptable: Boolean(record.feedback?.isAcceptable),
    message: record.feedback?.isAcceptable
      ? 'Last check: acceptable for study use.'
      : 'Last check: this sentence still needed revision.',
    note: record.feedback?.grammarFeedback || record.feedback?.naturalnessFeedback || '',
    suggestedRevision: record.feedback?.suggestedRevision || '',
  }
}

function getRequestedWord(wordList, requestedWord) {
  if (!requestedWord) return null
  return wordList.find(w => w.word.toLowerCase() === requestedWord.toLowerCase()) || null
}

// Fresh per-word state. `openStoredResult` controls whether a previously
// checked sentence's result panel starts expanded (initial load) or
// collapsed (jumping to another word).
function wordState(word, records, { openStoredResult }) {
  const record = word ? records[word.word] || {} : {}
  return {
    current: word,
    sentence: word ? record.draft || '' : '',
    revealed: false,
    feedback: null,
    checkError: '',
    isChecking: false,
    resultOpen: openStoredResult ? Boolean(getStoredFeedback(record)) : false,
    sessionAcceptedSentences: new Set(),
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'reset-to-word':
      return {
        ...wordState(action.word, action.records, { openStoredResult: action.openStoredResult }),
        recentWords: action.word ? [action.word.word] : [],
      }
    case 'advance':
      return {
        ...wordState(action.next, action.records, { openStoredResult: false }),
        recentWords: action.next ? [...state.recentWords, action.next.word] : state.recentWords,
      }
    case 'set-sentence':
      return { ...state, sentence: action.value }
    case 'check-start':
      return { ...state, isChecking: true, checkError: '' }
    case 'check-success':
      return {
        ...state,
        isChecking: false,
        feedback: action.result,
        revealed: true,
        resultOpen: true,
        sessionAcceptedSentences: action.result.is_acceptable
          ? new Set([...state.sessionAcceptedSentences, action.sentence.trim()])
          : state.sessionAcceptedSentences,
      }
    case 'check-duplicate':
      return { ...state, feedback: action.feedback, revealed: true, resultOpen: true }
    case 'check-error':
      return { ...state, isChecking: false, feedback: null, revealed: false, checkError: action.message }
    case 'toggle-result':
      return { ...state, resultOpen: !state.resultOpen }
    default:
      return state
  }
}

// Owns the study-session state machine: which word is shown, the draft
// sentence, self-check lifecycle, and advancing to the next word.
// Word-selection changes go through single reducer actions so a transition
// can never leave stale pieces (feedback, errors, result panel) behind.
export default function useStudySession(words, records, syncState) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedWord = searchParams.get('word')

  const [state, dispatch] = useReducer(reducer, null, () => {
    const initial = getRequestedWord(words, requestedWord) || getNextWord(words, records, [], null)
    return {
      ...wordState(initial, records, { openStoredResult: true }),
      recentWords: initial ? [initial.word] : [],
    }
  })

  // Gate to prevent the requestedWord effect from snapping current back to
  // the old word during the same render cycle where advance() has already
  // picked the next word but navigate() has not yet cleared ?word.
  const advancingRef = useRef(false)

  const currentWordName = state.current?.word

  useEffect(() => {
    if (advancingRef.current) {
      advancingRef.current = false
      return
    }
    const targetWord = getRequestedWord(words, requestedWord)
    if (!targetWord || currentWordName === targetWord.word) return
    dispatch({ type: 'reset-to-word', word: targetWord, records, openStoredResult: false })
  }, [requestedWord, currentWordName, records, words])

  // Recalculate the current word once records finish loading. Without this,
  // the reducer initialises `current` before records exist, so getNextWord
  // sees an empty map and always picks the first unseen word regardless of
  // actual progress.
  const prevSyncState = useRef(syncState)

  useEffect(() => {
    const wasLoading = prevSyncState.current === 'loading'
    prevSyncState.current = syncState

    if (syncState !== 'idle' || !wasLoading) return

    const targetWord = getRequestedWord(words, requestedWord)
    const next = targetWord || getNextWord(words, records, [], null)
    dispatch({ type: 'reset-to-word', word: next, records, openStoredResult: true })
  }, [syncState, records, requestedWord, words])

  function advance(currentWord, newStatus) {
    // Build a lightweight view of records with the just-applied status
    // override so getNextWord can immediately see the new status without
    // waiting for the async setRecords update to propagate.
    const override = { ...(records[currentWord] || {}), status: newStatus }
    if (newStatus === 'mastered') {
      override.nextReviewAt = computeNextReviewAt(0)
    } else if (newStatus === 'learning') {
      override.nextReviewAt = null
    }
    const recordsWithOverride = { ...records, [currentWord]: override }
    const next = getNextWord(words, recordsWithOverride, state.recentWords, currentWord)

    // If we arrived via ?word=X, clear the search param so the requestedWord
    // effect won't snap us back to the same word. Set the gate BEFORE
    // navigate so the records-triggered effect that fires in the same render
    // cycle bails out.
    if (requestedWord) {
      advancingRef.current = true
      navigate('/study', { replace: true })
    }

    dispatch({ type: 'advance', next, records })
  }

  return { state, dispatch, advance, requestedWord }
}
