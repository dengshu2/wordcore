import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useProgress from '../hooks/useProgress'
import { WORD_BANK_SIZE } from '../data/wordBankMeta'

const links = [
  { to: '/', label: 'Home', icon: '01' },
  { to: '/study', label: 'Study', icon: '02' },
  { to: '/words', label: 'Words', icon: '03' },
]

export default function Nav() {
  const { masteredCount } = useProgress()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }
  const total = WORD_BANK_SIZE
  const remaining = total - masteredCount

  return (
    <>
      <aside className="hidden lg:sticky lg:top-6 lg:flex lg:h-[calc(100vh-3rem)] lg:w-[248px] lg:flex-none lg:flex-col lg:justify-between lg:rounded-[30px] lg:border lg:p-6 lg:shadow-[var(--wc-shadow)]" style={{ background: 'var(--wc-surface)', borderColor: 'var(--wc-border)' }}>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: 'var(--wc-warm)' }}>
              WordCore
            </div>
            <p className="text-sm leading-6" style={{ color: 'var(--wc-muted)' }}>
              A quiet workspace for steady vocabulary practice.
            </p>
          </div>

          <nav className="space-y-2">
            {links.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-2xl border px-4 py-3 transition ${isActive ? 'shadow-sm' : ''
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? 'var(--wc-surface-strong)' : 'transparent',
                  borderColor: isActive ? 'rgba(31, 106, 82, 0.28)' : 'transparent',
                  color: isActive ? 'var(--wc-text)' : 'var(--wc-muted)',
                })}
              >
                <span className="font-medium">{label}</span>
                <span className="rounded-full px-2 py-1 text-xs" style={{ background: 'rgba(31, 106, 82, 0.08)' }}>
                  {icon}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="rounded-[24px] border p-4" style={{ background: 'rgba(31, 106, 82, 0.06)', borderColor: 'rgba(31, 106, 82, 0.12)' }}>
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--wc-muted)' }}>
            Progress
          </div>
          <div className="mt-3 text-3xl font-semibold">{masteredCount}</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--wc-muted)' }}>
            mastered out of {total}
          </div>
          <div className="mt-4 h-2 rounded-full" style={{ background: 'rgba(31, 106, 82, 0.12)' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${Math.round((masteredCount / total) * 100)}%`,
                background: 'linear-gradient(90deg, var(--wc-accent) 0%, #4a9a7d 100%)',
              }}
            />
          </div>
          <div className="mt-3 text-sm" style={{ color: 'var(--wc-muted)' }}>
            {remaining} words still in rotation.
          </div>
        </div>

        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--wc-border)' }}>
          <div className="truncate text-xs" style={{ color: 'var(--wc-muted)' }}>{user?.email}</div>
          <button
            onClick={handleLogout}
            className="mt-2 text-xs font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--wc-muted)' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t px-3 py-2 lg:hidden" style={{ background: 'rgba(255, 250, 241, 0.95)', borderColor: 'var(--wc-border)', backdropFilter: 'blur(18px)' }}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center rounded-2xl px-2 py-2 text-xs transition ${isActive ? 'font-semibold' : ''
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--wc-accent)' : 'var(--wc-muted)',
              background: isActive ? 'rgba(31, 106, 82, 0.08)' : 'transparent',
            })}
          >
            <span className="text-[11px] tracking-[0.2em]">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
