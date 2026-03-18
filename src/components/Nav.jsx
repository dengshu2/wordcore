import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProgressContext } from '../context/ProgressContext'
import { WORD_BANK_SIZE } from '../data/wordBankMeta'

const links = [
  { to: '/study', label: 'Study', num: '01' },
  { to: '/words', label: 'Words', num: '02' },
]

export default function Nav() {
  const { masteredCount } = useProgressContext()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-name">WordCore</div>
          <div className="sidebar__brand-progress">
            {masteredCount} <span>/ {WORD_BANK_SIZE}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav" aria-label="Main navigation">
          {links.map(({ to, label, num }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  <span className="nav-link__num">{num}</span>
                  <span>{label}</span>
                  {isActive && <span className="nav-link__dot" aria-hidden="true" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__spacer" />

        {/* User footer */}
        <div className="sidebar__user">
          <span className="sidebar__user-email" title={user?.email}>{user?.email}</span>
          <button className="btn btn--ghost" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ──────────────────────────────────── */}
      <nav className="tab-bar" aria-label="Main navigation">
        {links.map(({ to, label, num }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}
          >
            <span className="tab-link__num">{num}</span>
            {label}
          </NavLink>
        ))}
        <button className="tab-bar__logout" onClick={handleLogout}>
          Sign out
        </button>
      </nav>
    </>
  )
}
