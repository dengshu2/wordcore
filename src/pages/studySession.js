const RECENT_WORD_LIMIT = 5

function pickFirstEligible(pool, recentWords) {
  const recentSet = new Set(recentWords.slice(-RECENT_WORD_LIMIT))
  return pool.find(word => !recentSet.has(word.word)) || pool[0] || null
}

export function getNextWord(words, progress, recentWords = [], excludeWord = null) {
  const eligibleWords = words.filter(word => word.word !== excludeWord)
  if (eligibleWords.length === 0) return words[0] || null

  const unseen = eligibleWords.filter(word => progress[word.word] == null)
  const learning = eligibleWords.filter(word => progress[word.word] === 'learning')
  const review = eligibleWords.filter(word => progress[word.word] === 'mastered')

  return (
    pickFirstEligible(unseen, recentWords) ||
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
