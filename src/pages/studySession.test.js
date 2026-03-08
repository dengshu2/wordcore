import { describe, expect, it } from 'vitest'
import { getNextWord, includesTargetWord } from './studySession'

const WORDS = [
  { word: 'alpha' },
  { word: 'bravo' },
  { word: 'charlie' },
  { word: 'delta' },
]

describe('getNextWord', () => {
  it('prioritizes unseen words before learning and mastered words', () => {
    expect(
      getNextWord(WORDS, { alpha: 'learning', bravo: 'mastered' }, [], null)
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
        charlie: { status: 'mastered' },
        delta: { status: 'mastered' },
      }, [], null)
    ).toEqual({ word: 'alpha' })
  })

  it('falls back to mastered words after unfinished queues are exhausted', () => {
    expect(
      getNextWord(WORDS, {
        alpha: 'mastered',
        bravo: 'mastered',
        charlie: 'mastered',
        delta: 'mastered',
      }, ['alpha'], 'bravo')
    ).toEqual({ word: 'charlie' })
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
