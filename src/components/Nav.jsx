import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/study', label: 'Study', icon: '📖' },
  { to: '/words', label: 'Words', icon: '📋' },
]

export default function Nav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-xs ${
              isActive ? 'text-blue-600' : 'text-gray-500'
            }`
          }
        >
          <span className="text-xl">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
