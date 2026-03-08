import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import Nav from './Nav'

// Nav now uses useAuth — provide a minimal mock
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@example.com' }, logout: vi.fn() }),
}))

// Nav uses useProgress — mock it to avoid API calls
vi.mock('../hooks/useProgress', () => ({
  default: () => ({ masteredCount: 0 }),
}))

function renderNav(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Nav />
    </MemoryRouter>
  )
}

describe('Nav', () => {
  it('renders three navigation links', () => {
    renderNav()
    expect(screen.getAllByRole('link', { name: /home/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /study/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /words/i }).length).toBeGreaterThan(0)
  })

  it('shows the user email', () => {
    renderNav()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })
})
