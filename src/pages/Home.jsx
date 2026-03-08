import { Link } from 'react-router-dom'
import useProgress from '../hooks/useProgress'
import { WORD_BANK_SIZE } from '../data/wordBankMeta'

const TOTAL = WORD_BANK_SIZE

function isWeakRecord(record = {}) {
  return record.status === 'learning' && record.attempts > 0 && !record.feedback?.isAcceptable
}

function getUpdatedTimestamp(record = {}) {
  const timestamp = new Date(record.updatedAt || 0).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export default function Home() {
  const { records, masteredCount } = useProgress()
  const pct = Math.round((masteredCount / TOTAL) * 100)
  const remaining = TOTAL - masteredCount
  const entries = Object.entries(records)
  const weakWords = entries.filter(([, record]) => isWeakRecord(record))
  const readyToMaster = entries.filter(([, record]) => record.status === 'learning' && record.acceptedAttempts >= 1)
  const recentChecked = [...entries]
    .filter(([, record]) => record.updatedAt)
    .sort((left, right) => getUpdatedTimestamp(right[1]) - getUpdatedTimestamp(left[1]))
    .slice(0, 3)

  return (
    <div className="flex min-h-full flex-col px-6 py-6 lg:px-10 lg:py-8">
      <div className="min-h-full flex-1">
        <section
          className="grid min-h-full gap-5 rounded-[30px] border p-5 lg:grid-rows-[minmax(0,1fr)_auto] lg:p-6"
          style={{ background: 'var(--wc-surface-strong)', borderColor: 'var(--wc-border)' }}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_300px]">
            <div className="flex min-h-full flex-col justify-between rounded-[28px] border p-5 lg:p-6" style={{ borderColor: 'rgba(69, 44, 27, 0.08)', background: 'rgba(255,255,255,0.28)' }}>
              <div className="max-w-3xl">
                <div className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--wc-warm)' }}>
                  Practice desk
                </div>
                <h1 className="mt-3 max-w-4xl text-4xl leading-[0.98] font-semibold lg:text-[4.35rem]">
                  Pick the next useful word and keep moving.
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 lg:text-base" style={{ color: 'var(--wc-muted)' }}>
                  Resume weak words, finish words close to mastery, or open the bank when you want full control.
                </p>
              </div>

              <div className="mt-6">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/study"
                    className="rounded-2xl px-6 py-3.5 text-center text-base font-semibold text-white transition"
                    style={{ background: 'linear-gradient(135deg, var(--wc-accent) 0%, #2d7e65 100%)' }}
                  >
                    Start Next Word
                  </Link>
                  <Link
                    to="/words"
                    className="rounded-2xl border px-6 py-3.5 text-center text-base font-semibold"
                    style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-text)' }}
                  >
                    Browse Word Bank
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border p-4" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.56)' }}>
                    <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>Mastered</div>
                    <div className="mt-2 text-4xl font-semibold">{masteredCount}</div>
                  </div>
                  <div className="rounded-[22px] border p-4" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.56)' }}>
                    <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>Still rotating</div>
                    <div className="mt-2 text-4xl font-semibold">{remaining}</div>
                  </div>
                  <div className="rounded-[22px] border p-4" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.56)' }}>
                    <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>Coverage</div>
                    <div className="mt-2 text-4xl font-semibold">{pct}%</div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="grid gap-4 lg:grid-rows-[auto_1fr]">
              <div className="rounded-[28px] border p-5" style={{ background: 'rgba(31, 106, 82, 0.07)', borderColor: 'rgba(31, 106, 82, 0.14)' }}>
                <div className="text-sm uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>
                  Progress snapshot
                </div>
                <div className="mt-4 text-5xl font-semibold" style={{ color: 'var(--wc-accent)' }}>{masteredCount}</div>
                <div className="mt-1 text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
                  of {TOTAL} mastered
                </div>
                <div className="mt-4 h-3 rounded-full" style={{ background: 'rgba(31, 106, 82, 0.12)' }}>
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--wc-accent) 0%, #5aa789 100%)' }}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border p-5" style={{ background: 'rgba(199, 124, 67, 0.08)', borderColor: 'rgba(199, 124, 67, 0.14)' }}>
                <div className="text-sm uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>
                  What to do now
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6" style={{ color: 'var(--wc-text)' }}>
                  <div>Open a weak word for the fastest quality gain.</div>
                  <div>Use the bank when you want a specific target word.</div>
                  <div>Jump into study when you just want the next card.</div>
                </div>
              </div>
            </aside>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)]">
            <Link
              to={weakWords[0] ? `/study?word=${encodeURIComponent(weakWords[0][0])}` : '/study'}
              className="rounded-[24px] border p-4 transition"
              style={{ borderColor: 'rgba(199, 124, 67, 0.18)', background: 'rgba(199, 124, 67, 0.08)' }}
            >
              <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>Weak words</div>
              <div className="mt-2 text-3xl font-semibold">{weakWords.length}</div>
              <div className="mt-2 text-sm leading-6" style={{ color: 'var(--wc-text)' }}>
                {weakWords[0] ? `Open "${weakWords[0][0]}" and fix the latest problem first.` : 'No weak words right now. Continue normal practice.'}
              </div>
            </Link>

            <Link
              to={readyToMaster[0] ? `/study?word=${encodeURIComponent(readyToMaster[0][0])}` : '/study'}
              className="rounded-[24px] border p-4 transition"
              style={{ borderColor: 'rgba(31, 106, 82, 0.16)', background: 'rgba(31, 106, 82, 0.07)' }}
            >
              <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>Ready soon</div>
              <div className="mt-2 text-3xl font-semibold">{readyToMaster.length}</div>
              <div className="mt-2 text-sm leading-6" style={{ color: 'var(--wc-text)' }}>
                {readyToMaster[0] ? `Return to "${readyToMaster[0][0]}" and try to finish the final acceptable check.` : 'No words are close to mastery yet.'}
              </div>
            </Link>

            <div className="rounded-[24px] border p-4" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.56)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>Recent checks</div>
                <Link to="/words" className="text-xs font-medium" style={{ color: 'var(--wc-accent)' }}>
                  Open bank
                </Link>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {recentChecked.length > 0 ? recentChecked.map(([word, record]) => (
                  <Link
                    key={word}
                    to={`/study?word=${encodeURIComponent(word)}`}
                    className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                    style={{ background: 'rgba(255,250,241,0.88)', color: 'var(--wc-text)' }}
                  >
                    <span>{word}</span>
                    <span style={{ color: 'var(--wc-muted)' }}>
                      {record.feedback?.isAcceptable ? 'acceptable' : 'review'}
                    </span>
                  </Link>
                )) : (
                  <div style={{ color: 'var(--wc-muted)' }}>No checked words yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
