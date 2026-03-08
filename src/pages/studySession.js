const RECENT_WORD_LIMIT = 5

function getWordStatus(recordsOrProgress, word) {
  const value = recordsOrProgress[word]
  if (value && typeof value === 'object') {
    return value.status
  }
  return value
}

function getWordRecord(recordsOrProgress, word) {
  const value = recordsOrProgress[word]
  if (value && typeof value === 'object') {
    return value
  }
  return { status: value }
}

function isWeakLearningWord(record) {
  return record.status === 'learning' && record.attempts > 0 && !record.feedback?.isAcceptable
}

function isActiveLearningWord(record) {
  return record.status === 'learning' && !isWeakLearningWord(record)
}

function pickFirstEligible(pool, recentWords) {
  const recentSet = new Set(recentWords.slice(-RECENT_WORD_LIMIT))
  return pool.find(word => !recentSet.has(word.word)) || pool[0] || null
}

export function getNextWord(words, recordsOrProgress, recentWords = [], excludeWord = null) {
  const eligibleWords = words.filter(word => word.word !== excludeWord)
  if (eligibleWords.length === 0) return words[0] || null

  const unseen = eligibleWords.filter(word => getWordStatus(recordsOrProgress, word.word) == null || getWordStatus(recordsOrProgress, word.word) === 'new')
  const weakLearning = eligibleWords.filter(word => isWeakLearningWord(getWordRecord(recordsOrProgress, word.word)))
  const learning = eligibleWords.filter(word => isActiveLearningWord(getWordRecord(recordsOrProgress, word.word)))
  const review = eligibleWords.filter(word => getWordStatus(recordsOrProgress, word.word) === 'mastered')

  return (
    pickFirstEligible(unseen, recentWords) ||
    pickFirstEligible(weakLearning, recentWords) ||
    pickFirstEligible(learning, recentWords) ||
    pickFirstEligible(review, recentWords) ||
    eligibleWords[0]
  )
}

export function includesTargetWord(sentence, targetWord) {
  if (!sentence.trim() || !targetWord) return false

  const escapedTarget = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\b${escapedTarget}\\b`, 'i')
  return pattern.test(sentence)
}
