import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import useProgress from './useProgress'

beforeEach(() => localStorage.clear())

describe('useProgress', () => {
  it('returns empty records initially', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.records).toEqual({})
  })

  it('marks a word as mastered', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    expect(result.current.records.apple.status).toBe('mastered')
  })

  it('marks a word as learning', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    act(() => result.current.setStatus('apple', 'learning'))
    expect(result.current.records.apple.status).toBe('learning')
  })

  it('persists records to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    const stored = JSON.parse(localStorage.getItem('wordcore-records'))
    expect(stored.apple.status).toBe('mastered')
  })

  it('loads existing records from localStorage on mount', () => {
    localStorage.setItem('wordcore-records', JSON.stringify({ banana: { status: 'mastered' } }))
    const { result } = renderHook(() => useProgress())
    expect(result.current.records.banana.status).toBe('mastered')
  })

  it('counts mastered words correctly', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    act(() => result.current.setStatus('banana', 'mastered'))
    act(() => result.current.setStatus('cherry', 'learning'))
    expect(result.current.masteredCount).toBe(2)
  })

  it('persists drafts by word', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.saveDraft('apple', 'I ate an apple today.'))
    expect(result.current.records.apple.draft).toBe('I ate an apple today.')
    expect(JSON.parse(localStorage.getItem('wordcore-records')).apple.draft).toBe('I ate an apple today.')
  })

  it('loads legacy progress and drafts into records on mount', () => {
    localStorage.setItem('wordcore-progress', JSON.stringify({ banana: 'mastered' }))
    localStorage.setItem('wordcore-drafts', JSON.stringify({ apple: 'Saved sentence.' }))
    const { result } = renderHook(() => useProgress())
    expect(result.current.records.apple.draft).toBe('Saved sentence.')
    expect(result.current.records.apple.status).toBe('learning')
    expect(result.current.records.banana.status).toBe('mastered')
  })

  it('stores AI feedback with attempts', () => {
    const { result } = renderHook(() => useProgress())
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
})
