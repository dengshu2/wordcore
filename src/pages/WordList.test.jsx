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

vi.mock('../data/words.json', () => ({
  default: [
    { word: 'apple', pos: 'noun', definition: 'a round fruit', example: 'I eat an apple every day.' },
    { word: 'run', pos: 'verb', definition: 'to move fast', example: 'She runs every morning.' },
  ]
}))

vi.mock('../hooks/useProgress', () => ({
  default: () => ({ progress: { apple: 'mastered', run: 'learning' } })
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
})

