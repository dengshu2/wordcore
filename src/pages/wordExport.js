function escapeCsv(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const HEADER = ['word', 'level', 'status', 'my_sentence', 'accepted_sentences', 'accepted_sentence_count', 'attempts', 'accepted_attempts', 'updated_at']

export function buildWordRecords(words, records) {
  return words.map(w => {
    const r = records[w.word] || {}
    const accepted = (r.sentenceAttempts || []).filter(a => a.isAcceptable).map(a => a.sentence)
    return {
      word: w.display || w.word,
      level: w.level || '',
      status: r.status || 'new',
      my_sentence: r.draft || '',
      accepted_sentences: accepted.join(' | '),
      accepted_sentence_count: accepted.length,
      attempts: r.attempts || 0,
      accepted_attempts: r.acceptedAttempts || 0,
      updated_at: r.updatedAt || '',
    }
  })
}

export function buildWordCsv(words, records) {
  const rows = buildWordRecords(words, records).map(row => HEADER.map(col => escapeCsv(row[col])).join(','))
  return [HEADER.join(','), ...rows].join('\n')
}
