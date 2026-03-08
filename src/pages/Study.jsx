import { useState } from 'react'
import words from '../data/wordBank'
import useProgress from '../hooks/useProgress'
import { getNextWord, includesTargetWord } from './studySession'

export default function Study() {
  const { progress, setStatus } = useProgress()
  const [current, setCurrent] = useState(() => getNextWord(words, progress, [], null))
  const [sentence, setSentence] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [recentWords, setRecentWords] = useState(() => (current ? [current.word] : []))

  const hasSentence = sentence.trim().length > 0
  const hasTargetWord = current ? includesTargetWord(sentence, current.word) : false
  const canCompare = hasSentence && hasTargetWord

  function advance(nextProgress) {
    const next = getNextWord(words, nextProgress, recentWords, current.word)
    setCurrent(next)
    setRecentWords(prev => (next ? [...prev, next.word] : prev))
    setSentence('')
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
    <div className="flex flex-col min-h-screen px-6 py-8 gap-6 max-w-lg mx-auto">
      <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-2">
        <div className="text-4xl font-bold">{current.word}</div>
        <div className="text-gray-500 text-sm">{current.pos} · {current.definition}</div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-4">
        <label className="text-sm font-medium text-gray-600">Write your sentence:</label>
        <textarea
          className="w-full border border-gray-200 rounded-xl p-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={sentence}
          onChange={e => setSentence(e.target.value)}
          placeholder="Type a sentence using this word..."
          disabled={revealed}
        />
        {hasSentence && !hasTargetWord && (
          <div className="text-sm text-amber-700">
            Include the word "{current.word}" in your sentence before comparing.
          </div>
        )}
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            disabled={!canCompare}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Compare
          </button>
        )}
      </div>

      {revealed && (
        <div className="bg-blue-50 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <div className="text-sm font-medium text-blue-600">Reference sentence:</div>
          <div className="text-base">{current.example}</div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleAgain}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold"
            >
              Again
            </button>
            <button
              onClick={handleMastered}
              className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold"
            >
              Mastered
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
