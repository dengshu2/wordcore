import { describe, expect, it } from 'vitest'
import { normalizeSentenceCheckResult, parseSentenceCheckResponse } from './sentenceCheck'

describe('normalizeSentenceCheckResult', () => {
  it('returns a stable object shape', () => {
    expect(normalizeSentenceCheckResult({ is_acceptable: 1, grammar_feedback: null })).toEqual({
      is_acceptable: true,
      grammar_feedback: '',
      naturalness_feedback: '',
      suggested_revision: '',
    })
  })
})

describe('parseSentenceCheckResponse', () => {
  it('parses fenced JSON responses', () => {
    expect(
      parseSentenceCheckResponse(`\`\`\`json
{"is_acceptable":false,"grammar_feedback":"Missing article.","naturalness_feedback":"","suggested_revision":"I am going to a store."}
\`\`\``)
    ).toEqual({
      is_acceptable: false,
      grammar_feedback: 'Missing article.',
      naturalness_feedback: '',
      suggested_revision: 'I am going to a store.',
    })
  })
})
