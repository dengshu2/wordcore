import { Link } from 'react-router-dom'
import useProgress from '../hooks/useProgress'
import words from '../data/words.json'

const TOTAL = words.length

export default function Home() {
  const { masteredCount } = useProgress()
  const pct = Math.round((masteredCount / TOTAL) * 100)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
      <h1 className="text-3xl font-bold tracking-tight">WordCore</h1>

      <div className="text-center">
        <div className="text-6xl font-bold text-blue-600">{masteredCount}</div>
        <div className="text-gray-500 mt-1">of {TOTAL} mastered</div>
      </div>

      <div className="w-full max-w-sm bg-gray-200 rounded-full h-3">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <Link
        to="/study"
        className="w-full max-w-sm text-center bg-blue-600 text-white py-4 rounded-2xl text-lg font-semibold"
      >
        Start Practice
      </Link>
    </div>
  )
}
