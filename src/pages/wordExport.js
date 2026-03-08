function escapeCsv(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function getRecord(records, word) {
  return records[word] || {}
}

export function buildWordRecords(words, records) {
  return words.map(word => ({
    word: word.word,
    pos: word.pos,
    definition: word.definition,
    reference_sentence: word.example,
    my_sentence: getRecord(records, word.word).draft || '',
    status: getRecord(records, word.word).status === 'mastered' ? 'mastered' : 'learning',
    attempts: getRecord(records, word.word).attempts || 0,
    accepted_attempts: getRecord(records, word.word).acceptedAttempts || 0,
    updated_at: getRecord(records, word.word).updatedAt || '',
  }))
}

export function buildWordCsv(words, records) {
  const rowsData = buildWordRecords(words, records)
  const header = ['word', 'pos', 'definition', 'reference_sentence', 'my_sentence', 'status', 'attempts', 'accepted_attempts', 'updated_at']
  const rows = rowsData.map(record =>
    header.map(column => escapeCsv(record[column])).join(',')
  )

  return [header.join(','), ...rows].join('\n')
}
