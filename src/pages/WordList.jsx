import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import words from '../data/wordBank'
import useProgress from '../hooks/useProgress'
import { buildWordCsv } from './wordExport'

const FILTERS = ['All', 'Learning', 'Mastered', 'Written']
const ROW_HEIGHT = 92

export default function WordList() {
  const { progress, drafts } = useProgress()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const parentRef = useRef(null)
  const masteredCount = Object.values(progress).filter(status => status === 'mastered').length
  const writtenCount = Object.values(drafts).filter(sentence => sentence?.trim()).length

  const filtered = useMemo(() => {
    return words.filter(w => {
      const matchesQuery = w.word.toLowerCase().includes(query.toLowerCase())
      const status = progress[w.word] === 'mastered' ? 'Mastered' : 'Learning'
      const hasDraft = Boolean(drafts[w.word]?.trim())
      const matchesFilter =
        filter === 'All' ||
        status === filter ||
        (filter === 'Written' && hasDraft)
      return matchesQuery && matchesFilter
    })
  }, [query, filter, progress, drafts])

  function handleExportCsv() {
    const csv = buildWordCsv(filtered, progress, drafts)
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
          <div>Word and sentences</div>
          <div className="text-right">Status</div>
        </div>

        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-sm" style={{ color: 'var(--wc-muted)' }}>No words found</div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map(virtualItem => {
                const w = filtered[virtualItem.index]
                const isMastered = progress[w.word] === 'mastered'
                const mySentence = drafts[w.word]?.trim()

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
                    className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-4 border-b px-6"
                    aria-label={w.word}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{w.word}</span>
                        <span className="text-sm" style={{ color: 'var(--wc-muted)' }}>{w.pos}</span>
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
                    </div>
                    <div className="text-right text-sm font-medium" style={{ color: isMastered ? 'var(--wc-accent)' : 'var(--wc-muted)' }}>
                      {isMastered ? 'Mastered' : mySentence ? 'Written' : 'Learning'}
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
