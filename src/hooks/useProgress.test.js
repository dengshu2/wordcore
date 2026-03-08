import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import useProgress from './useProgress'

beforeEach(() => localStorage.clear())

describe('useProgress', () => {
  it('returns empty progress initially', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.progress).toEqual({})
  })

  it('marks a word as mastered', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    expect(result.current.progress['apple']).toBe('mastered')
  })

  it('marks a word as learning', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    act(() => result.current.setStatus('apple', 'learning'))
    expect(result.current.progress['apple']).toBe('learning')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    const stored = JSON.parse(localStorage.getItem('wordcore-progress'))
    expect(stored['apple']).toBe('mastered')
  })

  it('loads existing progress from localStorage on mount', () => {
    localStorage.setItem('wordcore-progress', JSON.stringify({ banana: 'mastered' }))
    const { result } = renderHook(() => useProgress())
    expect(result.current.progress['banana']).toBe('mastered')
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
    expect(result.current.drafts.apple).toBe('I ate an apple today.')
    expect(JSON.parse(localStorage.getItem('wordcore-drafts')).apple).toBe('I ate an apple today.')
  })

  it('loads existing drafts from localStorage on mount', () => {
    localStorage.setItem('wordcore-drafts', JSON.stringify({ apple: 'Saved sentence.' }))
    const { result } = renderHook(() => useProgress())
    expect(result.current.drafts.apple).toBe('Saved sentence.')
  })
})
