import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import Home from './Home'

vi.mock('../context/ProgressContext', () => ({
  useProgressContext: () => ({
    masteredCount: 42,
    records: {
      apple: {
        status: 'learning',
        attempts: 2,
        acceptedAttempts: 0,
        updatedAt: '2026-03-08T09:00:00.000Z',
        feedback: { isAcceptable: false },
      },
      banana: {
        status: 'learning',
        attempts: 2,
        acceptedAttempts: 1,
        updatedAt: '2026-03-08T10:00:00.000Z',
        feedback: { isAcceptable: true },
      },
    },
  })
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
    expect(screen.getByRole('link', { name: /start next word/i })).toBeInTheDocument()
  })

  it('shows actionable weak and recent sections', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /open "apple" and fix the latest problem first\./i })).toHaveAttribute('href', '/study?word=apple')
    expect(screen.getByRole('link', { name: /ready soon.*banana/i })).toHaveAttribute('href', '/study?word=banana')
  })
})
