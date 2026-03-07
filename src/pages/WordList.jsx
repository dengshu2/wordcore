import { useState, useMemo } from 'react'
import words from '../data/words.json'
import useProgress from '../hooks/useProgress'

const FILTERS = ['All', 'Learning', 'Mastered']

export default function WordList() {
  const { progress } = useProgress()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = useMemo(() => {
    return words.filter(w => {
      const matchesQuery = w.word.toLowerCase().includes(query.toLowerCase())
      const status = progress[w.word] === 'mastered' ? 'Mastered' : 'Learning'
      const matchesFilter = filter === 'All' || status === filter
      return matchesQuery && matchesFilter
    })
  }, [query, filter, progress])

  return (
    <div className="flex flex-col min-h-screen">
      <div className="px-6 pt-8 pb-4 bg-white border-b border-gray-100">
        <h1 className="text-2xl font-bold mb-4">Words</h1>
        <input
          type="search"
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search words..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex gap-2 mt-3">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.map(w => (
          <div key={w.word} className="flex items-center px-6 py-3 border-b border-gray-100 bg-white">
            <div className="flex-1">
              <span className="font-medium">{w.word}</span>
              <span className="text-gray-400 text-sm ml-2">{w.pos}</span>
            </div>
            {progress[w.word] === 'mastered' && (
              <span className="text-green-500 text-sm">✓ Mastered</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-16">No words found</div>
        )}
      </div>
    </div>
  )
}
