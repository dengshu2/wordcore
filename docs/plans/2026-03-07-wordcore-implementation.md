# WordCore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first English vocabulary practice web app where users write example sentences and compare them to references.

**Architecture:** Vite + React SPA, all data from a static `words.json` (3000 words), progress stored in localStorage. Offline capable, no backend.

**Tech Stack:** Vite, React, React Router v6, Tailwind CSS, Vitest + React Testing Library

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`

**Step 1: Initialize Vite + React project**

```bash
cd /Users/dengshu/development/wordcore
npm create vite@latest . -- --template react
```

When prompted "Current directory is not empty. Remove existing files and continue?" — select `Ignore files and continue`.

**Step 2: Install dependencies**

```bash
npm install
npm install react-router-dom
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 3: Configure Tailwind**

Update `vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
```

Create `src/index.css`:
```css
@import "tailwindcss";
```

Create `src/test/setup.js`:
```js
import '@testing-library/jest-dom'
```

**Step 4: Set up routing in `src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Study from './pages/Study'
import WordList from './pages/WordList'
import Nav from './components/Nav'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/study" element={<Study />} />
          <Route path="/words" element={<WordList />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Nav />
      </div>
    </BrowserRouter>
  )
}
```

Update `src/main.jsx`:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

Create stub pages (replace in later tasks):
- `src/pages/Home.jsx` → `export default function Home() { return <div>Home</div> }`
- `src/pages/Study.jsx` → `export default function Study() { return <div>Study</div> }`
- `src/pages/WordList.jsx` → `export default function WordList() { return <div>Words</div> }`
- `src/components/Nav.jsx` → `export default function Nav() { return <nav>Nav</nav> }`

Create `src/data/` directory (empty for now):
```bash
mkdir -p src/data
```

**Step 5: Verify app runs**

```bash
npm run dev
```

Expected: App runs at http://localhost:5173 with no errors.

**Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Vite + React + Tailwind + Router project"
```

---

## Task 2: Data Generation Script — Sample (20 words)

**Files:**
- Create: `scripts/generate-words.mjs`
- Create: `scripts/wordlist.txt` (fetched from GitHub)

**Step 1: Fetch the word list**

```bash
mkdir -p scripts
curl -o scripts/wordlist.txt https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt
```

Verify it downloaded:
```bash
wc -l scripts/wordlist.txt
```
Expected: ~9000+ lines.

**Step 2: Create the generation script**

Create `scripts/generate-words.mjs`:

```js
import { readFileSync, writeFileSync } from 'fs'
import { GoogleGenerativeAI } from '@google/generative-ai'

const API_KEY = 'REDACTED_API_KEY'
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

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
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300))
  }

  const outPath = SAMPLE_COUNT <= 20 ? 'scripts/sample-words.json' : 'src/data/words.json'
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nDone. Saved ${results.length} words to ${outPath}`)
}

main()
```

**Step 3: Install Gemini SDK**

```bash
npm install @google/generative-ai
```

**Step 4: Run the sample generation**

```bash
node scripts/generate-words.mjs
```

Expected output: 20 words processed, `scripts/sample-words.json` created.

**Step 5: Review sample output**

```bash
cat scripts/sample-words.json
```

Review with user: Are the definitions short and clear? Are the example sentences simple and everyday? Adjust the prompt if needed before proceeding to full run.

**Step 6: Commit script**

```bash
git add scripts/
git commit -m "feat: add word data generation script using Gemini API"
```

---

## Task 3: Data Generation — Full 3000 Words

> Only proceed after sample review is approved.

**Step 1: Update SAMPLE_COUNT in script**

In `scripts/generate-words.mjs`, change line:
```js
const SAMPLE_COUNT = 20  // Change to 3000 for full run
```
to:
```js
const SAMPLE_COUNT = 3000
```

**Step 2: Run full generation**

```bash
node scripts/generate-words.mjs
```

Expected: ~3000 words processed, `src/data/words.json` created. This will take ~20-30 minutes due to rate limiting delays.

**Step 3: Verify output**

```bash
node -e "const w = require('./src/data/words.json'); console.log('Count:', w.length); console.log('Sample:', JSON.stringify(w.slice(0,3), null, 2))"
```

