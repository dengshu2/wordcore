import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Study from './Study'
import { checkSentence } from '../services/sentenceCheck'

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
vi.mock('../services/sentenceCheck', () => ({
  checkSentence: vi.fn(),
}))

const mockSetStatus = vi.fn()
const mockSaveDraft = vi.fn()
const mockSaveFeedback = vi.fn()
const mockMarkMastered = vi.fn()
const mockConfirmReview = vi.fn()
const mockResetToLearning = vi.fn()
let mockRecords = {}
vi.mock('../context/ProgressContext', () => ({
  useProgressContext: () => ({ records: mockRecords, setStatus: mockSetStatus, saveDraft: mockSaveDraft, saveFeedback: mockSaveFeedback, markMastered: mockMarkMastered, confirmReview: mockConfirmReview, resetToLearning: mockResetToLearning, masteredCount: 0 })
}))

describe('Study', () => {
  beforeEach(() => {
    mockRecords = {}
    mockSetStatus.mockClear()
    mockSaveDraft.mockClear()
    mockMarkMastered.mockClear()
    mockConfirmReview.mockClear()
    mockResetToLearning.mockClear()
    // Simulate the real saveFeedback: updates acceptedAttempts in mockRecords.
    mockSaveFeedback.mockImplementation((word, feedbackResult) => {
      const prev = mockRecords[word] || {}
      mockRecords[word] = {
        ...prev,
        acceptedAttempts: (prev.acceptedAttempts || 0) + (feedbackResult?.is_acceptable ? 1 : 0),
      }
    })
    vi.mocked(checkSentence).mockClear()
    vi.mocked(checkSentence).mockResolvedValue({
      is_acceptable: true,
      grammar_feedback: '',
      naturalness_feedback: '',
      suggested_revision: 'I am going to the park.',
    })
  })

  function getSentenceInput() {
    return screen.getByPlaceholderText(/write one natural sentence/i)
  }

  function renderStudy(initialEntries = ['/']) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Study />
      </MemoryRouter>
    )
  }

  it('shows the word and its definition', () => {
    renderStudy()
    // One of the two words must be shown
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    expect(shown).toBeTruthy()
    expect(screen.getByText(shown.word)).toBeInTheDocument()
  })

  it('shows the reference sentence immediately', () => {
    renderStudy()
    expect(screen.getByText(/She had to abandon|He was able to fix/)).toBeInTheDocument()
  })

  it('shows the last saved feedback before a new self-check', () => {
    mockRecords = {
      abandon: {
        status: 'learning',
        draft: 'The word abandon is in this sentence.',
        lastCheckedSentence: 'The word abandon is in this sentence.',
        acceptedAttempts: 2,
        feedback: {
          isAcceptable: false,
          grammarFeedback: 'Use a more natural sentence pattern.',
          suggestedRevision: 'They had to abandon the trip because of the storm.',
        },
      },
      able: {
        status: 'learning',
        draft: 'He is able to finish the work tonight.',
        lastCheckedSentence: 'He is able to finish the work tonight.',
        acceptedAttempts: 2,
        feedback: {
          isAcceptable: false,
          grammarFeedback: 'Use a more natural sentence pattern.',
          suggestedRevision: 'She was able to finish the work before dinner.',
        },
      },
    }
    renderStudy()
    expect(screen.getByText(/last check: this sentence still needed revision\./i)).toBeInTheDocument()
    expect(screen.getByText(/last checked sentence:/i)).toBeInTheDocument()
    expect(screen.getByText(/use a more natural sentence pattern\./i)).toBeInTheDocument()
    expect(screen.getByText(/suggested:/i)).toBeInTheDocument()
    expect(screen.getByText(/accepted checks: 2\/3/i)).toBeInTheDocument()
  })

  it('reveals AI feedback after clicking Self-check', async () => {
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /self-check/i }))
    expect(await screen.findByText(/this sentence is acceptable for study use/i)).toBeInTheDocument()
    expect(screen.getByText(/suggested: i am going to the park\./i)).toBeInTheDocument()
    expect(mockSaveFeedback).toHaveBeenCalledWith(
      shown.word,
      expect.objectContaining({ is_acceptable: true }),
      `The word ${shown.word} is in this sentence.`
    )
  })

  it('supports Cmd/Ctrl+Enter as a self-check shortcut', async () => {
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.keyDown(getSentenceInput(), { key: 'Enter', ctrlKey: true })

    expect(await screen.findByText(/this sentence is acceptable for study use/i)).toBeInTheDocument()
    expect(checkSentence).toHaveBeenCalledTimes(1)
  })

  it('calls markMastered when Mastered is clicked', async () => {
    mockRecords = {
      abandon: { acceptedAttempts: 2, lastCheckedSentence: '' },
      able: { acceptedAttempts: 2, lastCheckedSentence: '' },
    }
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /self-check/i }))
    await screen.findByText(/suggested:/i)
    fireEvent.click(screen.getByRole('button', { name: /mastered/i }))
    expect(mockMarkMastered).toHaveBeenCalledWith(shown.word)
  })

  it('calls setStatus learning when Again is clicked', async () => {
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /self-check/i }))
    await screen.findByText(/suggested:/i)
    fireEvent.click(screen.getByRole('button', { name: /again/i }))
    expect(mockSetStatus).toHaveBeenCalledWith(shown.word, 'learning')
  })

  it('advances to the next word after clicking Again', async () => {
    renderStudy()
    const first = MOCK_WORDS.find(w => screen.queryByText(w.word))
    const other = MOCK_WORDS.find(w => w.word !== first.word)
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${first.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /self-check/i }))
    await screen.findByText(/suggested:/i)
    fireEvent.click(screen.getByRole('button', { name: /again/i }))
    expect(screen.getByText(other.word)).toBeInTheDocument()
  })

  it('disables Self-check until the user writes a sentence containing the target word', () => {
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    const button = screen.getByRole('button', { name: /self-check/i })
    expect(button).toBeDisabled()

    fireEvent.change(getSentenceInput(), { target: { value: 'I can use this word.' } })
    expect(screen.getByText(new RegExp(`include the word "${shown.word}"`, 'i'))).toBeInTheDocument()
    expect(button).toBeDisabled()

    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    expect(button).not.toBeDisabled()
  })

  it('saves drafts while typing', () => {
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    expect(mockSaveDraft).toHaveBeenLastCalledWith(shown.word, `The word ${shown.word} is in this sentence.`)
  })

  it('shows an AI error when the check fails', async () => {
    vi.mocked(checkSentence).mockRejectedValueOnce(new Error('Network error'))
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /self-check/i }))
    expect(await screen.findByText(/ai feedback is temporarily unavailable/i)).toBeInTheDocument()
  })

  it('keeps Mastered disabled until enough acceptable checks are recorded', async () => {
    renderStudy()
    const shown = MOCK_WORDS.find(w => screen.queryByText(w.word))
    fireEvent.change(getSentenceInput(), { target: { value: `The word ${shown.word} is in this sentence.` } })
    fireEvent.click(screen.getByRole('button', { name: /self-check/i }))

    expect(await screen.findByText(/acceptable checks: 1\/3/i)).toBeInTheDocument()
    expect(screen.getByText(/complete 2 more acceptable self-check/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mastered/i })).toBeDisabled()
  })

  it('can open a specific word from the word bank link', () => {
    renderStudy(['/study?word=able'])
    expect(screen.getByText('able')).toBeInTheDocument()
    expect(screen.getByText(/studying this word from the word bank/i)).toBeInTheDocument()
  })
})
