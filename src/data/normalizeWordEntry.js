const POS_OVERRIDES = {
  a: 'article',
  an: 'article',
  the: 'article',
  both: 'determiner',
}

const EXCLUDED_WORDS = new Set([
  'davis',
  'k',
  'las',
  'les',
  'mm',
  'mn',
  'na',
  'nm',
  'o',
])

export const ALLOWED_POS = new Set([
  'adjective',
  'adverb',
  'article',
  'conjunction',
  'determiner',
  'interjection',
  'noun',
  'preposition',
  'pronoun',
  'verb',
])

export function normalizeWordEntry(entry) {
  if (!entry || typeof entry.word !== 'string') return null

  const word = entry.word.trim().toLowerCase()
  const pos = (POS_OVERRIDES[word] || entry.pos || '').trim().toLowerCase()
  const definition = (entry.definition || '').trim()
  const example = (entry.example || '').trim()

  if (!word || !definition || !example) return null
  if (EXCLUDED_WORDS.has(word)) return null
  if (!ALLOWED_POS.has(pos)) return null

  return { word, pos, definition, example }
}

export function buildWordBank(entries) {
  const seen = new Set()

  return entries.flatMap(entry => {
    const normalized = normalizeWordEntry(entry)
    if (!normalized || seen.has(normalized.word)) return []
    seen.add(normalized.word)
    return [normalized]
  })
}
