import { describe, expect, it } from 'vitest'
import { includesWord, splitByWord } from './wordForms'

describe('wordForms', () => {
  it('accepts regular and irregular inflections', () => {
    expect(includesWord('Prices dropped sharply this week.', 'drop')).toBe(true)
    expect(includesWord('She took the early train.', 'take')).toBe(true)
    expect(includesWord('Our memories of that trip are vivid.', 'memory')).toBe(true)
    expect(includesWord('He was late again.', 'be')).toBe(true)
  })

  it('uses merged forms from the word bank', () => {
    expect(includesWord('Them? I have not seen them.', 'they', ['them'])).toBe(true)
  })

  it('does not match unrelated words or bare substrings', () => {
    expect(includesWord('The weather was warm.', 'while')).toBe(false)
    expect(includesWord('It was a worthwhile trip.', 'while')).toBe(false)
  })

  it('splits text around every hit for highlighting', () => {
    expect(splitByWord('Take it while you take notes.', 'take')).toEqual([
      { text: 'Take', hit: true }, { text: ' it while you ', hit: false }, { text: 'take', hit: true }, { text: ' notes.', hit: false },
    ])
  })
})
