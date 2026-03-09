import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProgressContext } from '../context/ProgressContext'
import { WORD_BANK_SIZE } from '../data/wordBankMeta'

const TOTAL = WORD_BANK_SIZE

function isWeakRecord(record = {}) {
  return record.status === 'learning' && record.attempts > 0 && !record.feedback?.isAcceptable
}

export default function Home() {
  const { records, masteredCount } = useProgressContext()

  useEffect(() => { document.title = 'WordCore' }, [])

  const entries = Object.entries(records)
  const weakCount = entries.filter(([, r]) => isWeakRecord(r)).length
  const readyCount = entries.filter(([, r]) => r.status === 'learning' && r.acceptedAttempts >= 1).length
  const weakFirst = entries.find(([, r]) => isWeakRecord(r))
  const readyFirst = entries.find(([, r]) => r.status === 'learning' && r.acceptedAttempts >= 1)

  return (
    <div className="home-layout">
      {/* Progress */}
      <p className="home-progress">
        <span className="home-progress__num">{masteredCount}</span>
        <span className="home-progress__sep"> / {TOTAL} mastered</span>
      </p>

      {/* Primary actions */}
      <div className="home-actions">
        <Link
          to={weakFirst ? `/study?word=${encodeURIComponent(weakFirst[0])}` : '/study'}
          className="btn btn--primary"
        >
          Start Next Word
        </Link>
        <Link to="/words" className="btn btn--outline">Browse Word Bank</Link>
      </div>

      {/* Minimal status hints — only shown when nonzero */}
      {(weakCount > 0 || readyCount > 0) && (
        <div className="home-hints">
          {weakCount > 0 && (
            <Link
              to={weakFirst ? `/study?word=${encodeURIComponent(weakFirst[0])}` : '/study'}
              className="home-hint home-hint--warn"
              aria-label={weakFirst ? `Open "${weakFirst[0]}" and fix the latest problem first.` : 'Resume weak word practice.'}
            >
              <span className="home-hint__num">{weakCount}</span>
              <span className="home-hint__label">weak</span>
            </Link>
          )}
          {readyCount > 0 && (
            <Link
              to={readyFirst ? `/study?word=${encodeURIComponent(readyFirst[0])}` : '/study'}
              className="home-hint home-hint--ok"
              aria-label={readyFirst ? `Ready soon — ${readyFirst[0]} is close to mastery.` : 'Words ready to master.'}
            >
              <span className="home-hint__num">{readyCount}</span>
              <span className="home-hint__label">ready to master</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
