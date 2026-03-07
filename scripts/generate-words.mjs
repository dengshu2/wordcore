import { readFileSync, writeFileSync, existsSync } from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = 'REDACTED_API_KEY'
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const SAMPLE_COUNT = 20  // Change to 3000 for full run

function loadWords(count) {
  const text = readFileSync('scripts/wordlist.txt', 'utf-8')
  return text.split('\n').filter(w => w.trim()).slice(0, count)
}

async function generateWordData(word) {
  const prompt = `For the English word "${word}", provide:
1. pos: the part of speech (noun/verb/adjective/adverb/preposition/conjunction/pronoun — pick one)
2. definition: a short, clear English definition (one sentence, max 10 words)
3. example: a simple everyday example sentence using this word (max 12 words, very natural and common)

Respond ONLY with valid JSON, no extra text:
{"pos": "...", "definition": "...", "example": "..."}`

  const result = await model.generateContent(prompt)
  const text = result.response.text().trim()
  const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(json)
}

async function main() {
  const words = loadWords(SAMPLE_COUNT)
  const results = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    process.stdout.write(`[${i + 1}/${words.length}] ${word}... `)
    try {
      const data = await generateWordData(word)
      results.push({ word, ...data })
      console.log('OK')
    } catch (e) {
      console.log(`ERROR: ${e.message}`)
      results.push({ word, pos: '', definition: '', example: '' })
    }
    await new Promise(r => setTimeout(r, 300))
  }

  const outPath = SAMPLE_COUNT <= 20 ? 'scripts/sample-words.json' : 'src/data/words.json'
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nDone. Saved ${results.length} words to ${outPath}`)
}

main()
