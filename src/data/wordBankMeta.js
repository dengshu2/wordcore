// Derive WORD_BANK_SIZE from the actual processed word bank so this value
// never drifts out of sync with the words.json data source.
import wordBank from './wordBank'

export const WORD_BANK_SIZE = wordBank.length
