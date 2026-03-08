import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_NAME = 'gemini-2.5-flash'

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim()
}

function getModel() {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({ model: MODEL_NAME })
}

export function normalizeSentenceCheckResult(payload) {
  return {
    is_acceptable: Boolean(payload?.is_acceptable),
    grammar_feedback: String(payload?.grammar_feedback || '').trim(),
    naturalness_feedback: String(payload?.naturalness_feedback || '').trim(),
    suggested_revision: String(payload?.suggested_revision || '').trim(),
  }
}

export function parseSentenceCheckResponse(text) {
  const json = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '')
  return normalizeSentenceCheckResult(JSON.parse(json))
}

export async function checkSentence({ word, definition, referenceSentence, userSentence }) {
  const model = getModel()

  const prompt = `You are checking a learner's English sentence for a vocabulary imitation exercise.

Target word: ${word}
Definition: ${definition}
Reference sentence: ${referenceSentence}
Learner sentence: ${userSentence}

Return JSON only with this exact shape:
{
  "is_acceptable": true,
  "grammar_feedback": "",
  "naturalness_feedback": "",
  "suggested_revision": ""
}

Rules:
- "is_acceptable" should be true if the learner sentence is grammatically acceptable and uses the target word naturally enough for study purposes.
- Keep feedback short and concrete.
- Only mention the biggest grammar issue if there is one.
- Only mention the biggest naturalness issue if there is one.
- "suggested_revision" should be a corrected or more natural sentence.
- Do not add markdown or extra commentary.`

  const result = await model.generateContent(prompt)
  return parseSentenceCheckResponse(result.response.text())
}
