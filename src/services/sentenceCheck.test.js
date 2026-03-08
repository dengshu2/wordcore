import { describe, expect, it } from 'vitest'
import { normalizeSentenceCheckResult } from './sentenceCheck'

// Note: parseSentenceCheckResponse was moved to the Go backend (openrouter.go).
// The frontend no longer needs to parse raw model output — the backend returns clean JSON.

describe('normalizeSentenceCheckResult', () => {
  it('returns a stable object shape', () => {
    expect(normalizeSentenceCheckResult({ is_acceptable: 1, grammar_feedback: null })).toEqual({
      is_acceptable: true,
      grammar_feedback: '',
      naturalness_feedback: '',
      suggested_revision: '',
    })
  })

  it('coerces is_acceptable to boolean', () => {
    expect(normalizeSentenceCheckResult({ is_acceptable: false }).is_acceptable).toBe(false)
    expect(normalizeSentenceCheckResult({ is_acceptable: true }).is_acceptable).toBe(true)
  })

  it('trims whitespace from string fields', () => {
    const result = normalizeSentenceCheckResult({
      is_acceptable: true,
      grammar_feedback: '  ok  ',
      naturalness_feedback: ' sounds good ',
      suggested_revision: ' Try this. ',
    })
    expect(result.grammar_feedback).toBe('ok')
    expect(result.naturalness_feedback).toBe('sounds good')
    expect(result.suggested_revision).toBe('Try this.')
  })

  it('handles missing fields gracefully', () => {
    expect(normalizeSentenceCheckResult({})).toEqual({
      is_acceptable: false,
      grammar_feedback: '',
      naturalness_feedback: '',
      suggested_revision: '',
    })
  })
})
