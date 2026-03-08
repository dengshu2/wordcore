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
  ]
}))

vi.mock('../hooks/useProgress', () => ({
  default: () => ({
    progress: { apple: 'mastered', run: 'learning' },
    drafts: { run: 'I run after dinner.' },
  })
}))

describe('WordList', () => {
  it('shows all words', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.getByText('run')).toBeInTheDocument()
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

  it('shows an export button', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })
})
