import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Nav from './Nav'

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
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Study')).toBeInTheDocument()
    expect(screen.getByText('Words')).toBeInTheDocument()
  })
})