Expected: Count: 3000 (or close), valid entries.

**Step 4: Commit data**

```bash
git add src/data/words.json
git commit -m "feat: add 3000-word dataset with POS, definitions, and example sentences"
```

---

## Task 4: useProgress Hook

**Files:**
- Create: `src/hooks/useProgress.js`
- Create: `src/hooks/useProgress.test.js`

**Step 1: Write failing tests**

Create `src/hooks/useProgress.test.js`:
```js
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import useProgress from './useProgress'

beforeEach(() => localStorage.clear())

describe('useProgress', () => {
  it('returns empty progress initially', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.progress).toEqual({})
  })

  it('marks a word as mastered', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    expect(result.current.progress['apple']).toBe('mastered')
  })

  it('marks a word as learning', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    act(() => result.current.setStatus('apple', 'learning'))
    expect(result.current.progress['apple']).toBe('learning')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    const stored = JSON.parse(localStorage.getItem('wordcore-progress'))
    expect(stored['apple']).toBe('mastered')
  })

  it('loads existing progress from localStorage on mount', () => {
    localStorage.setItem('wordcore-progress', JSON.stringify({ banana: 'mastered' }))
    const { result } = renderHook(() => useProgress())
    expect(result.current.progress['banana']).toBe('mastered')
  })

  it('counts mastered words correctly', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setStatus('apple', 'mastered'))
    act(() => result.current.setStatus('banana', 'mastered'))
    act(() => result.current.setStatus('cherry', 'learning'))
    expect(result.current.masteredCount).toBe(2)
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/useProgress.test.js
```

Expected: FAIL — module not found.

**Step 3: Implement the hook**

Create `src/hooks/useProgress.js`:
```js
import { useState, useEffect, useMemo } from 'react'

const STORAGE_KEY = 'wordcore-progress'

export default function useProgress() {
  const [progress, setProgress] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  const setStatus = (word, status) => {
    setProgress(prev => ({ ...prev, [word]: status }))
  }

  const masteredCount = useMemo(
    () => Object.values(progress).filter(s => s === 'mastered').length,
    [progress]
  )

  return { progress, setStatus, masteredCount }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/useProgress.test.js
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useProgress hook with localStorage persistence"
```

---

## Task 5: Bottom Navigation

**Files:**
- Create: `src/components/Nav.jsx`
- Create: `src/components/Nav.test.jsx`

**Step 1: Write failing test**

Create `src/components/Nav.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Nav from './Nav'

function renderNav(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Nav />
    </MemoryRouter>
  )
}

describe('Nav', () => {
  it('renders three navigation links', () => {
    renderNav()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Study')).toBeInTheDocument()
    expect(screen.getByText('Words')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/Nav.test.jsx
```

Expected: FAIL.

**Step 3: Implement Nav**

Replace `src/components/Nav.jsx`:
```jsx
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/study', label: 'Study', icon: '📖' },
  { to: '/words', label: 'Words', icon: '📋' },
]

export default function Nav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-xs ${
              isActive ? 'text-blue-600' : 'text-gray-500'
            }`
          }
        >
          <span className="text-xl">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/Nav.test.jsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/Nav.jsx src/components/Nav.test.jsx
git commit -m "feat: add bottom navigation bar"
```

---

## Task 6: Home Page

**Files:**
- Modify: `src/pages/Home.jsx`
- Create: `src/pages/Home.test.jsx`

**Step 1: Write failing tests**

Create `src/pages/Home.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Home from './Home'

vi.mock('../hooks/useProgress', () => ({
  default: () => ({ masteredCount: 42, progress: {} })
}))

vi.mock('../data/words.json', () => ({
  default: Array(3000).fill({ word: 'test', pos: 'noun', definition: 'a test', example: 'This is a test.' })
}))

describe('Home', () => {
  it('shows mastered count and total', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByText(/42/)).toBeInTheDocument()
    expect(screen.getByText(/3000/)).toBeInTheDocument()
  })

  it('has a Start Practice link', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /start practice/i })).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/pages/Home.test.jsx
```

**Step 3: Implement Home page**

Replace `src/pages/Home.jsx`:
```jsx
import { Link } from 'react-router-dom'
import useProgress from '../hooks/useProgress'
import words from '../data/words.json'

