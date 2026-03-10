import { describe, expect, it } from 'vitest'
import { getNextWord, getEarliestReviewDate, includesTargetWord } from './studySession'

const WORDS = [
  { word: 'alpha' },
  { word: 'bravo' },
  { word: 'charlie' },
  { word: 'delta' },
]

describe('getNextWord', () => {
  it('prioritizes unseen words before learning and mastered words', () => {
    expect(
      getNextWord(WORDS, { alpha: 'learning', bravo: { status: 'mastered', nextReviewAt: new Date(0).toISOString() } }, [], null)
    ).toEqual({ word: 'charlie' })
  })

  it('avoids recently shown words when possible', () => {
    expect(
      getNextWord(WORDS, {}, ['alpha', 'bravo', 'charlie'], null)
    ).toEqual({ word: 'delta' })
  })

  it('prioritizes recently weak learning words ahead of other learning words', () => {
    expect(
      getNextWord(WORDS, {
        alpha: { status: 'learning', attempts: 1, feedback: { isAcceptable: false } },
        bravo: { status: 'learning', attempts: 1, feedback: { isAcceptable: true } },
      }, [], null)
    ).toEqual({ word: 'charlie' })
  })

  it('returns weak learning words before stable learning words when unseen words are exhausted', () => {
    expect(
      getNextWord(WORDS, {
        alpha: { status: 'learning', attempts: 2, feedback: { isAcceptable: false } },
        bravo: { status: 'learning', attempts: 3, feedback: { isAcceptable: true } },
        charlie: { status: 'mastered', nextReviewAt: new Date(Date.now() + 86400000).toISOString() },
        delta: { status: 'mastered', nextReviewAt: new Date(Date.now() + 86400000).toISOString() },
      }, [], null)
    ).toEqual({ word: 'alpha' })
  })

  it('falls back to review-due mastered words after unfinished queues are exhausted', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    expect(
      getNextWord(WORDS, {
        alpha: { status: 'mastered', nextReviewAt: pastDate },
        bravo: { status: 'mastered', nextReviewAt: pastDate },
        charlie: { status: 'mastered', nextReviewAt: pastDate },
        delta: { status: 'mastered', nextReviewAt: pastDate },
      }, ['alpha'], 'bravo')
    ).toEqual({ word: 'charlie' })
  })

  it('returns null when all mastered words are not yet due for review', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    expect(
      getNextWord(WORDS, {
        alpha: { status: 'mastered', nextReviewAt: futureDate },
        bravo: { status: 'mastered', nextReviewAt: futureDate },
        charlie: { status: 'mastered', nextReviewAt: futureDate },
        delta: { status: 'mastered', nextReviewAt: futureDate },
      }, [], null)
    ).toBeNull()
  })

  it('does not include mastered words without nextReviewAt in review queue', () => {
    expect(
      getNextWord(WORDS, {
        alpha: { status: 'mastered' },
        bravo: { status: 'mastered' },
        charlie: { status: 'mastered' },
        delta: { status: 'mastered' },
      }, [], null)
    ).toBeNull()
  })
})

describe('getEarliestReviewDate', () => {
  it('returns the earliest nextReviewAt among mastered words', () => {
    const early = new Date(Date.now() + 1000)
    const late = new Date(Date.now() + 86400000)
    const result = getEarliestReviewDate(WORDS, {
      alpha: { status: 'mastered', nextReviewAt: late.toISOString() },
      bravo: { status: 'mastered', nextReviewAt: early.toISOString() },
    })
    expect(result.getTime()).toBe(early.getTime())
  })

  it('returns null when no mastered words exist', () => {
    expect(getEarliestReviewDate(WORDS, {})).toBeNull()
  })
})

describe('includesTargetWord', () => {
  it('matches the target word case-insensitively', () => {
    expect(includesTargetWord('I can ABANDON that plan.', 'abandon')).toBe(true)
  })

  it('rejects sentences that do not contain the target word as a standalone word', () => {
    expect(includesTargetWord('She is able to do it.', 'ab')).toBe(false)
  })
})
