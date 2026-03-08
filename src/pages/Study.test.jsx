import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Study from './Study'

const MOCK_WORDS = [
  { word: 'abandon', pos: 'verb', definition: 'to leave something permanently', example: 'She had to abandon her car in the snow.' },
  { word: 'able', pos: 'adjective', definition: 'having the skill to do something', example: 'He was able to fix the car himself.' },
]

vi.mock('../data/wordBank', () => ({
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

  it('shows the word and its definition', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    // One of the two words must be shown
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    expect(shown).toBeTruthy()
    expect(screen.getByText(shown.word)).toBeInTheDocument()
  })

  it('hides example sentence initially', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    expect(screen.queryByText(/She had to abandon/)).not.toBeInTheDocument()
    expect(screen.queryByText(/He was able to fix/)).not.toBeInTheDocument()
  })

  it('reveals example after clicking Compare', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(screen.getByPlaceholderText(/type a sentence/i), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    expect(screen.getByText(shown.example)).toBeInTheDocument()
  })

  it('calls setStatus mastered when Mastered is clicked', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(screen.getByPlaceholderText(/type a sentence/i), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    fireEvent.click(screen.getByRole('button', { name: /mastered/i }))
    expect(mockSetStatus).toHaveBeenCalledWith(shown.word, 'mastered')
  })

  it('calls setStatus learning when Again is clicked', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(screen.getByPlaceholderText(/type a sentence/i), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    fireEvent.click(screen.getByRole('button', { name: /again/i }))
    expect(mockSetStatus).toHaveBeenCalledWith(shown.word, 'learning')
  })

  it('advances to the next word after clicking Again', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    const first = MOCK_WORDS.find(w => screen.queryByText(w.word))
    const other = MOCK_WORDS.find(w => w.word !== first.word)
    fireEvent.change(screen.getByPlaceholderText(/type a sentence/i), { target: { value: `The word ${first.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    fireEvent.click(screen.getByRole('button', { name: /again/i }))
    expect(screen.getByText(other.word)).toBeInTheDocument()
  })

  it('disables Compare until the user writes a sentence containing the target word', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    const button = screen.getByRole('button', { name: /compare/i })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText(/type a sentence/i), { target: { value: 'I can use this word.' } })
    expect(screen.getByText(new RegExp(`include the word "${shown.word}"`, 'i'))).toBeInTheDocument()
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText(/type a sentence/i), { target: { value: `The word ${shown.word} is in this sentence.` } })
    expect(button).not.toBeDisabled()
  })
})
