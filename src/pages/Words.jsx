import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useContent } from '../context/ContentContext'
import { useProgressContext } from '../context/ProgressContext'
import { PageTopBar } from '../components/TopBar'
import { buildWordCsv } from './wordExport'
import { REQUIRED_ACCEPTED_ATTEMPTS } from './useStudySession'

const FILTERS = ['All', 'Learning', 'Needs work', 'Mastered']
const PAGE = 60

function isWeak(record = {}) {
  return record.status === 'learning' && record.attempts > 0 && !record.feedback?.isAcceptable
}

function matchesFilter(filter, record = {}) {
  switch (filter) {
    case 'Learning': return record.status === 'learning'
    case 'Needs work': return isWeak(record)
    case 'Mastered': return record.status === 'mastered'
    default: return true
  }
}

export default function Words() {
  const { words } = useContent()
  const { records, masteredCount } = useProgressContext()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [shown, setShown] = useState(PAGE)

  useEffect(() => { document.title = 'Words — WordCore' }, [])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return words.filter(w => (!q || w.word.includes(q)) && matchesFilter(filter, records[w.word]))
  }, [words, records, query, filter])

  function exportCsv() {
    const blob = new Blob([buildWordCsv(list, records)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wordcore-progress.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <PageTopBar action={<button type="button" className="pill" onClick={exportCsv}>Export</button>} />
      <main id="main-content" className="page">
        <div className="page-head">
          <h2>Words</h2>
          <p>{masteredCount} mastered · {words.length} words</p>
        </div>
        <div className="tools">
          <input
            className="search"
            type="search"
            placeholder="Search words"
            aria-label="Search words"
            value={query}
            onChange={e => { setQuery(e.target.value); setShown(PAGE) }}
          />
          <div className="seg" role="group" aria-label="Filter">
            {FILTERS.map(f => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setShown(PAGE) }}>{f}</button>
            ))}
          </div>
        </div>
        {list.length === 0 ? (
          <p className="empty">No words match.</p>
        ) : (
          <div className="rows">
            {list.slice(0, shown).map(w => {
              const r = records[w.word] || {}
              const n = Math.min(r.acceptedAttempts || 0, REQUIRED_ACCEPTED_ATTEMPTS)
              let label = w.level || ''
              let tone = ''
              if (r.status === 'mastered') { label = 'Mastered'; tone = ' done' }
              else if (isWeak(r)) { label = 'Needs work'; tone = ' warn' }
              else if (r.status === 'learning') label = `${n}/${REQUIRED_ACCEPTED_ATTEMPTS}`
              else if (!w.ready) label = 'Preparing'
              return (
                <button key={w.word} type="button" className="row" disabled={!w.ready} aria-label={label ? `${w.display}, ${label}` : w.display}
                  onClick={() => navigate(`/study?word=${encodeURIComponent(w.word)}`)}>
                  <span className="w">{w.display}</span>
                  <span className={`st${tone}`}>{label}</span>
                </button>
              )
            })}
          </div>
        )}
        {shown < list.length && (
          <button type="button" className="btn more" onClick={() => setShown(s => s + PAGE)}>Show more</button>
        )}
      </main>
    </div>
  )
}
