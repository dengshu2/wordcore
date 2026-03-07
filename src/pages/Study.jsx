import { useState } from 'react'
import words from '../data/words.json'
import useProgress from '../hooks/useProgress'

function getNextWord(words, progress, exclude) {
  const learning = words.filter(w => progress[w.word] !== 'mastered' && w.word !== exclude)
  if (learning.length === 0) {
    const all = words.filter(w => w.word !== exclude)
    return all.length > 0
      ? all[Math.floor(Math.random() * all.length)]
      : words[Math.floor(Math.random() * words.length)]
  }
  return learning[Math.floor(Math.random() * learning.length)]
}

export default function Study() {
  const { progress, setStatus } = useProgress()
  const [current, setCurrent] = useState(() => {
    const learning = words.filter(w => progress[w.word] !== 'mastered')
    return learning.length > 0 ? learning[0] : words[0]
  })
  const [sentence, setSentence] = useState('')
  const [revealed, setRevealed] = useState(false)

  function handleNext(status) {
    setStatus(current.word, status)
    const next = getNextWord(words, { ...progress, [current.word]: status }, current.word)
    setCurrent(next)
    setSentence('')
    setRevealed(false)
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
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
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
              onClick={() => handleNext('learning')}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold"
            >
              Again
            </button>
            <button
              onClick={() => handleNext('mastered')}
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