const TOTAL = words.length

export default function Home() {
  const { masteredCount } = useProgress()
  const pct = Math.round((masteredCount / TOTAL) * 100)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
      <h1 className="text-3xl font-bold tracking-tight">WordCore</h1>

      <div className="text-center">
        <div className="text-6xl font-bold text-blue-600">{masteredCount}</div>
        <div className="text-gray-500 mt-1">of {TOTAL} mastered</div>
      </div>

      <div className="w-full max-w-sm bg-gray-200 rounded-full h-3">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <Link
        to="/study"
        className="w-full max-w-sm text-center bg-blue-600 text-white py-4 rounded-2xl text-lg font-semibold"
      >
        Start Practice
      </Link>
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/pages/Home.test.jsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/pages/Home.jsx src/pages/Home.test.jsx
git commit -m "feat: implement Home page with progress display"
```

---

## Task 7: Study Page

**Files:**
- Modify: `src/pages/Study.jsx`
- Create: `src/pages/Study.test.jsx`

**Step 1: Write failing tests**

Create `src/pages/Study.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Study from './Study'

const mockWords = [
  { word: 'abandon', pos: 'verb', definition: 'to leave something permanently', example: 'She had to abandon her car in the snow.' },
  { word: 'able', pos: 'adjective', definition: 'having the skill to do something', example: 'He was able to fix the car himself.' },
]

vi.mock('../data/words.json', () => ({ default: mockWords }))

const mockSetStatus = vi.fn()
vi.mock('../hooks/useProgress', () => ({
  default: () => ({ progress: {}, setStatus: mockSetStatus, masteredCount: 0 })
}))

describe('Study', () => {
  beforeEach(() => mockSetStatus.mockClear())

  it('shows the word and definition', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    expect(screen.getByText('abandon')).toBeInTheDocument()
    expect(screen.getByText(/verb/i)).toBeInTheDocument()
    expect(screen.getByText(/to leave something permanently/i)).toBeInTheDocument()
  })

  it('hides example sentence initially', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    expect(screen.queryByText(/She had to abandon/)).not.toBeInTheDocument()
  })

  it('reveals example after clicking Compare', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    expect(screen.getByText(/She had to abandon/)).toBeInTheDocument()
  })

  it('calls setStatus mastered when Mastered is clicked', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    fireEvent.click(screen.getByRole('button', { name: /mastered/i }))
    expect(mockSetStatus).toHaveBeenCalledWith('abandon', 'mastered')
  })

  it('calls setStatus learning when Again is clicked', () => {
    render(<MemoryRouter><Study /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /compare/i }))
    fireEvent.click(screen.getByRole('button', { name: /again/i }))
    expect(mockSetStatus).toHaveBeenCalledWith('abandon', 'learning')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/pages/Study.test.jsx
```

**Step 3: Implement Study page**

Replace `src/pages/Study.jsx`:
```jsx
import { useState, useMemo } from 'react'
import words from '../data/words.json'
import useProgress from '../hooks/useProgress'

function getNextWord(words, progress) {
  const learning = words.filter(w => progress[w.word] !== 'mastered')
  if (learning.length === 0) return words[Math.floor(Math.random() * words.length)]
  return learning[Math.floor(Math.random() * learning.length)]
}

