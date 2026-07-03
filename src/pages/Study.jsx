import { useEffect, useRef } from 'react'
import words from '../data/wordBank'
import { useProgressContext } from '../context/ProgressContext'
import { getEarliestReviewDate, includesTargetWord } from './studySession'
import { checkSentence } from '../services/sentenceCheck'
import { normalizeSentenceKey } from '../hooks/useProgress'
import useStudySession, { getStoredFeedback, REQUIRED_ACCEPTED_ATTEMPTS } from './useStudySession'
import AcceptedExamples from '../components/study/AcceptedExamples'
import { FeedbackPanel, StoredFeedbackPanel } from '../components/study/FeedbackPanels'

export default function Study() {
  const { records, setStatus, saveDraft, saveFeedback, markMastered, confirmReview, resetToLearning, syncState } = useProgressContext()
  const { state, dispatch, advance, requestedWord } = useStudySession(words, records, syncState)
  const { current, sentence, revealed, feedback, checkError, isChecking, resultOpen, sessionAcceptedSentences } = state

  const resultRef = useRef(null)
  const sentenceRef = useRef(null)

  const currentRecord = current ? records[current.word] || {} : {}

  useEffect(() => {
    document.title = current ? `${current.word} — WordCore` : 'WordCore'
  }, [current])

  const hasSentence = sentence.trim().length > 0
  const hasTargetWord = current ? includesTargetWord(sentence, current.word) : false
  const canCompare = hasSentence && hasTargetWord
  const acceptedAttempts = currentRecord.acceptedAttempts || 0
  const acceptedSentenceAttempts = (currentRecord.sentenceAttempts || []).filter(attempt => attempt.isAcceptable)
  const hasSessionAccepted = sessionAcceptedSentences.size > 0
  const masteredReady = Boolean(feedback?.is_acceptable) && acceptedAttempts >= REQUIRED_ACCEPTED_ATTEMPTS && hasSessionAccepted
  const remainingAcceptedChecks = Math.max(REQUIRED_ACCEPTED_ATTEMPTS - acceptedAttempts, 0)
  const storedMasteredReady = acceptedAttempts >= REQUIRED_ACCEPTED_ATTEMPTS && Boolean(currentRecord.feedback?.isAcceptable)
  const storedFeedback = getStoredFeedback(currentRecord)
  const hasResult = (revealed && feedback) || storedFeedback

  // While the initial fetch is in flight show skeleton placeholders.
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

  function setSentence(value) {
    dispatch({ type: 'set-sentence', value })
    saveDraft(current.word, value)
  }

  function scrollToResult() {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  async function handleSelfCheck() {
    const normalizedSentence = normalizeSentenceKey(sentence)
    const isDuplicateAcceptedSentence = acceptedSentenceAttempts.some(attempt =>
      attempt.normalizedSentence === normalizedSentence
    )
    if (isDuplicateAcceptedSentence) {
      const duplicateFeedback = {
        is_acceptable: false,
        grammar_feedback: '',
        naturalness_feedback: 'This repeats an accepted sentence. Write a new example to make progress.',
        suggested_revision: '',
      }
      dispatch({ type: 'check-duplicate', feedback: duplicateFeedback })
      saveFeedback(current.word, duplicateFeedback, sentence)
      scrollToResult()
      return
    }

    dispatch({ type: 'check-start' })
    try {
      const result = await checkSentence({
        word: current.word,
        definition: current.definition,
        referenceSentence: current.example,
        userSentence: sentence,
      })
      dispatch({ type: 'check-success', result, sentence })
      saveFeedback(current.word, result, sentence)
      scrollToResult()
    } catch (err) {
      const msg = err?.message || ''
      dispatch({
        type: 'check-error',
        message: msg.toLowerCase().includes('too many requests')
          ? 'You are checking too quickly. Please wait a moment before trying again.'
          : 'AI feedback is temporarily unavailable. Try again.',
      })
    }
  }

  function handleSentenceKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter' && masteredReady) {
      e.preventDefault()
      handleMastered()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canCompare && !isChecking) {
      e.preventDefault()
      handleSelfCheck()
    }
  }

  function handleAgain() {
    const isMasteredReview = currentRecord.status === 'mastered'
    if (isMasteredReview) {
      resetToLearning(current.word)
    } else {
      setStatus(current.word, 'learning')
    }
    advance(current.word, 'learning')
  }

  function handleMastered() {
    const isMasteredReview = currentRecord.status === 'mastered'
    if (isMasteredReview) {
      confirmReview(current.word)
    } else {
      markMastered(current.word)
    }
    advance(current.word, 'mastered')
  }

  if (!current) {
    const nextReview = getEarliestReviewDate(words, records)
    return (
      <div className="study-empty">
        <p>All caught up for now.</p>
        {nextReview && (
          <p className="body-sm" style={{ color: 'var(--wc-muted)', marginTop: 'var(--space-2)' }}>
            Next review: {nextReview.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="study-layout">
      <article className="study-sheet" key={current.word}>
        <header className="study-word-section">
          <p className="study-kicker">Daily sentence practice</p>
          <div className="study-word-row">
            <h1 className="study-word">{current.word}</h1>
            <span className="badge badge--accent">{current.pos}</span>
          </div>

          <p className="study-definition">{current.definition}</p>

          <div className="study-reference">
            <p className="study-reference__sentence">{current.example}</p>
            <p className="study-reference__hint">Keep the frame, then swap one small detail.</p>
            {requestedWord && current?.word === requestedWord && (
              <p className="study-reference__hint study-reference__hint--accent">
                Studying this word from the word bank.
              </p>
            )}
          </div>
        </header>

        <div className="study-input-section">
          <section className="study-input-area" aria-label="Sentence input">
            <div className="study-sentence-wrap">
              <textarea
                id="study-sentence"
                ref={sentenceRef}
                className="input textarea study-sentence-input"
                aria-label={`Write a sentence using the word "${current.word}"`}
                value={sentence}
                onChange={e => setSentence(e.target.value)}
                onKeyDown={handleSentenceKeyDown}
                placeholder={`Write a new natural sentence using "${current.word}"...`}
              />
              {sentence && (
                <button
                  type="button"
                  className="study-sentence-clear"
                  aria-label="Clear sentence"
                  onClick={() => {
                    setSentence('')
                    sentenceRef.current?.focus()
                  }}
                >
                  ×
                </button>
              )}
            </div>

            <p className={`study-hint--warn${hasSentence && !hasTargetWord ? '' : ' study-hint--hidden'}`} aria-hidden={!hasSentence || hasTargetWord}>
              Include the word &quot;{current.word}&quot; in your sentence before self-checking.
            </p>
            {checkError && <p className="study-hint--warn">{checkError}</p>}

            <div className="study-submit-row">
              <span className="body-xs" style={{ color: 'var(--wc-muted)' }}>Cmd/Ctrl + Enter</span>
              <button
                className="btn btn--primary btn--sm"
                onClick={handleSelfCheck}
                disabled={!canCompare || isChecking}
              >
                {isChecking ? 'Checking...' : 'Self-check'}
              </button>
            </div>
          </section>

          <AcceptedExamples attempts={acceptedSentenceAttempts} requiredAttempts={REQUIRED_ACCEPTED_ATTEMPTS} />

          {(hasResult || isChecking) && (
            <section className="study-result" ref={resultRef} aria-label="Sentence check result">
              <button className="study-result__toggle" onClick={() => dispatch({ type: 'toggle-result' })} aria-expanded={resultOpen}>
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
            </section>
          )}
        </div>
      </article>
    </div>
  )
}
