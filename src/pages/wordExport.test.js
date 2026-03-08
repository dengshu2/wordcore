import { describe, expect, it } from 'vitest'
import { buildWordCsv, buildWordRecords } from './wordExport'

const WORDS = [
  { word: 'apple', pos: 'noun', definition: 'a fruit', example: 'I eat an apple every day.' },
  { word: 'run', pos: 'verb', definition: 'move fast', example: 'She runs every morning.' },
]

describe('buildWordRecords', () => {
  it('combines word data, progress, and drafts', () => {
    expect(
      buildWordRecords(WORDS, { apple: 'mastered' }, { run: 'I run after school.' })
    ).toEqual([
      {
        word: 'apple',
        pos: 'noun',
        definition: 'a fruit',
        reference_sentence: 'I eat an apple every day.',
        my_sentence: '',
        status: 'mastered',
      },
      {
        word: 'run',
        pos: 'verb',
        definition: 'move fast',
        reference_sentence: 'She runs every morning.',
        my_sentence: 'I run after school.',
        status: 'learning',
      },
    ])
  })
})

describe('buildWordCsv', () => {
  it('returns a CSV string with escaped values', () => {
    const csv = buildWordCsv(
      WORDS,
      { apple: 'mastered' },
      { apple: 'I said "apple", then ate it.' }
    )

    expect(csv).toContain('word,pos,definition,reference_sentence,my_sentence,status')
    expect(csv).toContain('"I said ""apple"", then ate it."')
  })
})
