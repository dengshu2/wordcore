# WordCore Design Document

> Date: 2026-03-07 | Status: Approved

---

## Overview

WordCore is a vocabulary practice web app. The core loop: see a word → write your own example sentence → compare with a reference sentence → mark as mastered or practice again.

---

## Data Generation (One-time Offline Script)

**Source:** Top 3000 words from [google-10000-english](https://github.com/first20hours/google-10000-english)

**Process:**
1. Node.js script reads the word list
2. Calls Gemini API (Google AI Studio) per word to generate:
   - `pos`: part of speech (noun / verb / adjective / adverb / etc.)
   - `definition`: one short English definition sentence
   - `example`: a simple, everyday-life example sentence
3. Outputs `src/data/words.json`

**Quality check:** Generate 20 sample words first for user approval before full batch run.

**words.json structure:**
```json
[
  {
    "word": "abandon",
    "pos": "verb",
    "definition": "to leave someone or something permanently",
    "example": "She had to abandon her car in the snow."
  }
]
```

---

## Application Architecture

**Stack:** Vite + React, no backend, no login

**File structure:**
```
src/
  data/words.json
  hooks/useProgress.js
  pages/
    Home.jsx
    Study.jsx
    WordList.jsx
  components/
    WordCard.jsx
    SentenceInput.jsx
```

**localStorage schema:**
```json
{
  "progress": {
    "abandon": "mastered",
    "ability": "learning"
  }
}
```

Word states: `learning` (default) | `mastered`

---

## Pages & UI

### Home
- Large progress display: `847 / 3000 mastered`
- Progress bar
- "Start Practice" button (pulls from learning words)
- Bottom nav: Home / Study / Words

### Study (Word Card)
```
┌─────────────────────────┐
│                         │
│        abandon          │
│  verb · to leave        │
│  something permanently  │
│                         │
├─────────────────────────┤
│  Write your sentence:   │
│  [___________________]  │
│                         │
│       [Compare]         │
├─────────────────────────┤
│  Reference sentence     │
│  (revealed after click) │
└─────────────────────────┘
        [Mastered]  [Again]
```

Flow:
1. User sees word + pos + definition
2. User writes their own example sentence
3. Click "Compare" → reference sentence revealed
4. User clicks "Mastered" or "Again"

### Word List
- Search bar + filter tabs: All / Learning / Mastered
- Each row: word + pos + status indicator

---

## Non-functional Requirements

- Mobile-first responsive design
- All English interface
- Offline capable (no runtime API calls)
- No ads, no accounts
