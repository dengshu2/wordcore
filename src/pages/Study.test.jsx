import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Study from './Study'

const mockWords = [
  { word: 'abandon', pos: 'verb', definition: 'to leave something permanently', example: 'She had to abandon her car in the snow.' },
  { word: 'able', pos: 'adjective', definition: 'having the skill to do something', example: 'He was able to fix the car himself.' },
]

vi.mock('../data/words.json', () => ({
  default: [
    { word: 'abandon', pos: 'verb', definition: 'to leave something permanently', example: 'She had to abandon her car in the snow.' },
    { word: 'able', pos: 'adjective', definition: 'having the skill to do something', example: 'He was able to fix the car himself.' },
  ]
}))

const mockSetStatus = vi.fn()
vi.mock('../hooks/useProgress', () => ({
  default: () => ({ progress: {}, setStatus: mockSetStatus, masteredCount: 0 })
}))

describe('Study', () => {
  beforeEach(() => mockSetStatus.mockClear())

  it('shows the word and definition', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    expect(screen.getByText('abandon')).toBeInTheDocument()
    expect(screen.getByText(/verb/i)).toBeInTheDocument()
    expect(screen.getByText(/to leave something permanently/i)).toBeInTheDocument()
  })

  it('hides example sentence initially', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    expect(screen.queryByText(/She had to abandon/)).not.toBeInTheDocument()
  })

  it('reveals example after clicking Compare', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    expect(screen.getByText(/She had to abandon/)).toBeInTheDocument()
  })

  it('calls setStatus mastered when Mastered is clicked', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    fireEvent.click(screen.getByRole('button', { name: /mastered/i }))
    expect(mockSetStatus).toHaveBeenCalledWith('abandon', 'mastered')
  })

  it('calls setStatus learning when Again is clicked', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    fireEvent.click(screen.getByRole('button', { name: /again/i }))
    expect(mockSetStatus).toHaveBeenCalledWith('abandon', 'learning')
  })
})
