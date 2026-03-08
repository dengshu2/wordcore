import { describe, expect, it } from 'vitest'
import { buildWordBank, normalizeWordEntry } from './normalizeWordEntry'

describe('normalizeWordEntry', () => {
  it('maps common articles to article', () => {
    expect(
      normalizeWordEntry({
        word: 'the',
        pos: 'adjective',
        definition: 'Used before a noun to specify it.',
        example: 'The sun is shining.',
      })
    ).toEqual({
      word: 'the',
      pos: 'article',
      definition: 'Used before a noun to specify it.',
      example: 'The sun is shining.',
    })
  })

  it('filters excluded words and unsupported parts of speech', () => {
    expect(
      normalizeWordEntry({
        word: 'davis',
        pos: 'proper noun',
        definition: 'A common surname.',
        example: 'Davis called yesterday.',
      })
    ).toBeNull()
  })
})

describe('buildWordBank', () => {
  it('deduplicates entries and keeps validated items only', () => {
    expect(
      buildWordBank([
        { word: 'both', pos: 'determiner', definition: 'Referring to two.', example: 'Both cats slept.' },
        { word: 'both', pos: 'determiner', definition: 'Duplicate.', example: 'Both dogs slept.' },
        { word: 'les', pos: 'determiner', definition: 'French article.', example: 'Les enfants jouent.' },
      ])
    ).toEqual([
      { word: 'both', pos: 'determiner', definition: 'Referring to two.', example: 'Both cats slept.' },
    ])
  })
})
