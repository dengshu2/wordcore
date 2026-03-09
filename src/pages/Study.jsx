import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import words from '../data/wordBank'
import { useProgressContext } from '../context/ProgressContext'
import { getNextWord, includesTargetWord } from './studySession'
import { checkSentence } from '../services/sentenceCheck'

const REQUIRED_ACCEPTED_ATTEMPTS = 3

function getStoredFeedback(record) {
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

export default function Study() {
  const { records, setStatus, saveDraft, saveFeedback, syncState } = useProgressContext()
  const [searchParams] = useSearchParams()
  const requestedWord = searchParams.get('word')
  const initialWord = getRequestedWord(words, requestedWord)
  const initialCurrent = initialWord || getNextWord(words, records, [], null)

  const [current, setCurrent] = useState(() => initialCurrent)
  const [sentence, setSentence] = useState(() => (initialCurrent ? records[initialCurrent.word]?.draft || '' : ''))
  const [revealed, setRevealed] = useState(false)
  const [recentWords, setRecentWords] = useState(() => (initialCurrent ? [initialCurrent.word] : []))
  const [feedback, setFeedback] = useState(null)
  const [checkError, setCheckError] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [resultOpen, setResultOpen] = useState(() => Boolean(getStoredFeedback(initialCurrent ? records[initialCurrent.word] || {} : {})))
  const [sessionAcceptedSentences, setSessionAcceptedSentences] = useState(() => new Set())

  const currentRecord = current ? records[current.word] || {} : {}

  useEffect(() => {
    document.title = current ? `${current.word} — WordCore` : 'WordCore'
  }, [current])

  const hasSentence = sentence.trim().length > 0
  const hasTargetWord = current ? includesTargetWord(sentence, current.word) : false
  const canCompare = hasSentence && hasTargetWord
  const acceptedAttempts = currentRecord.acceptedAttempts || 0
  const hasSessionAccepted = sessionAcceptedSentences.size > 0
  const masteredReady = Boolean(feedback?.is_acceptable) && acceptedAttempts >= REQUIRED_ACCEPTED_ATTEMPTS && hasSessionAccepted
  const remainingAcceptedChecks = Math.max(REQUIRED_ACCEPTED_ATTEMPTS - acceptedAttempts, 0)
  const storedMasteredReady = acceptedAttempts >= REQUIRED_ACCEPTED_ATTEMPTS && Boolean(currentRecord.feedback?.isAcceptable)
  const storedFeedback = getStoredFeedback(currentRecord)
  const hasResult = (revealed && feedback) || storedFeedback

  useEffect(() => {
    const targetWord = getRequestedWord(words, requestedWord)
    if (!targetWord || current?.word === targetWord.word) return
    setCurrent(targetWord)
    setSentence(records[targetWord.word]?.draft || '')
    setRecentWords([targetWord.word])
    setRevealed(false)
    setFeedback(null)
    setCheckError('')
    setIsChecking(false)
    setResultOpen(false)
    setSessionAcceptedSentences(new Set())
  }, [requestedWord, current?.word, records])

  // While the initial fetch is in flight show skeleton placeholders — all
  // hooks above must run unconditionally before this early return.
  if (syncState === 'loading') {
    return (
      <div className="study-layout">
        <div className="skeleton" style={{ height: 56, width: '40%' }} />
        <div className="skeleton" style={{ height: 20, width: '80%' }} />
        <div className="skeleton" style={{ height: 20, width: '60%' }} />
        <div className="skeleton" style={{ height: 160, marginTop: 'var(--space-4)' }} />
      </div>
    )
  }

  function advance(currentWord, newStatus) {
    // Build a lightweight view of records with the just-applied status override
    // so getNextWord can immediately see the new status without waiting for the
    // async setRecords update to propagate.
    const recordsWithOverride = {
      ...records,
      [currentWord]: { ...(records[currentWord] || {}), status: newStatus },
    }
    const next = getNextWord(words, recordsWithOverride, recentWords, currentWord)
    setCurrent(next)
    setRecentWords(prev => (next ? [...prev, next.word] : prev))
    setSentence(next ? records[next.word]?.draft || '' : '')
    setRevealed(false)
    setFeedback(null)
    setCheckError('')
    setIsChecking(false)
    setResultOpen(false)
    setSessionAcceptedSentences(new Set())
  }

  async function handleSelfCheck() {
    setIsChecking(true)
    setCheckError('')
    try {
      const result = await checkSentence({
        word: current.word,
        definition: current.definition,
        referenceSentence: current.example,
        userSentence: sentence,
      })
      setFeedback(result)
      saveFeedback(current.word, result, sentence)
      setRevealed(true)
      setResultOpen(true)
      if (result.is_acceptable) {
        setSessionAcceptedSentences(prev => new Set([...prev, sentence.trim()]))
      }
    } catch (err) {
      setFeedback(null)
      const msg = err?.message || ''
      if (msg.toLowerCase().includes('too many requests')) {
        setCheckError('You are checking too quickly. Please wait a moment before trying again.')
      } else {
        setCheckError('AI feedback is temporarily unavailable. Try again.')
      }
      setRevealed(false)
    } finally {
      setIsChecking(false)
    }
  }

  function handleSentenceKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canCompare && !isChecking) {
      e.preventDefault()
      handleSelfCheck()
    }
  }

  function handleAgain() {
    setStatus(current.word, 'learning')
    advance(current.word, 'learning')
  }

  function handleMastered() {
    setStatus(current.word, 'mastered')
    advance(current.word, 'mastered')
  }

  if (!current) {
    return (
      <div className="study-empty">
        <p>No words available.</p>
      </div>
    )
  }

  return (
    <div className="study-layout">

      {/* ── Left col: word info ───────────────────────────────────── */}
      <div className="study-word-section">
        <div className="study-word-row">
          <span className="study-word">{current.word}</span>
          <span className="badge badge--accent">{current.pos}</span>
        </div>

        <p className="study-definition">{current.definition}</p>

        <div className="study-reference">
          <p className="study-reference__sentence">{current.example}</p>
          <p className="study-reference__hint">Keep the frame, then swap one small detail.</p>
          {requestedWord && current?.word === requestedWord && (
            <p className="study-reference__hint" style={{ color: 'var(--wc-accent)', marginTop: 'var(--space-2)' }}>
              Studying this word from the word bank.
            </p>
          )}
        </div>
      </div>

      {/* ── Right col: input + result ─────────────────────────────── */}
      <div className="study-input-section">
        <div className="study-input-area">
          <textarea
            id="study-sentence"
            className="input textarea"
            value={sentence}
            onChange={e => {
              const value = e.target.value
              setSentence(value)
              saveDraft(current.word, value)
            }}
            onKeyDown={handleSentenceKeyDown}
            placeholder={`Write one natural sentence using "${current.word}"…`}
          />

          {hasSentence && !hasTargetWord && (
            <p className="study-hint--warn">
              Include the word "{current.word}" in your sentence before self-checking.
            </p>
          )}
          {checkError && <p className="study-hint--warn">{checkError}</p>}

          <div className="study-submit-row">
            <span className="body-xs" style={{ color: 'var(--wc-muted)' }}>Cmd/Ctrl + Enter</span>
            <button
              className="btn btn--primary btn--sm"
              onClick={handleSelfCheck}
              disabled={!canCompare || isChecking}
            >
              {isChecking ? 'Checking…' : 'Self-check'}
            </button>
          </div>
        </div>

        {(hasResult || isChecking) && (
          <div className="study-result">
            <button className="study-result__toggle" onClick={() => setResultOpen(p => !p)} aria-expanded={resultOpen}>
              <span className="label">Result</span>
              <span className="study-result__arrow" aria-hidden="true">{resultOpen ? '▲' : '▼'}</span>
            </button>

            {resultOpen && (
              <div className="study-result__body">
                {isChecking ? (
                  <>
                    <div className="skeleton" style={{ height: 40, marginBottom: 12 }} />
                    <div className="skeleton" style={{ height: 16, width: '60%' }} />
                  </>
                ) : revealed && feedback ? (
                  <FeedbackPanel
                    feedback={feedback}
                    acceptedAttempts={acceptedAttempts}
                    requiredAttempts={REQUIRED_ACCEPTED_ATTEMPTS}
                    remainingAcceptedChecks={remainingAcceptedChecks}
                    masteredReady={masteredReady}
                    onAgain={handleAgain}
                    onMastered={handleMastered}
                  />
                ) : storedFeedback ? (
                  <StoredFeedbackPanel
                    stored={storedFeedback}
                    currentRecord={currentRecord}
                    requiredAttempts={REQUIRED_ACCEPTED_ATTEMPTS}
                    storedMasteredReady={storedMasteredReady}
                    onAgain={handleAgain}
                    onMastered={handleMastered}
                  />
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FeedbackPanel({ feedback, acceptedAttempts, requiredAttempts, remainingAcceptedChecks, masteredReady, onAgain, onMastered }) {
  return (
    <div className="study-feedback">
      <p className={`study-feedback__verdict ${feedback.is_acceptable ? 'study-feedback__verdict--ok' : 'study-feedback__verdict--warn'}`}>
        {feedback.is_acceptable ? 'This sentence is acceptable for study use.' : 'This sentence needs revision before you move on.'}
      </p>
      {(feedback.grammar_feedback || feedback.naturalness_feedback) && (
        <p className="study-feedback__note">{feedback.grammar_feedback || feedback.naturalness_feedback}</p>
      )}
      {feedback.suggested_revision && (
        <p className="study-feedback__suggestion">Suggested: {feedback.suggested_revision}</p>
      )}
      <p className="study-feedback__tally num">Acceptable checks: {acceptedAttempts}/{requiredAttempts}</p>
      {feedback.is_acceptable && !masteredReady && (
        <p className="study-feedback__note">Complete {remainingAcceptedChecks} more acceptable self-check{remainingAcceptedChecks === 1 ? '' : 's'} before marking this word as mastered.</p>
      )}
      <ActionRow masteredReady={masteredReady} onAgain={onAgain} onMastered={onMastered} />
    </div>
  )
}

function StoredFeedbackPanel({ stored, currentRecord, requiredAttempts, storedMasteredReady, onAgain, onMastered }) {
  return (
    <div className="study-feedback">
      <p className={`study-feedback__verdict ${stored.isAcceptable ? 'study-feedback__verdict--ok' : 'study-feedback__verdict--warn'}`}>
        {stored.message}
      </p>
      <p className="study-feedback__note">Last checked sentence: {stored.checkedSentence}</p>
      {stored.note && <p className="study-feedback__note">{stored.note}</p>}
      {stored.suggestedRevision && (
        <p className="study-feedback__suggestion">Suggested: {stored.suggestedRevision}</p>
      )}
      <p className="study-feedback__tally num">Accepted checks: {currentRecord.acceptedAttempts || 0}/{requiredAttempts}</p>
      <ActionRow masteredReady={storedMasteredReady} onAgain={onAgain} onMastered={onMastered} />
    </div>
  )
}

function ActionRow({ masteredReady, onAgain, onMastered }) {
  return (
    <div className="study-action-row">
      <button className="btn btn--outline flex-1" onClick={onAgain}>Again</button>
      <button className="btn btn--primary flex-1" onClick={onMastered} disabled={!masteredReady}>Mastered</button>
    </div>
  )
}
