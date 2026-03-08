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
