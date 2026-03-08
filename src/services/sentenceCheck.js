import { checkSentenceAPI } from './api'

export function normalizeSentenceCheckResult(payload) {
  return {
    is_acceptable: Boolean(payload?.is_acceptable),
    grammar_feedback: String(payload?.grammar_feedback || '').trim(),
    naturalness_feedback: String(payload?.naturalness_feedback || '').trim(),
    suggested_revision: String(payload?.suggested_revision || '').trim(),
  }
}

/**
 * Check a learner's sentence via the backend API (which calls OpenRouter).
 * Returns the same shape as before so existing consumers (Study.jsx) need no changes.
 */
export async function checkSentence({ word, definition, referenceSentence, userSentence }) {
  const result = await checkSentenceAPI({ word, definition, referenceSentence, userSentence })
  return normalizeSentenceCheckResult(result)
}
