import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProgressContext } from '../context/ProgressContext'
import { WORD_BANK_SIZE } from '../data/wordBankMeta'

const links = [
  { to: '/', label: 'Home', num: '01' },
  { to: '/study', label: 'Study', num: '02' },
  { to: '/words', label: 'Words', num: '03' },
]

export default function Nav() {
  const { masteredCount } = useProgressContext()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const total = WORD_BANK_SIZE
  const pct = total > 0 ? Math.round((masteredCount / total) * 100) : 0

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className="hidden lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:w-[240px] lg:flex-none lg:flex-col lg:rounded-[28px] lg:border lg:shadow-(--wc-shadow)"
        style={{ background: 'var(--wc-surface)', borderColor: 'var(--wc-border)' }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-4 border-b" style={{ borderColor: 'var(--wc-border)' }}>
          <div
            className="text-[10px] font-semibold uppercase tracking-[0.32em]"
            style={{ color: 'var(--wc-warm)' }}
          >
            WordCore
          </div>
          <p className="mt-1.5 text-[13px] leading-5" style={{ color: 'var(--wc-muted)' }}>
            A quiet space for steady vocabulary practice.
          </p>
        </div>

        {/* Navigation */}
        <nav className="px-3 pt-3 space-y-0.5">
          {links.map(({ to, label, num }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${isActive ? '' : 'hover:bg-black/4'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'rgba(31, 106, 82, 0.09)' : undefined,
                color: isActive ? 'var(--wc-accent)' : 'var(--wc-muted)',
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-[10px] font-semibold transition-all"
                    style={{
                      background: isActive
                        ? 'rgba(31, 106, 82, 0.14)'
                        : 'rgba(69, 44, 27, 0.07)',
                      color: isActive ? 'var(--wc-accent)' : 'var(--wc-muted)',
                    }}
                  >
                    {num}
                  </span>
                  <span>{label}</span>
                  {isActive && (
                    <span
                      className="ml-auto h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--wc-accent)' }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Progress card */}
        <div className="px-3 pb-3">
          <div
            className="rounded-[22px] p-4"
            style={{
              background: 'rgba(31, 106, 82, 0.06)',
              border: '1px solid rgba(31, 106, 82, 0.11)',
            }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.28em]"
              style={{ color: 'var(--wc-muted)' }}
            >
              Progress
            </div>

            <div className="mt-3 flex items-end gap-2">
              <div className="text-[2.4rem] font-semibold leading-none" style={{ color: 'var(--wc-text)' }}>
                {masteredCount}
              </div>
              <div className="mb-0.5 text-sm leading-5" style={{ color: 'var(--wc-muted)' }}>
                / {total}
              </div>
            </div>

            <div
              className="mt-1 text-[12px] leading-4"
              style={{ color: 'var(--wc-muted)' }}
            >
              mastered
            </div>

            {/* Progress bar */}
            <div
              className="mt-3.5 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(31, 106, 82, 0.12)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--wc-accent) 0%, #5aab84 100%)',
                }}
              />
            </div>

            <div
              className="mt-2 text-[12px] leading-4"
              style={{ color: 'var(--wc-muted)' }}
            >
              {pct}% complete · {total - masteredCount} remaining
            </div>
          </div>
        </div>

        {/* User footer */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-4 border-t"
          style={{ borderColor: 'var(--wc-border)' }}
        >
          <div className="min-w-0">
            <div
              className="truncate text-[12px] font-medium"
              style={{ color: 'var(--wc-text)' }}
            >
              {user?.email}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-black/6"
            style={{ color: 'var(--wc-muted)' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom bar ─────────────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t px-3 py-2 lg:hidden"
        style={{
          background: 'rgba(255, 250, 241, 0.96)',
          borderColor: 'var(--wc-border)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {links.map(({ to, label, num }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center rounded-xl px-2 py-2 text-[11px] transition ${isActive ? 'font-semibold' : ''
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--wc-accent)' : 'var(--wc-muted)',
              background: isActive ? 'rgba(31, 106, 82, 0.08)' : 'transparent',
            })}
          >
            <span className="text-[10px] tracking-[0.22em] mb-0.5">{num}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
