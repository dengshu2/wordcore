# WordCore

A quiet place for steady English vocabulary practice, in English only.

One word at a time: read a short card, hear it, write your own sentences with the word, and get feedback on each one. Three accepted sentences and the word can be marked as mastered; mastered words come back for review.

## What it does

- **Study cards** for about 2,000 common words: level, part of speech, IPA and syllables, one meaning at a time with natural example sentences, and a drawing for the meaning: an icon, a timeline, a scale, or a scene for prepositions.
- **Audio** for every word and example, recorded ahead of time with Xiaomi MiMo (voice Mia). Anything not recorded yet is recorded when first played, and the browser's own voice is the last fallback.
- **Writing practice** as a short conversation: your sentence, then the check (grammar and naturalness, with a revision when needed). Writing ideas above the composer: answer a question, finish a sentence, rewrite one.
- **Words** page with search and status, and a **details** page per word; progress syncs to your account.

The interface follows the shared Quiet UI rules: one column, one scroll, no pop-ups.

## Architecture

One container serves the frontend and the API from the same origin.

```
  Docker container (Go + chi)
  ├── React SPA (dist/ → /app/static)
  ├── POST /auth/register, /auth/login
  ├── GET  /api/words                  word list with level, forms, ready flag
  ├── GET  /api/cards/{word}           study card + audio clip info
  ├── POST /api/tts                    record a clip on demand (daily cap)
  ├── GET  /audio/{key}.mp3            recorded clips (public, immutable)
  ├── GET  /icons/{name}.svg           Phosphor icons, fetched once and cached
  ├── GET  /api/records, PUT /api/records/{word}, GET /api/records/export
  └── POST /api/check-sentence         sentence feedback via OpenRouter
       │                    │
  PostgreSQL           ./content (mounted at /app/content)
  (shared server)      cards/*.json, audio/mimo-Mia/*.mp3, icons/
```

**Stack:** React 19 + Vite + React Router; Go + [chi](https://github.com/go-chi/chi); PostgreSQL; JWT + bcrypt.

**Models:**
- Sentence feedback: OpenRouter, `google/gemini-2.5-flash` by default.
- Study cards: DeepSeek `deepseek-flash` with thinking off (offline, `scripts/content`).
- Audio: Xiaomi MiMo `mimo-v2.5-tts`, checked with MiMo ASR (offline); Doubao TTS can be switched in.

## Study content

Cards and audio are generated offline by `scripts/content` and are not in git (`/content/` is ignored). The app reloads the content directory every few minutes, so new cards appear without a restart.

```bash
cd scripts/content
./ctl.sh cards     # write missing cards with DeepSeek, then exit
./ctl.sh start     # record missing audio in the background (user systemd unit)
./ctl.sh status    # progress: cards, drawings, audio, clips that need review
./ctl.sh logs 50
```

- Each clip is recorded, transcribed by MiMo ASR and compared with the text; up to three tries, the best one is kept and flagged when it never matched. Most flags are the ASR spelling out numbers ("200" → "two hundred"), not bad audio.
- The clip key is `sha1(provider \n voice \n style \n text)[:20]`, shared by `scripts/content/lib.py` and `api/tts.go`; change both together.
- Capitals made of Roman-numeral letters (ID, CV, CD) are sent to the TTS as I.D. and so on, otherwise MiMo reads "ID" as 499. Both sides apply the same `speakable` rule.

## Frontend notes

- Loading never swaps the frame: the top bar and composer stay put, and three dots appear only if a card takes noticeably long. `index.html` paints the same frame before any script runs, the word list is cached in `localStorage`, and the next card (with its icon and audio) is fetched while the current one is on screen.
- The composer stays above the phone keyboard: `interactive-widget=resizes-content` for Android, and `src/lib/keyboard.js` lifts it by the hidden height on iOS Safari. Enter sends, but not the Enter that confirms an input-method candidate (`keyCode 229` in Safari).

## Local development

```bash
cp .env.example .env.local          # set VITE_API_BASE_URL=http://localhost:8080
cd api && go run .                  # needs PostgreSQL and the env vars below
npm install && npm run dev          # separate terminal
```

```bash
npm test && npm run lint && npm run build
docker run --rm -v "$PWD/api":/src -w /src golang:1.25 go test ./...
```

## Deployment

```bash
docker compose up -d --build
docker compose logs -f
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | `openssl rand -hex 32` |
| `OPENROUTER_API_KEY` | yes | Sentence feedback |
| `OPENROUTER_MODEL` | — | Default `google/gemini-2.5-flash` |
| `TTS_PROVIDER` / `TTS_VOICE` | — | `mimo` / `Mia` (or `doubao` with a Doubao voice) |
| `MIMO_API_KEY` | for MiMo | On-demand clips and the content pipeline |
| `DOUBAO_TTS_API_KEY` | for Doubao | Only when `TTS_PROVIDER=doubao` |
| `TTS_DAILY_CAP` | — | On-demand clips per day, default 500 |
| `DEEPSEEK_API_KEY` | pipeline | Writing cards (`scripts/content`); export it or add it to `.env` |
| `VITE_UMAMI_WEBSITE_ID` | — | Analytics, empty to disable |

### Database

```sql
CREATE USER wordcore WITH PASSWORD 'your_password';
CREATE DATABASE wordcore OWNER wordcore;
```

Tables and migrations run automatically on startup; records are merged onto the card bank's headwords after each content reload.
