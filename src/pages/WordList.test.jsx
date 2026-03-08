import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import WordList from './WordList'

// useVirtualizer requires a real scroll container with dimensions.
// In jsdom there are none, so mock it to render all items directly.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, getScrollElement, estimateSize }) => ({
    getTotalSize: () => count * estimateSize(),
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(),
        size: estimateSize(),
        key: index,
      })),
  }),
}))

vi.mock('../data/wordBank', () => ({
  default: [
    { word: 'apple', pos: 'noun', definition: 'a round fruit', example: 'I eat an apple every day.' },
    { word: 'run', pos: 'verb', definition: 'to move fast', example: 'She runs every morning.' },
    { word: 'zebra', pos: 'noun', definition: 'an African animal', example: 'The zebra ran across the field.' },
  ]
}))

vi.mock('../hooks/useProgress', () => ({
  default: () => ({
    records: {
      apple: {
        status: 'mastered',
        draft: '',
        attempts: 3,
        acceptedAttempts: 2,
        updatedAt: '2026-03-08T08:00:00.000Z',
        feedback: { isAcceptable: true },
      },
      run: {
        status: 'learning',
        draft: 'I run after dinner.',
        attempts: 2,
        acceptedAttempts: 0,
        updatedAt: '2026-03-08T09:00:00.000Z',
        feedback: { isAcceptable: false, grammarFeedback: 'Use the simple present here.' },
      },
      zebra: {
        status: 'learning',
        draft: 'The zebra is near the tree.',
        attempts: 1,
        acceptedAttempts: 1,
        updatedAt: '2026-03-08T10:00:00.000Z',
        feedback: { isAcceptable: true },
      },
    },
    masteredCount: 1,
  })
}))

describe('WordList', () => {
  it('shows all words', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.getByText('run')).toBeInTheDocument()
    expect(screen.getByText('zebra')).toBeInTheDocument()
  })

  it('filters to mastered words', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /mastered/i }))
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.queryByText('run')).not.toBeInTheDocument()
  })

  it('filters by search query', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'app' } })
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.queryByText('run')).not.toBeInTheDocument()
  })

  it('filters to written words', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /written/i }))
    expect(screen.getByText('run')).toBeInTheDocument()
    expect(screen.queryByText('apple')).not.toBeInTheDocument()
  })

  it('shows my sentence when a draft exists', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getByText(/my sentence: i run after dinner\./i)).toBeInTheDocument()
  })

  it('shows attempts and latest feedback summary', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getByText(/attempts: 2\/0/i)).toBeInTheDocument()
    expect(screen.getByText(/latest check: use the simple present here\./i)).toBeInTheDocument()
  })

  it('filters to weak words', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /^weak$/i }))
    expect(screen.getByText('run')).toBeInTheDocument()
    expect(screen.queryByText('apple')).not.toBeInTheDocument()
  })

  it('prioritizes weak words before mastered words in the default list', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    const items = screen.getAllByLabelText(/apple|run|zebra/i)
    expect(items[0]).toHaveAttribute('aria-label', 'run')
    expect(items[1]).toHaveAttribute('aria-label', 'zebra')
    expect(items[2]).toHaveAttribute('aria-label', 'apple')
  })

  it('can sort by most recently updated', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /recently updated/i }))
    const items = screen.getAllByLabelText(/apple|run|zebra/i)
    expect(items[0]).toHaveAttribute('aria-label', 'zebra')
    expect(items[1]).toHaveAttribute('aria-label', 'run')
    expect(items[2]).toHaveAttribute('aria-label', 'apple')
  })

  it('can sort alphabetically', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /a-z/i }))
    const items = screen.getAllByLabelText(/apple|run|zebra/i)
    expect(items[0]).toHaveAttribute('aria-label', 'apple')
    expect(items[1]).toHaveAttribute('aria-label', 'run')
    expect(items[2]).toHaveAttribute('aria-label', 'zebra')
  })

  it('shows an export button', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('links each word back into study', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: /study word/i })[0]).toHaveAttribute('href', '/study?word=run')
  })
})
