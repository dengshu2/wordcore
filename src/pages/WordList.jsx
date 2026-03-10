import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
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

const ROW_HEIGHT = 88
const PAGE_SIZE = 50

function isWeakRecord(record = {}) {
  return record.status === 'learning' && record.attempts > 0 && !record.feedback?.isAcceptable
}

function getStatusLabel(record = {}) {
  if (record.status === 'mastered') return 'Mastered'
  if (record.draft?.trim()) return 'Written'
  return 'Learning'
}

function getFeedbackSummary(record = {}) {
  if (record.feedback?.isAcceptable) return 'Latest check: acceptable'
  if (record.feedback?.grammarFeedback) return `Latest check: ${record.feedback.grammarFeedback}`
  if (record.feedback?.naturalnessFeedback) return `Latest check: ${record.feedback.naturalnessFeedback}`
  return null
}

function getUpdatedLabel(updatedAt) {
  if (!updatedAt) return null
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
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
  const ts = new Date(record.updatedAt || 0).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

function compareBySort(left, right, records, sortKey) {
  const l = records[left.word] || {}
  const r = records[right.word] || {}
  if (sortKey === 'recent') {
    const d = getUpdatedTimestamp(r) - getUpdatedTimestamp(l)
    if (d !== 0) return d
  }
  if (sortKey === 'alpha') return left.word.localeCompare(right.word)
  const pd = getPriorityScore(l) - getPriorityScore(r)
  if (pd !== 0) return pd
  const rd = getUpdatedTimestamp(r) - getUpdatedTimestamp(l)
  if (rd !== 0) return rd
  return left.word.localeCompare(right.word)
}

export default function WordList() {
  const { records, masteredCount } = useProgressContext()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('weak')
  const [page, setPage] = useState(1)
  const parentRef = useRef(null)

  useEffect(() => { document.title = 'WordCore — Words' }, [])

  // Reset to first page when search/filter/sort changes
  const setQueryAndReset = useCallback(v => { setQuery(v); setPage(1) }, [])
  const setFilterAndReset = useCallback(v => { setFilter(v); setPage(1) }, [])
  const setSortAndReset = useCallback(v => { setSort(v); setPage(1) }, [])

  const filtered = useMemo(() =>
    words
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
      .sort((a, b) => compareBySort(a, b, records, sort))
    , [query, filter, records, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length)
  const paged = useMemo(() => filtered.slice(pageStart, pageEnd), [filtered, pageStart, pageEnd])

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
    count: paged.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const weakCount = Object.values(records).filter(r => isWeakRecord(r)).length

  function goPage(n) {
    setPage(n)
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="words-shell">

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="words-toolbar">
        {/* Stats line */}
        <p className="words-stats-line">
          {masteredCount} mastered · {filtered.length} shown
          {weakCount > 0 && <span className="words-stats-line__weak"> · {weakCount} weak</span>}
        </p>

        {/* Search + Export */}
        <div className="words-search-row">
          <input
            type="search"
            id="word-search"
            className="input"
            placeholder="Search words…"
            value={query}
            onChange={e => setQueryAndReset(e.target.value)}
          />
          <button className="btn btn--outline btn--sm" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="words-chips-row">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`chip${filter === f ? ' chip--active-green' : ''}`}
              onClick={() => setFilterAndReset(f)}
            >
              {f}
            </button>
          ))}
          <span className="words-chips-sep" aria-hidden="true" />
          {SORTS.map(option => (
            <button
              key={option.key}
              className={`chip${sort === option.key ? ' chip--active-warm' : ''}`}
              onClick={() => setSortAndReset(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      <div ref={parentRef} className="words-list">
        {filtered.length === 0 ? (
          <div className="words-empty">No words match.</div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualItem => {
              const w = paged[virtualItem.index]
              const record = records[w.word] || {}
              const isMastered = record.status === 'mastered'
              const isWeak = isWeakRecord(record)
              const mySentence = record.draft?.trim()
              const statusLabel = getStatusLabel(record)
              const feedbackSummary = getFeedbackSummary(record)
              const updatedLabel = getUpdatedLabel(record.updatedAt)
              const attemptsLabel = `${record.attempts || 0}/${record.acceptedAttempts || 0}`

              return (
                <div
                  key={w.word}
                  aria-label={w.word}
                  className="word-row"
                  style={{
                    position: 'absolute',
                    top: `${virtualItem.start}px`,
                    left: 0,
                    right: 0,
                    height: `${ROW_HEIGHT}px`,
                  }}
                >
                  {/* Left */}
                  <div className="word-row__left">
                    <div className="word-row__title">
                      <span className="word-row__word">{w.word}</span>
                      <span className="word-row__pos">{w.pos}</span>
                      <Link to={`/study?word=${encodeURIComponent(w.word)}`} className="badge badge--accent">
                        Study word
                      </Link>
                    </div>

                    <p className="word-row__sentence">
                      {mySentence
                        ? <>My sentence: {mySentence}</>
                        : <em>{w.example}</em>
                      }
                    </p>

                    <p className="word-row__meta">
                      Attempts: {attemptsLabel}
                      {updatedLabel && <> · Updated: {updatedLabel}</>}
                      {feedbackSummary && <> · <span style={{ color: isWeak ? 'var(--wc-error)' : 'inherit' }}>{feedbackSummary}</span></>}
                    </p>
                  </div>

                  {/* Right: status */}
                  <div className="word-row__status" style={{ color: isMastered ? 'var(--wc-accent)' : isWeak ? 'var(--wc-error)' : 'var(--wc-muted)' }}>
                    {statusLabel}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="words-pagination">
          <button
            className="btn btn--ghost"
            disabled={safePage <= 1}
            onClick={() => goPage(safePage - 1)}
            aria-label="Previous page"
          >
            ‹ Prev
          </button>
          <span className="words-pagination__info num">
            {pageStart + 1}–{pageEnd} of {filtered.length}
          </span>
          <button
            className="btn btn--ghost"
            disabled={safePage >= totalPages}
            onClick={() => goPage(safePage + 1)}
            aria-label="Next page"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  )
}
