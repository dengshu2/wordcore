import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import Home from './Home'

vi.mock('../hooks/useProgress', () => ({
  default: () => ({ masteredCount: 42, progress: {} })
}))

vi.mock('../data/wordBankMeta', () => ({
  WORD_BANK_SIZE: 3000,
}))

describe('Home', () => {
  it('shows mastered count', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getAllByText('42').length).toBeGreaterThan(0)
  })

  it('shows total word count', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByText(/3000/)).toBeInTheDocument()
  })

  it('has a Start Practice link', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /start practice/i })).toBeInTheDocument()
  })
})
