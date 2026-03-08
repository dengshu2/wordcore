import { readFileSync, writeFileSync } from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { normalizeWordEntry } from '../src/data/normalizeWordEntry.js'

// Load .env file manually (no dotenv dependency needed in Node 20+)
try {
  const envContent = readFileSync('.env', 'utf-8')
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=')
    if (key && !key.startsWith('#') && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim()
    }
  }
} catch { /* .env file is optional */ }

const API_KEY = process.env.GEMINI_API_KEY
if (!API_KEY || API_KEY === 'your_api_key_here') {
  console.error('Error: Set GEMINI_API_KEY in your .env file (see .env.example)')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const SAMPLE_COUNT = 3000
const CONCURRENCY = 15
const OUT_PATH = SAMPLE_COUNT <= 20 ? 'scripts/sample-words.json' : 'src/data/words.json'

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

async function processWord(word, index, total) {
  try {
    const data = await generateWordData(word)
    const normalized = normalizeWordEntry({ word, ...data })
    if (!normalized) {
      throw new Error('Entry failed validation')
    }
    process.stdout.write(`\r[${index + 1}/${total}] ${word.padEnd(20)} OK`)
    return normalized
  } catch (e) {
    process.stdout.write(`\r[${index + 1}/${total}] ${word.padEnd(20)} ERROR: ${e.message.slice(0, 40)}`)
    return { word, pos: '', definition: '', example: '' }
  }
}

async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length)
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

async function main() {
  const words = loadWords(SAMPLE_COUNT)
  console.log(`Generating ${words.length} words with concurrency=${CONCURRENCY}...`)

  const tasks = words.map((word, i) => () => processWord(word, i, words.length))
  const results = await runWithConcurrency(tasks, CONCURRENCY)

  console.log(`\nDone. Writing ${results.length} words to ${OUT_PATH}`)
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2))
  console.log('Saved.')

  const errors = results.filter(r => !r.pos || !r.definition || !r.example).length
  if (errors > 0) console.log(`Warning: ${errors} entries with empty fields.`)
}

main()
