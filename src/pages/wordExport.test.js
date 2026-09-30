import { describe, expect, it } from 'vitest'
import { buildWordCsv, buildWordRecords } from './wordExport'

const WORDS = [
  { word: 'apple', display: 'apple', level: 'A1' },
  { word: 'january', display: 'January', level: 'A1' },
]

describe('wordExport', () => {
  it('combines word entries with learning records', () => {
    const rows = buildWordRecords(WORDS, {
      apple: { status: 'mastered', attempts: 3, acceptedAttempts: 3, sentenceAttempts: [{ sentence: 'I eat an apple every morning.', isAcceptable: true }] },
      january: { status: 'learning', draft: 'January is cold.' },
    })
    expect(rows[0]).toMatchObject({ word: 'apple', status: 'mastered', accepted_sentences: 'I eat an apple every morning.', accepted_sentence_count: 1 })
    expect(rows[1]).toMatchObject({ word: 'January', status: 'learning', my_sentence: 'January is cold.', accepted_sentence_count: 0 })
  })

  it('escapes commas and quotes in CSV cells', () => {
    const csv = buildWordCsv([{ word: 'say', display: 'say' }], { say: { draft: 'She said, "hi".' } })
    expect(csv.split('\n')[1]).toContain('"She said, ""hi""."')
  })
})
