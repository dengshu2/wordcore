import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import words from '../data/wordBank'
import { useProgressContext } from '../context/ProgressContext'
import { buildWordCsv } from './wordExport'

const FILTERS = ['All', 'Weak', 'Learning', 'Mastered', 'Written']
const SORTS = [
  { key: 'weak', label: 'Weak first' },
  { key: 'recent', label: 'Recently updated' },
  { key: 'alpha', label: 'A-Z' },
]
const ROW_HEIGHT = 176

function isWeakRecord(record = {}) {
  return record.status === 'learning' && record.attempts > 0 && !record.feedback?.isAcceptable
}

function getStatusLabel(record = {}) {
  if (record.status === 'mastered') return 'Mastered'
  if (record.draft?.trim()) return 'Written'
  return 'Learning'
}

function getFeedbackSummary(record = {}) {
  if (record.feedback?.isAcceptable) {
    return 'Latest check: acceptable'
  }
  if (record.feedback?.grammarFeedback) {
    return `Latest check: ${record.feedback.grammarFeedback}`
  }
  if (record.feedback?.naturalnessFeedback) {
    return `Latest check: ${record.feedback.naturalnessFeedback}`
  }
  return 'No AI feedback yet'
}

function getUpdatedLabel(updatedAt) {
  if (!updatedAt) return 'Not checked yet'

  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return 'Not checked yet'

  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function getPriorityScore(record = {}) {
  if (isWeakRecord(record)) return 0
  if (record.status === 'learning' && record.attempts > 0) return 1
  if (record.status === 'learning' && record.draft?.trim()) return 2
  if (record.status === 'learning') return 3
  if (record.status === 'mastered') return 4
  return 5
}

function getUpdatedTimestamp(record = {}) {
  const timestamp = new Date(record.updatedAt || 0).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function compareBySort(left, right, records, sortKey) {
  const leftRecord = records[left.word] || {}
  const rightRecord = records[right.word] || {}

  if (sortKey === 'recent') {
    const updatedDelta = getUpdatedTimestamp(rightRecord) - getUpdatedTimestamp(leftRecord)
    if (updatedDelta !== 0) return updatedDelta
  }

  if (sortKey === 'alpha') {
    return left.word.localeCompare(right.word)
  }

  const priorityDelta = getPriorityScore(leftRecord) - getPriorityScore(rightRecord)
  if (priorityDelta !== 0) return priorityDelta

  const updatedDelta = getUpdatedTimestamp(rightRecord) - getUpdatedTimestamp(leftRecord)
  if (updatedDelta !== 0) return updatedDelta

  return left.word.localeCompare(right.word)
}

export default function WordList() {
  const { records, masteredCount } = useProgressContext()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('weak')
  const parentRef = useRef(null)
  const writtenCount = Object.values(records).filter(record => record.draft?.trim()).length

  useEffect(() => { document.title = 'WordCore — Word bank' }, [])

  const filtered = useMemo(() => {
    return words
      .filter(w => {
        const matchesQuery = w.word.toLowerCase().includes(query.toLowerCase())
        const record = records[w.word] || {}
        const status = record.status === 'mastered' ? 'Mastered' : 'Learning'
        const hasDraft = Boolean(record.draft?.trim())
        const matchesFilter =
          filter === 'All' ||
          status === filter ||
          (filter === 'Written' && hasDraft) ||
          (filter === 'Weak' && isWeakRecord(record))
        return matchesQuery && matchesFilter
      })
      .sort((left, right) => compareBySort(left, right, records, sort))
  }, [query, filter, records, sort])

  const weakCount = Object.values(records).filter(record => isWeakRecord(record)).length

  function handleExportCsv() {
    const csv = buildWordCsv(filtered, records)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wordcore-progress.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  return (
    <div className="flex min-h-full flex-col px-6 py-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: 'var(--wc-warm)' }}>
            Word bank
          </div>
          <h1 className="mt-3 text-3xl font-semibold lg:text-5xl">Scan the full set without losing your place.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 lg:text-base" style={{ color: 'var(--wc-muted)' }}>
            Search, filter, and keep a stable sense of where you are. The list stays lightweight on large screens but still works as a mobile-first view.
          </p>
        </div>

        <div className="grid w-full max-w-[620px] grid-cols-4 gap-3 xl:flex-none">
          <div className="min-w-0 rounded-[22px] border px-4 py-3" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.54)' }}>
            <div className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--wc-muted)' }}>Total</div>
            <div className="mt-2 text-2xl font-semibold">{words.length}</div>
          </div>
          <div className="min-w-0 rounded-[22px] border px-4 py-3" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.54)' }}>
            <div className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--wc-muted)' }}>Mastered</div>
            <div className="mt-2 text-2xl font-semibold">{masteredCount}</div>
          </div>
          <div className="min-w-0 rounded-[22px] border px-4 py-3" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.54)' }}>
            <div className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--wc-muted)' }}>Shown</div>
            <div className="mt-2 text-2xl font-semibold">{filtered.length}</div>
          </div>
          <div className="min-w-0 rounded-[22px] border px-4 py-3" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.54)' }}>
            <div className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--wc-muted)' }}>Written</div>
            <div className="mt-2 text-2xl font-semibold">{writtenCount}</div>
          </div>
        </div>
        <div className="rounded-[22px] border px-4 py-3 xl:w-[150px]" style={{ borderColor: 'rgba(154, 90, 31, 0.14)', background: 'rgba(199, 124, 67, 0.08)' }}>
          <div className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--wc-muted)' }}>Weak</div>
          <div className="mt-2 text-2xl font-semibold">{weakCount}</div>
        </div>
      </div>

      <div className="mt-8 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[30px] border" style={{ background: 'rgba(255,255,255,0.62)', borderColor: 'var(--wc-border)' }}>
        <div className="border-b px-5 py-5 lg:px-6" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,250,241,0.86)' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-4 lg:max-w-3xl">
              <input
                type="search"
                className="w-full rounded-[18px] border px-4 py-3 text-base outline-none"
                style={{ borderColor: 'rgba(69, 44, 27, 0.12)', background: '#fffdf8' }}
                placeholder="Search words..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="rounded-full px-4 py-2 text-sm font-medium transition"
                    style={{
                      background: filter === f ? 'var(--wc-accent)' : 'rgba(31, 106, 82, 0.08)',
                      color: filter === f ? '#fff' : 'var(--wc-muted)',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>
                  Sort
                </div>
                {SORTS.map(option => (
                  <button
                    key={option.key}
                    onClick={() => setSort(option.key)}
                    className="rounded-full px-4 py-2 text-sm font-medium transition"
                    style={{
                      background: sort === option.key ? 'rgba(199, 124, 67, 0.92)' : 'rgba(199, 124, 67, 0.08)',
                      color: sort === option.key ? '#fff' : '#8a5a33',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-start lg:justify-end">
              <button
                onClick={handleExportCsv}
                className="rounded-2xl px-5 py-3 text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, var(--wc-accent) 0%, #2d7e65 100%)' }}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_140px] border-b px-6 py-3 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)', borderColor: 'var(--wc-border)' }}>
          <div>Word and learning record</div>
          <div className="text-right">Status</div>
        </div>

        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-sm" style={{ color: 'var(--wc-muted)' }}>No words found</div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map(virtualItem => {
                const w = filtered[virtualItem.index]
                const record = records[w.word] || {}
                const isMastered = record?.status === 'mastered'
                const mySentence = record?.draft?.trim()
                const statusLabel = getStatusLabel(record)
                const feedbackSummary = getFeedbackSummary(record)
                const attemptsLabel = `${record.attempts || 0}/${record.acceptedAttempts || 0}`

                return (
                  <div
                    key={w.word}
                    style={{
                      position: 'absolute',
                      top: `${virtualItem.start}px`,
                      left: 0,
                      right: 0,
                      height: `${ROW_HEIGHT}px`,
                    }}
                    className="grid grid-cols-[minmax(0,1fr)_140px] gap-4 border-b px-6 py-4"
                    aria-label={w.word}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-semibold">{w.word}</span>
                        <span className="text-sm" style={{ color: 'var(--wc-muted)' }}>{w.pos}</span>
                        <Link
                          to={`/study?word=${encodeURIComponent(w.word)}`}
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{ background: 'rgba(31, 106, 82, 0.08)', color: 'var(--wc-accent)' }}
                        >
                          Study word
                        </Link>
                      </div>
                      {mySentence ? (
                        <div className="truncate text-sm" style={{ color: 'var(--wc-text)' }}>
                          My sentence: {mySentence}
                        </div>
                      ) : (
                        <div className="truncate text-sm italic" style={{ color: 'var(--wc-muted)' }}>
                          Reference: {w.example}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--wc-muted)' }}>
                        <span>Attempts: {attemptsLabel}</span>
                        <span>Updated: {getUpdatedLabel(record.updatedAt)}</span>
                      </div>
                      <div className="mt-2 truncate text-sm" style={{ color: isWeakRecord(record) ? '#9a5a1f' : 'var(--wc-muted)' }}>
                        {feedbackSummary}
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between gap-2 text-right">
                      <div className="text-sm font-medium" style={{ color: isMastered ? 'var(--wc-accent)' : isWeakRecord(record) ? '#9a5a1f' : 'var(--wc-muted)' }}>
                        {statusLabel}
                      </div>
                      {isWeakRecord(record) && (
                        <div className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'rgba(199, 124, 67, 0.12)', color: '#9a5a1f' }}>
                          Needs review
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
