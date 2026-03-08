import rawWords from './words.json'
import { buildWordBank } from './normalizeWordEntry.js'

const wordBank = buildWordBank(rawWords)

export default wordBank
