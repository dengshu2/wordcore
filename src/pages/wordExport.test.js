import { describe, expect, it } from 'vitest'
import { buildWordCsv, buildWordRecords } from './wordExport'

const WORDS = [
  { word: 'apple', pos: 'noun', definition: 'a fruit', example: 'I eat an apple every day.' },
  { word: 'run', pos: 'verb', definition: 'move fast', example: 'She runs every morning.' },
]

describe('buildWordRecords', () => {
  it('combines word data and learning records', () => {
    expect(
      buildWordRecords(WORDS, {
        apple: {
          status: 'mastered',
          sentenceAttempts: [
            {
              sentence: 'I eat an apple every morning.',
              isAcceptable: true,
            },
          ],
        },
        run: { draft: 'I run after school.' },
      })
    ).toEqual([
      {
        word: 'apple',
        pos: 'noun',
        definition: 'a fruit',
        reference_sentence: 'I eat an apple every day.',
        my_sentence: '',
        accepted_sentences: 'I eat an apple every morning.',
        accepted_sentence_count: 1,
        status: 'mastered',
        attempts: 0,
        accepted_attempts: 0,
        updated_at: '',
      },
      {
        word: 'run',
        pos: 'verb',
        definition: 'move fast',
        reference_sentence: 'She runs every morning.',
        my_sentence: 'I run after school.',
        accepted_sentences: '',
        accepted_sentence_count: 0,
        status: 'learning',
        attempts: 0,
        accepted_attempts: 0,
        updated_at: '',
      },
    ])
  })
})

describe('buildWordCsv', () => {
  it('returns a CSV string with escaped values', () => {
    const csv = buildWordCsv(
      WORDS,
      {
        apple: {
          status: 'mastered',
          draft: 'I said "apple", then ate it.',
        },
      }
    )

    expect(csv).toContain('word,pos,definition,reference_sentence,my_sentence,accepted_sentences,accepted_sentence_count,status,attempts,accepted_attempts,updated_at')
    expect(csv).toContain('"I said ""apple"", then ate it."')
  })
})
