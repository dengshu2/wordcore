import { useState } from 'react'
import words from '../data/wordBank'
import useProgress from '../hooks/useProgress'
import { getNextWord, includesTargetWord } from './studySession'

export default function Study() {
  const { progress, drafts, setStatus, saveDraft } = useProgress()
  const [current, setCurrent] = useState(() => getNextWord(words, progress, [], null))
  const [sentence, setSentence] = useState(() => (current ? drafts[current.word] || '' : ''))
  const [revealed, setRevealed] = useState(false)
  const [recentWords, setRecentWords] = useState(() => (current ? [current.word] : []))

  const hasSentence = sentence.trim().length > 0
  const hasTargetWord = current ? includesTargetWord(sentence, current.word) : false
  const canCompare = hasSentence && hasTargetWord

  function advance(nextProgress) {
    const next = getNextWord(words, nextProgress, recentWords, current.word)
    setCurrent(next)
    setRecentWords(prev => (next ? [...prev, next.word] : prev))
    setSentence(next ? drafts[next.word] || '' : '')
    setRevealed(false)
  }

  function handleAgain() {
    const nextProgress = { ...progress, [current.word]: 'learning' }
    setStatus(current.word, 'learning')
    advance(nextProgress)
  }

  function handleMastered() {
    const nextProgress = { ...progress, [current.word]: 'mastered' }
    setStatus(current.word, 'mastered')
    advance(nextProgress)
  }

  return (
    <div className="px-5 py-5 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-2 border-b pb-4" style={{ borderColor: 'var(--wc-border)' }}>
        <div className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--wc-warm)' }}>
          Focus session
        </div>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <h1 className="max-w-3xl text-2xl font-semibold lg:text-4xl">Write one similar sentence and keep the target word natural.</h1>
          <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>
            Drafts save automatically.
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-6">
          <div className="rounded-[28px] border p-5 lg:p-6" style={{ background: 'var(--wc-surface-strong)', borderColor: 'var(--wc-border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>Current word</div>
                <div className="mt-3 text-4xl font-semibold lg:text-5xl">{current.word}</div>
              </div>
              <div className="rounded-full px-4 py-2 text-sm" style={{ background: 'rgba(31, 106, 82, 0.08)', color: 'var(--wc-accent)' }}>
                {current.pos}
              </div>
            </div>
            <div className="mt-4 max-w-2xl text-base leading-7 lg:text-lg" style={{ color: 'var(--wc-muted)' }}>
              {current.definition}
            </div>
          </div>

          <div className="rounded-[28px] border p-5 lg:p-6" style={{ background: 'rgba(255,255,255,0.64)', borderColor: 'var(--wc-border)' }}>
            <label className="text-sm font-medium" style={{ color: 'var(--wc-muted)' }}>Write your sentence</label>
            <textarea
              className="mt-3 min-h-[180px] w-full rounded-[22px] border p-4 text-base leading-7 outline-none transition xl:min-h-[220px]"
              style={{ borderColor: 'rgba(69, 44, 27, 0.12)', background: 'rgba(255,250,241,0.92)' }}
              rows={4}
              value={sentence}
              onChange={e => {
                const value = e.target.value
                setSentence(value)
                saveDraft(current.word, value)
              }}
              placeholder={`Write one natural sentence using "${current.word}"...`}
            />
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm leading-6" style={{ color: hasSentence && !hasTargetWord ? '#9a5a1f' : 'var(--wc-muted)' }}>
                {hasSentence && !hasTargetWord
                  ? `Include the word "${current.word}" in your sentence before self-checking.`
                  : 'Swap one small detail and keep the sentence natural.'}
              </div>
              <button
                onClick={() => setRevealed(true)}
                disabled={!canCompare}
                className="rounded-2xl px-6 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#c7beb1]"
                style={{ background: 'linear-gradient(135deg, var(--wc-accent) 0%, #2d7e65 100%)' }}
              >
                Self-check
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[28px] border p-5" style={{ background: 'rgba(31, 106, 82, 0.07)', borderColor: 'rgba(31, 106, 82, 0.14)' }}>
            <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>Reference</div>
            <div className="mt-3 space-y-4">
              <div className="text-base leading-7 lg:text-lg">{current.example}</div>
              {revealed ? (
                <>
                  <div className="rounded-[20px] border px-4 py-3 text-sm leading-6" style={{ borderColor: 'rgba(31, 106, 82, 0.12)', background: 'rgba(255,255,255,0.55)' }}>
                    Check whether your sentence keeps the same pattern and meaning, but changes a small detail such as the noun, place, or time.
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleAgain}
                      className="flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold"
                      style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-text)', background: 'rgba(255,255,255,0.58)' }}
                    >
                      Again
                    </button>
                    <button
                      onClick={handleMastered}
                      className="flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #4f9364 0%, #3f8157 100%)' }}
                    >
                      Mastered
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-[20px] border px-4 py-3 text-sm leading-6" style={{ borderColor: 'rgba(31, 106, 82, 0.12)', background: 'rgba(255,255,255,0.55)', color: 'var(--wc-muted)' }}>
                  Example prompt: keep the frame of the reference sentence, then replace one small noun or situation with your own version.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