export default function Study() {
  const { progress, setStatus } = useProgress()
  const [current, setCurrent] = useState(() => getNextWord(words, progress))
  const [sentence, setSentence] = useState('')
  const [revealed, setRevealed] = useState(false)

  function handleCompare() {
    setRevealed(true)
  }

  function handleNext(status) {
    setStatus(current.word, status)
    setCurrent(getNextWord(words, { ...progress, [current.word]: status }))
    setSentence('')
    setRevealed(false)
  }

  return (
    <div className="flex flex-col min-h-screen px-6 py-8 gap-6 max-w-lg mx-auto">
      {/* Word card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-2">
        <div className="text-4xl font-bold">{current.word}</div>
        <div className="text-gray-500 text-sm">{current.pos} · {current.definition}</div>
      </div>

      {/* Sentence input */}
      <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col gap-4">
        <label className="text-sm font-medium text-gray-600">Write your sentence:</label>
        <textarea
          className="w-full border border-gray-200 rounded-xl p-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={sentence}
          onChange={e => setSentence(e.target.value)}
          placeholder="Type a sentence using this word..."
          disabled={revealed}
        />
        {!revealed && (
          <button
            onClick={handleCompare}
            className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold"
          >
            Compare
          </button>
        )}
      </div>

      {/* Reference sentence */}
      {revealed && (
        <div className="bg-blue-50 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <div className="text-sm font-medium text-blue-600">Reference sentence:</div>
          <div className="text-base">{current.example}</div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => handleNext('learning')}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold"
            >
              Again
            </button>
            <button
              onClick={() => handleNext('mastered')}
              className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold"
            >
              Mastered
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/pages/Study.test.jsx
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/pages/Study.jsx src/pages/Study.test.jsx
git commit -m "feat: implement Study page with word card, sentence input, and compare flow"
```

---

## Task 8: Word List Page

**Files:**
- Modify: `src/pages/WordList.jsx`
- Create: `src/pages/WordList.test.jsx`

**Step 1: Write failing tests**

Create `src/pages/WordList.test.jsx`:
```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import WordList from './WordList'

const mockWords = [
  { word: 'apple', pos: 'noun', definition: 'a round fruit', example: 'I eat an apple every day.' },
  { word: 'run', pos: 'verb', definition: 'to move fast', example: 'She runs every morning.' },
]

vi.mock('../data/words.json', () => ({ default: mockWords }))
vi.mock('../hooks/useProgress', () => ({
  default: () => ({ progress: { apple: 'mastered', run: 'learning' } })
}))

describe('WordList', () => {
  it('shows all words', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.getByText('run')).toBeInTheDocument()
  })

  it('filters to mastered words', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /mastered/i }))
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.queryByText('run')).not.toBeInTheDocument()
  })

  it('filters by search query', () => {
    render(<MemoryRouter><WordList /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'app' } })
    expect(screen.getByText('apple')).toBeInTheDocument()
    expect(screen.queryByText('run')).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/pages/WordList.test.jsx
```

**Step 3: Implement WordList page**

Replace `src/pages/WordList.jsx`:
```jsx
import { useState, useMemo } from 'react'
import words from '../data/words.json'
import useProgress from '../hooks/useProgress'

const FILTERS = ['All', 'Learning', 'Mastered']

export default function WordList() {
  const { progress } = useProgress()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = useMemo(() => {
    return words.filter(w => {
      const matchesQuery = w.word.toLowerCase().includes(query.toLowerCase())
      const status = progress[w.word] === 'mastered' ? 'Mastered' : 'Learning'
      const matchesFilter = filter === 'All' || status === filter
      return matchesQuery && matchesFilter
    })
  }, [query, filter, progress])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 bg-white border-b border-gray-100">
        <h1 className="text-2xl font-bold mb-4">Words</h1>
        <input
          type="search"
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search words..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex gap-2 mt-3">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {filtered.map(w => (
          <div key={w.word} className="flex items-center px-6 py-3 border-b border-gray-100 bg-white">
            <div className="flex-1">
              <span className="font-medium">{w.word}</span>
              <span className="text-gray-400 text-sm ml-2">{w.pos}</span>
            </div>
            {progress[w.word] === 'mastered' && (
              <span className="text-green-500 text-sm">✓ Mastered</span>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 py-16">No words found</div>
        )}
      </div>
    </div>
  )
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/pages/WordList.test.jsx
```

Expected: All 3 tests PASS.

**Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/pages/WordList.jsx src/pages/WordList.test.jsx
git commit -m "feat: implement Word List page with search and filter"
```

---

## Task 9: Final Verification

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS, 0 failures.

**Step 2: Build for production**

```bash
npm run build
```

Expected: `dist/` folder created, no errors.

**Step 3: Preview production build**

```bash
npm run preview
```

Open http://localhost:4173 and manually verify:
- Home: shows progress counter and Start Practice button
- Study: shows word card, sentence input, Compare button reveals example, Mastered/Again works
- Words: shows list, search filters, tab filters work
- Bottom nav navigates between pages

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: verify production build passes"
```
