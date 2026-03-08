/**
 * Unified API layer for WordCore.
 * In production, frontend and API are served from the same origin,
 * so all requests use relative paths — no CORS, no separate domain needed.
 * In local dev, set VITE_API_BASE_URL=http://localhost:8080 in .env.local.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const TOKEN_KEY = 'wc_token'

export function getToken() {
    return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t)
}
export function clearToken() {
    localStorage.removeItem(TOKEN_KEY)
}

async function request(path, options = {}) {
    const token = getToken()
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    })

    // 401 means the token has expired or is invalid — force re-login.
    if (res.status === 401) {
        clearToken()
        window.location.href = '/login'
        throw new Error('Session expired. Please log in again.')
    }

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`)
    }

    return data
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(email, password) {
    return request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
}

export async function login(email, password) {
    return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
}

// ── Records ───────────────────────────────────────────────────────────────────

/**
 * Fetch all word records for the authenticated user.
 * Returns a map of { [word]: WordRecord }.
 */
export async function fetchRecords() {
    return request('/api/records')
}

/**
 * Create or update the record for a single word.
 * @param {string} word
 * @param {object} record - WordRecord shape
 */
export async function upsertRecord(word, record) {
    return request(`/api/records/${encodeURIComponent(word)}`, {
        method: 'PUT',
        body: JSON.stringify(record),
    })
}

// ── Sentence check ────────────────────────────────────────────────────────────

/**
 * Run AI sentence checking via the backend proxy.
 * Returns { is_acceptable, grammar_feedback, naturalness_feedback, suggested_revision }.
 */
export async function checkSentenceAPI({ word, definition, referenceSentence, userSentence }) {
    return request('/api/check-sentence', {
        method: 'POST',
        body: JSON.stringify({ word, definition, referenceSentence, userSentence }),
    })
}
