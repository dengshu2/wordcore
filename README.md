# WordCore

A quiet workspace for steady English vocabulary practice.

Write one sentence per word. Get lightweight AI feedback. Repeat until it sticks.

## What it does

WordCore is built around one learning loop:

1. Read the target word, its definition, and a reference sentence
2. Write one similar sentence with a small change
3. Press **Self-check** to get AI feedback on grammar and naturalness
4. Repeat until the word is genuinely usable

Progress is saved to your account and syncs across devices.

## Architecture

One container serves everything — frontend and API from the same origin.

```
wordcore.dengshu.ovh
       │
  Docker container
  ├── React SPA (dist/ → /static)
  ├── POST /auth/register
  ├── POST /auth/login
  ├── GET  /api/records
  ├── PUT  /api/records/:word
  └── POST /api/check-sentence (OpenRouter proxy)
       │
  PostgreSQL (shared postgres-server)
```

**Stack:**
- Frontend: React 19 + Vite + Tailwind CSS v4
- Backend: Go + [Chi](https://github.com/go-chi/chi) router
- Auth: JWT (7-day tokens) + bcrypt
- Database: PostgreSQL
- AI: [OpenRouter](https://openrouter.ai) — `google/gemini-2.5-flash`

## Local Development

```bash
# 1. Copy env template and fill in your keys
cp .env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:8080 in .env.local

# 2. Start the backend (requires a local PostgreSQL instance)
cd api && go run .

# 3. Start the frontend dev server (separate terminal)
npm install && npm run dev
```

## Deployment

The project builds into a single Docker image — frontend + backend.

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Rebuild after changes
docker compose up -d --build
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Random secret for signing JWTs (`openssl rand -hex 32`) |
| `OPENROUTER_API_KEY` | ✅ | API key from [openrouter.ai](https://openrouter.ai/keys) |
| `OPENROUTER_MODEL` | — | Model name (default: `google/gemini-2.5-flash`) |
| `GEMINI_API_KEY` | — | Only needed for the offline word-generation script |

### Database Setup

```sql
CREATE USER wordcore WITH PASSWORD 'your_password';
CREATE DATABASE wordcore OWNER wordcore;
GRANT ALL PRIVILEGES ON DATABASE wordcore TO wordcore;
```

Tables are created automatically on first startup.

### Nginx Proxy Manager

Add one Proxy Host:
- **Domain**: `wordcore.yourdomain.com`
- **Forward Host**: `wordcore`
- **Forward Port**: `8080`
- Enable SSL (Let's Encrypt)

## Scripts

```bash
npm run dev       # Start Vite dev server
npm run build     # Build frontend for production
npm test          # Run unit tests
npm run lint      # Lint frontend code
```

The offline word generation script (`scripts/generate-words.mjs`) requires `GEMINI_API_KEY` (not `VITE_`).
