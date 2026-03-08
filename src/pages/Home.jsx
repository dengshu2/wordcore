import { Link } from 'react-router-dom'
import useProgress from '../hooks/useProgress'
import { WORD_BANK_SIZE } from '../data/wordBankMeta'

const TOTAL = WORD_BANK_SIZE

export default function Home() {
  const { masteredCount } = useProgress()
  const pct = Math.round((masteredCount / TOTAL) * 100)
  const remaining = TOTAL - masteredCount

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <section className="rounded-[30px] border p-7 lg:p-10" style={{ background: 'var(--wc-surface-strong)', borderColor: 'var(--wc-border)' }}>
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--wc-warm)' }}>
              Daily practice
            </div>
            <h1 className="mt-4 text-4xl leading-tight font-semibold lg:text-6xl">
              Move from recognition to real sentence-level recall.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 lg:text-lg" style={{ color: 'var(--wc-muted)' }}>
              The layout now behaves more like a desktop learning workspace: clear navigation, a steady review loop, and a word bank you can scan without losing context.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/study"
              className="rounded-2xl px-6 py-4 text-center text-base font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg, var(--wc-accent) 0%, #2d7e65 100%)' }}
            >
              Start Practice
            </Link>
            <Link
              to="/words"
              className="rounded-2xl border px-6 py-4 text-center text-base font-semibold"
              style={{ borderColor: 'var(--wc-border)', color: 'var(--wc-text)' }}
            >
              Browse Word Bank
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border p-5" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.56)' }}>
              <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>Mastered</div>
              <div className="mt-3 text-4xl font-semibold">{masteredCount}</div>
            </div>
            <div className="rounded-[24px] border p-5" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.56)' }}>
              <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>Still rotating</div>
              <div className="mt-3 text-4xl font-semibold">{remaining}</div>
            </div>
            <div className="rounded-[24px] border p-5" style={{ borderColor: 'var(--wc-border)', background: 'rgba(255,255,255,0.56)' }}>
              <div className="text-sm" style={{ color: 'var(--wc-muted)' }}>Coverage</div>
              <div className="mt-3 text-4xl font-semibold">{pct}%</div>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <div className="rounded-[30px] border p-6" style={{ background: 'rgba(31, 106, 82, 0.07)', borderColor: 'rgba(31, 106, 82, 0.14)' }}>
            <div className="text-sm uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>
              Progress snapshot
            </div>
            <div className="mt-6 text-6xl font-semibold" style={{ color: 'var(--wc-accent)' }}>{masteredCount}</div>
            <div className="mt-2 text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
              of {TOTAL} mastered
            </div>
            <div className="mt-5 h-3 rounded-full" style={{ background: 'rgba(31, 106, 82, 0.12)' }}>
              <div
                className="h-3 rounded-full transition-all"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--wc-accent) 0%, #5aa789 100%)' }}
              />
            </div>
          </div>

          <div className="rounded-[30px] border p-6" style={{ background: 'rgba(199, 124, 67, 0.08)', borderColor: 'rgba(199, 124, 67, 0.14)' }}>
            <div className="text-sm uppercase tracking-[0.22em]" style={{ color: 'var(--wc-muted)' }}>
              Study rhythm
            </div>
            <div className="mt-5 space-y-4 text-sm leading-6" style={{ color: 'var(--wc-text)' }}>
              <div>Write your own sentence before revealing the model answer.</div>
              <div>Priority goes to unseen and not-yet-mastered words.</div>
              <div>Recent cards are held back to reduce instant repetition.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
