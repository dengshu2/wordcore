import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import useProgress from './useProgress'

// Mock the API layer — useProgress now calls fetchRecords/upsertRecord
// instead of reading localStorage directly.
vi.mock('../services/api', () => ({
  getToken: vi.fn(() => 'mock-token'),
  fetchRecords: vi.fn(() => Promise.resolve({})),
  upsertRecord: vi.fn(() => Promise.resolve({})),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper: mount the hook and wait for the initial async fetchRecords effect
// to settle so we don't get "act() missing" warnings from React.
async function mountHook() {
  let result
  await act(async () => {
    const rendered = renderHook(() => useProgress())
    result = rendered.result
  })
  return result
}

describe('useProgress', () => {
  it('returns empty records initially', async () => {
    const result = await mountHook()
    expect(result.current.records).toEqual({})
  })

  it('marks a word as mastered', async () => {
    const result = await mountHook()
    act(() => result.current.setStatus('apple', 'mastered'))
    expect(result.current.records.apple.status).toBe('mastered')
  })

  it('marks a word as learning', async () => {
    const result = await mountHook()
    act(() => result.current.setStatus('apple', 'mastered'))
    act(() => result.current.setStatus('apple', 'learning'))
    expect(result.current.records.apple.status).toBe('learning')
  })

  it('counts mastered words correctly', async () => {
    const result = await mountHook()
    act(() => result.current.setStatus('apple', 'mastered'))
    act(() => result.current.setStatus('banana', 'mastered'))
    act(() => result.current.setStatus('cherry', 'learning'))
    expect(result.current.masteredCount).toBe(2)
  })

  it('persists drafts by word', async () => {
    const result = await mountHook()
    act(() => result.current.saveDraft('apple', 'I ate an apple today.'))
    expect(result.current.records.apple.draft).toBe('I ate an apple today.')
  })

  it('stores AI feedback with attempts', async () => {
    const result = await mountHook()
    act(() =>
      result.current.saveFeedback('apple', {
        is_acceptable: true,
        suggested_revision: 'I ate an apple after lunch.',
      }, 'I ate apple after lunch.')
    )

    expect(result.current.records.apple.lastCheckedSentence).toBe('I ate apple after lunch.')
    expect(result.current.records.apple.feedback.isAcceptable).toBe(true)
    expect(result.current.records.apple.feedback.suggestedRevision).toBe('I ate an apple after lunch.')
    expect(result.current.records.apple.attempts).toBe(1)
    expect(result.current.records.apple.acceptedAttempts).toBe(1)
  })

  it('returns a stable object shape for new words', async () => {
    const result = await mountHook()
    act(() => result.current.setStatus('pear', 'new'))
    const record = result.current.records.pear
    expect(record).toMatchObject({
      status: 'new',
      draft: '',
      attempts: 0,
      acceptedAttempts: 0,
    })
  })
})
