import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import words from '../data/wordBank'
import useProgress from '../hooks/useProgress'
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

function getRequestedWord(words, requestedWord) {
  if (!requestedWord) return null
  return words.find(word => word.word.toLowerCase() === requestedWord.toLowerCase()) || null
}

export default function Study() {
  const { records, setStatus, saveDraft, saveFeedback } = useProgress()
  const [searchParams] = useSearchParams()
  const requestedWord = searchParams.get('word')
  const initialWord = getRequestedWord(words, requestedWord)
  const [current, setCurrent] = useState(() => initialWord || getNextWord(words, records, [], null))
  const [sentence, setSentence] = useState(() => (current ? records[current.word]?.draft || '' : ''))
  const [revealed, setRevealed] = useState(false)
  const [recentWords, setRecentWords] = useState(() => (current ? [current.word] : []))
  const [feedback, setFeedback] = useState(null)
  const [checkError, setCheckError] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  // Track unique sentences accepted within this session for this word.
  // Prevents fast-looping the same sentence to hit the mastery threshold.
  const [sessionAcceptedSentences, setSessionAcceptedSentences] = useState(() => new Set())

  const currentRecord = current ? records[current.word] || {} : {}
  const hasSentence = sentence.trim().length > 0
  const hasTargetWord = current ? includesTargetWord(sentence, current.word) : false
  const canCompare = hasSentence && hasTargetWord
  // acceptedAttempts comes from the persisted record (updated by saveFeedback after each check).
  // sessionAcceptedSentences tracks unique sentences approved this session to prevent replaying
  // the same sentence repeatedly to hit the mastery threshold within one sitting.
  const acceptedAttempts = currentRecord.acceptedAttempts || 0
  const hasSessionAccepted = sessionAcceptedSentences.size > 0
  // Mastered requires: (1) latest check is acceptable, (2) enough total accepted attempts,
  // (3) at least one new sentence was accepted in this session.
  const masteredReady = Boolean(feedback?.is_acceptable) && acceptedAttempts >= REQUIRED_ACCEPTED_ATTEMPTS && hasSessionAccepted
  const remainingAcceptedChecks = Math.max(REQUIRED_ACCEPTED_ATTEMPTS - acceptedAttempts, 0)
  const storedFeedback = getStoredFeedback(currentRecord)

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
    setSessionAcceptedSentences(new Set())
  }, [requestedWord, current?.word, records])

  function advance(nextRecords) {
    const next = getNextWord(words, nextRecords, recentWords, current.word)
    setCurrent(next)
    setRecentWords(prev => (next ? [...prev, next.word] : prev))
    setSentence(next ? nextRecords[next.word]?.draft || '' : '')
    setRevealed(false)
    setFeedback(null)
    setCheckError('')
    setIsChecking(false)
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
      if (result.is_acceptable) {
        setSessionAcceptedSentences(prev => new Set([...prev, sentence.trim()]))
      }
    } catch (error) {
      setFeedback(null)
      setCheckError('AI feedback is temporarily unavailable. Try again.')
      setRevealed(false)
    } finally {
      setIsChecking(false)
    }
  }

  function handleSentenceKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && canCompare && !isChecking) {
      event.preventDefault()
      handleSelfCheck()
    }
  }

  function handleAgain() {
    const nextRecords = {
      ...records,
      [current.word]: {
        ...(records[current.word] || {}),
        status: 'learning',
      },
    }
    setStatus(current.word, 'learning')
    advance(nextRecords)
  }

  function handleMastered() {
    const nextRecords = {
      ...records,
      [current.word]: {
        ...(records[current.word] || {}),
        status: 'mastered',
      },
    }
    setStatus(current.word, 'mastered')
    advance(nextRecords)
  }

  return (
    <div className="px-5 py-5 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-2 border-b pb-4" style={{ borderColor: 'var(--wc-border)' }}>
        <div className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--wc-warm)' }}>
          Focus session
        </div>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <h1 className="max-w-3xl text-2xl font-semibold lg:text-4xl">Write one similar sentence.</h1>
          <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>
            Keep the target word natural. Drafts save automatically.
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <section className="rounded-[28px] border p-5 lg:p-6" style={{ background: 'var(--wc-surface-strong)', borderColor: 'var(--wc-border)' }}>
          <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>Current word</div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div className="text-4xl font-semibold lg:text-5xl">{current.word}</div>
            <div className="rounded-full px-4 py-2 text-sm" style={{ background: 'rgba(31, 106, 82, 0.08)', color: 'var(--wc-accent)' }}>
              {current.pos}
            </div>
          </div>
          <div className="mt-4 max-w-2xl text-base leading-7 lg:text-lg" style={{ color: 'var(--wc-muted)' }}>
            {current.definition}
          </div>
          <div className="mt-5 border-t pt-5" style={{ borderColor: 'rgba(69, 44, 27, 0.08)' }}>
            <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>Reference sentence</div>
            <div className="mt-3 max-w-3xl text-base leading-7 lg:text-lg">{current.example}</div>
            <div className="mt-3 text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
              Keep the frame of the sentence, then change one small noun, place, or situation.
            </div>
            {requestedWord && current?.word === requestedWord && (
              <div className="mt-4 inline-flex rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'rgba(31, 106, 82, 0.08)', color: 'var(--wc-accent)' }}>
                Studying this word from the word bank
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[28px] border p-5 lg:p-6" style={{ background: 'rgba(255,255,255,0.64)', borderColor: 'var(--wc-border)' }}>
            <label className="text-sm font-medium" style={{ color: 'var(--wc-muted)' }}>Write your sentence</label>
            <textarea
              className="mt-3 min-h-[180px] w-full rounded-[22px] border p-4 text-base leading-7 outline-none transition xl:min-h-[210px]"
              style={{ borderColor: 'rgba(69, 44, 27, 0.12)', background: 'rgba(255,250,241,0.92)' }}
              rows={4}
              value={sentence}
              onChange={e => {
                const value = e.target.value
                setSentence(value)
                saveDraft(current.word, value)
              }}
              onKeyDown={handleSentenceKeyDown}
              placeholder={`Write one natural sentence using "${current.word}"...`}
            />
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm leading-6" style={{ color: hasSentence && !hasTargetWord ? '#9a5a1f' : 'var(--wc-muted)' }}>
                {hasSentence && !hasTargetWord
                  ? `Include the word "${current.word}" in your sentence before self-checking.`
                  : 'Swap one small detail and keep the sentence natural.'}
              </div>
              <div className="flex flex-col items-start gap-2 lg:items-end">
                <button
                  onClick={handleSelfCheck}
                  disabled={!canCompare || isChecking}
                  className="rounded-2xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#c7beb1]"
                  style={{ background: 'linear-gradient(135deg, var(--wc-accent) 0%, #2d7e65 100%)' }}
                >
                  {isChecking ? 'Checking...' : 'Self-check'}
                </button>
                <div className="text-xs" style={{ color: 'var(--wc-muted)' }}>
                  Shortcut: Cmd/Ctrl + Enter
                </div>
              </div>
            </div>
            {checkError && (
              <div className="mt-3 text-sm leading-6" style={{ color: '#9a5a1f' }}>
                {checkError}
              </div>
            )}
          </div>

          <aside className="rounded-[28px] border p-5" style={{ background: 'rgba(255,255,255,0.56)', borderColor: 'var(--wc-border)' }}>
            <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>AI result</div>
            <div className="mt-3 space-y-3">
              {revealed && feedback ? (
                <>
                  <div className="rounded-[20px] border px-4 py-3 text-sm leading-6" style={{ borderColor: 'rgba(31, 106, 82, 0.12)', background: 'rgba(255,255,255,0.55)' }}>
                    {feedback.is_acceptable
                      ? 'This sentence is acceptable for study use.'
                      : 'This sentence needs revision before you move on.'}
                  </div>
                  {(feedback.grammar_feedback || feedback.naturalness_feedback) && (
                    <div className="text-sm leading-6" style={{ color: 'var(--wc-text)' }}>
                      {feedback.grammar_feedback || feedback.naturalness_feedback}
                    </div>
                  )}
                  {feedback.suggested_revision && (
                    <div className="text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
                      Suggested: {feedback.suggested_revision}
                    </div>
                  )}
                  <div className="text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
                    Acceptable checks: {acceptedAttempts}/{REQUIRED_ACCEPTED_ATTEMPTS}
                  </div>
                  {feedback.is_acceptable && !masteredReady && (
                    <div className="text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
                      Complete {remainingAcceptedChecks} more acceptable self-check{remainingAcceptedChecks === 1 ? '' : 's'} before marking this word as mastered.
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleAgain}
                      className="flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold"
                      style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-text)', background: 'rgba(255,255,255,0.58)' }}
                    >
                      Again
                    </button>
                    <button
                      onClick={handleMastered}
                      disabled={!masteredReady}
                      className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c7beb1]"
                      style={{ background: 'linear-gradient(135deg, #4f9364 0%, #3f8157 100%)' }}
                    >
                      Mastered
                    </button>
                  </div>
                </>
              ) : storedFeedback ? (
                <>
                  <div className="rounded-[20px] border px-4 py-3 text-sm leading-6" style={{ borderColor: 'rgba(69, 44, 27, 0.12)', background: 'rgba(255,255,255,0.55)' }}>
                    {storedFeedback.message}
                  </div>
                  <div className="text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
                    Last checked sentence: {storedFeedback.checkedSentence}
                  </div>
                  {storedFeedback.note && (
                    <div className="text-sm leading-6" style={{ color: 'var(--wc-text)' }}>
                      {storedFeedback.note}
                    </div>
                  )}
                  {storedFeedback.suggestedRevision && (
                    <div className="text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
                      Suggested: {storedFeedback.suggestedRevision}
                    </div>
                  )}
                  <div className="text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
                    Accepted checks: {currentRecord.acceptedAttempts || 0}/{REQUIRED_ACCEPTED_ATTEMPTS}
                  </div>
                </>
              ) : (
                <div className="rounded-[20px] border px-4 py-3 text-sm leading-6" style={{ borderColor: 'rgba(69, 44, 27, 0.12)', background: 'rgba(255,255,255,0.55)', color: 'var(--wc-muted)' }}>
                  Run `Self-check` to see whether your sentence is acceptable and how to revise it.
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
