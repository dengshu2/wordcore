function escapeCsv(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function buildWordRecords(words, progress, drafts) {
  return words.map(word => ({
    word: word.word,
    pos: word.pos,
    definition: word.definition,
    reference_sentence: word.example,
    my_sentence: drafts[word.word] || '',
    status: progress[word.word] === 'mastered' ? 'mastered' : 'learning',
  }))
}

export function buildWordCsv(words, progress, drafts) {
  const records = buildWordRecords(words, progress, drafts)
  const header = ['word', 'pos', 'definition', 'reference_sentence', 'my_sentence', 'status']
  const rows = records.map(record =>
    header.map(column => escapeCsv(record[column])).join(',')
  )

  return [header.join(','), ...rows].join('\n')
}
