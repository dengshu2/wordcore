import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Study from './Study'
import { checkSentence } from '../services/sentenceCheck'

const CARD = {
  word: 'drop', ipa: '/drɑːp/', syllables: ['drop'], stress: 0, level: 'A2',
  senses: [{
    pos: 'verb', definition: 'to let something fall', pattern: 'drop sth',
    examples: [
      { text: 'I dropped my keys on the way home.', context: 'daily life' },
      { text: 'Please do not drop the glass bowl.', context: 'at home' },
    ],
    collocations: ['drop your keys'],
  }],
  visual: { kind: 'none' },
  prompts: { question: 'What did you last drop by accident?', starter: 'When prices drop, I...', rewrite_source: 'I let my phone fall.' },
  audio: { word: { text: 'drop', kind: 'word', url: '/audio/a.mp3', ready: true }, examples: [] },
}

vi.mock('../context/ContentContext', () => ({
  useContent: () => ({ words: [{ word: 'drop', display: 'drop', ready: true, forms: [] }], status: 'idle' }),
  useCard: () => ({ card: CARD, error: null }),
}))
vi.mock('../services/sentenceCheck', () => ({ checkSentence: vi.fn() }))
vi.mock('../services/audio', () => ({ play: vi.fn(), stop: vi.fn(), onPlayingChange: () => () => {} }))

const progress = {
  saveDraft: vi.fn(), saveFeedback: vi.fn(), setStatus: vi.fn(), markMastered: vi.fn(),
  confirmReview: vi.fn(), resetToLearning: vi.fn(),
}
let mockRecords = {}
vi.mock('../context/ProgressContext', () => ({
  useProgressContext: () => ({ records: mockRecords, syncState: 'idle', masteredCount: 5, ...progress }),
}))

function renderStudy() {
  return render(<MemoryRouter initialEntries={['/study']}><Study /></MemoryRouter>)
}

function type(value) {
  fireEvent.change(screen.getByLabelText('Your sentence'), { target: { value } })
}

describe('Study', () => {
  beforeEach(() => {
    mockRecords = {}
    vi.clearAllMocks()
  })

  it('shows one meaning and one example at a time', () => {
    renderStudy()
    expect(screen.getByRole('heading', { name: 'drop' })).toBeInTheDocument()
    expect(screen.getByText('to let something fall')).toBeInTheDocument()
    expect(screen.getByText('dropped').tagName).toBe('MARK')
    expect(screen.queryByText(/do not/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Another example' }))
    expect(screen.getByText(/do not/)).toBeInTheDocument()
  })

  it('only sends a sentence that uses the word, inflections included', () => {
    renderStudy()
    const send = screen.getByRole('button', { name: 'Check my sentence' })
    type('I lost my keys yesterday.')
    expect(send).toBeDisabled()
    expect(screen.getByText('Include “drop” to check your sentence')).toBeInTheDocument()
    type('Prices dropped a lot this month.')
    expect(send).toBeEnabled()
  })

  it('checks the sentence against the shown meaning and saves the result', async () => {
    checkSentence.mockResolvedValue({ is_acceptable: true, grammar_feedback: '', naturalness_feedback: 'Natural use.', suggested_revision: '' })
    renderStudy()
    type('Prices dropped a lot this month.')
    fireEvent.click(screen.getByRole('button', { name: 'Check my sentence' }))
    expect(screen.getByLabelText('Checking')).toBeInTheDocument()
    await waitFor(() => expect(progress.saveFeedback).toHaveBeenCalled())
    expect(checkSentence).toHaveBeenCalledWith({
      word: 'drop', definition: 'to let something fall',
      referenceSentence: 'I dropped my keys on the way home.', userSentence: 'Prices dropped a lot this month.',
    })
    expect(progress.saveFeedback.mock.calls[0][0]).toBe('drop')
  })

  it('shows saved sentences as a conversation', () => {
    mockRecords = {
      drop: {
        status: 'learning', acceptedAttempts: 1,
        sentenceAttempts: [
          { sentence: 'I drop the kids at school.', normalizedSentence: 'i drop the kids at school.', isAcceptable: true, feedbackNaturalness: 'Good everyday use.', createdAt: '2026-09-01T10:00:00Z' },
          { sentence: 'I dropping it.', normalizedSentence: 'i dropping it.', isAcceptable: false, feedbackGrammar: 'Use a past or present form.', feedbackRevision: 'I dropped it.', createdAt: '2026-09-01T09:00:00Z' },
        ],
      },
    }
    renderStudy()
    const bubbles = screen.getAllByText(/I drop/).map(el => el.textContent)
    expect(bubbles[0]).toBe('I dropping it.') // oldest first
    expect(screen.getByText('Use a past or present form.')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 accepted')).toBeInTheDocument()
  })

  it('turns a writing idea into a prompt and prefills a starter', () => {
    renderStudy()
    fireEvent.click(screen.getByRole('button', { name: 'Finish a sentence' }))
    expect(screen.getByText('When prices drop, I...')).toBeInTheDocument()
    expect(screen.getByLabelText('Your sentence')).toHaveValue('When prices drop, I ')
  })

  it('does not re-check a sentence that was already accepted', () => {
    mockRecords = {
      drop: { status: 'learning', acceptedAttempts: 1, sentenceAttempts: [{ sentence: 'Prices dropped a lot.', normalizedSentence: 'prices dropped a lot.', isAcceptable: true, createdAt: '2026-09-01T10:00:00Z' }] },
    }
    renderStudy()
    type('Prices dropped   a lot.')
    fireEvent.click(screen.getByRole('button', { name: 'Check my sentence' }))
    expect(checkSentence).not.toHaveBeenCalled()
    expect(screen.getByText('You already used this sentence. Write a new one to make progress.')).toBeInTheDocument()
  })

  it('offers mastery once three sentences are accepted', async () => {
    mockRecords = { drop: { status: 'learning', acceptedAttempts: 3, feedback: { isAcceptable: true }, sentenceAttempts: [] } }
    renderStudy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as mastered' })))
    expect(progress.markMastered).toHaveBeenCalledWith('drop')
  })
})
