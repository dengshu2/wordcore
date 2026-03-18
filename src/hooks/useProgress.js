import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { fetchRecords, upsertRecord, getToken } from '../services/api'

// ── Spaced-review intervals (in days) ─────────────────────────────────────────

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60]

export function computeNextReviewAt(reviewCount) {
  const idx = Math.min(reviewCount, REVIEW_INTERVALS_DAYS.length - 1)
  const ms = REVIEW_INTERVALS_DAYS[idx] * 86400000
  return new Date(Date.now() + ms).toISOString()
}

// ── Normalization ─────────────────────────────────────────────────────────────

function normalizeFeedback(feedback = {}) {
  return {
    isAcceptable: Boolean(feedback?.isAcceptable ?? feedback?.is_acceptable),
    grammarFeedback: String(feedback?.grammarFeedback ?? feedback?.grammar_feedback ?? '').trim(),
    naturalnessFeedback: String(feedback?.naturalnessFeedback ?? feedback?.naturalness_feedback ?? '').trim(),
    suggestedRevision: String(feedback?.suggestedRevision ?? feedback?.suggested_revision ?? '').trim(),
  }
}

function normalizeRecord(record = {}) {
  return {
    status: ['mastered', 'learning', 'new'].includes(record?.status) ? record.status : 'new',
    draft: String(record?.draft || ''),
    lastCheckedSentence: String(record?.lastCheckedSentence || record?.last_checked_sentence || ''),
    feedback: normalizeFeedback(record?.feedback ?? {
      isAcceptable: record?.feedback_acceptable,
      grammarFeedback: record?.feedback_grammar,
      naturalnessFeedback: record?.feedback_naturalness,
      suggestedRevision: record?.feedback_revision,
    }),
    attempts: Number.isFinite(record?.attempts) ? record.attempts : 0,
    acceptedAttempts: Number.isFinite(record?.acceptedAttempts ?? record?.accepted_attempts)
      ? (record?.acceptedAttempts ?? record?.accepted_attempts)
      : 0,
    reviewCount: Number.isFinite(record?.reviewCount ?? record?.review_count)
      ? (record?.reviewCount ?? record?.review_count)
      : 0,
    nextReviewAt: record?.nextReviewAt || record?.next_review_at || null,
    updatedAt: String(record?.updatedAt || record?.updated_at || ''),
  }
}

// ── Convert the backend's flat record shape to our frontend shape ──────────────

function fromAPIRecord(apiRecord) {
  return normalizeRecord({
    status: apiRecord.status,
    draft: apiRecord.draft,
    lastCheckedSentence: apiRecord.last_checked_sentence,
    feedback: {
      isAcceptable: apiRecord.feedback_acceptable,
      grammarFeedback: apiRecord.feedback_grammar,
      naturalnessFeedback: apiRecord.feedback_naturalness,
      suggestedRevision: apiRecord.feedback_revision,
    },
    attempts: apiRecord.attempts,
    acceptedAttempts: apiRecord.accepted_attempts,
    reviewCount: apiRecord.review_count,
    nextReviewAt: apiRecord.next_review_at,
    updatedAt: apiRecord.updated_at,
  })
}

// ── Convert frontend shape back to the API request body ───────────────────────

function toAPIRecord(record) {
  const f = normalizeFeedback(record.feedback)
  return {
    status: record.status,
    draft: record.draft,
    last_checked_sentence: record.lastCheckedSentence,
    feedback_acceptable: record.feedback?.isAcceptable != null ? Boolean(record.feedback.isAcceptable) : null,
    feedback_grammar: f.grammarFeedback,
    feedback_naturalness: f.naturalnessFeedback,
    feedback_revision: f.suggestedRevision,
    attempts: record.attempts,
    accepted_attempts: record.acceptedAttempts,
    review_count: record.reviewCount,
    next_review_at: record.nextReviewAt,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useProgress(user) {
  const [records, setRecords] = useState({})
  const [syncState, setSyncState] = useState('idle') // 'idle' | 'loading' | 'error'
  // Track pending upserts to debounce and batch per word
  const pendingRef = useRef({})

  // Load records whenever user changes (login → fetch, logout → clear)
  useEffect(() => {
    if (!user || !getToken()) {
      setRecords({})
      setSyncState('idle')
      return
    }

    setSyncState('loading')
    fetchRecords()
      .then(apiRecords => {
        // apiRecords is { [word]: flatApiRecord }
        const normalized = Object.fromEntries(
          Object.entries(apiRecords).map(([word, r]) => [word, fromAPIRecord(r)])
        )
        setRecords(normalized)
        setSyncState('idle')
      })
      .catch(() => {
        setSyncState('error')
      })
  }, [user])

  // Debounced API sync for a single word
  const syncWord = useCallback((word, record) => {
    if (pendingRef.current[word]) clearTimeout(pendingRef.current[word])
    pendingRef.current[word] = setTimeout(() => {
      upsertRecord(word, toAPIRecord(record)).catch(err => {
        console.error('Failed to sync record for', word, err)
      })
    }, 600)
  }, [])

  const updateRecord = useCallback((word, updater) => {
    setRecords(prev => {
      const next = normalizeRecord(updater(normalizeRecord(prev[word])))
      syncWord(word, next)
      return { ...prev, [word]: next }
    })
  }, [syncWord])

  const setStatus = useCallback((word, status) => {
    updateRecord(word, record => ({
      ...record,
      status,
      updatedAt: new Date().toISOString(),
    }))
  }, [updateRecord])

  const saveDraft = useCallback((word, sentence) => {
    updateRecord(word, record => ({
      ...record,
      draft: sentence,
      status: record.status === 'new' && sentence.trim() ? 'learning' : record.status,
      updatedAt: new Date().toISOString(),
    }))
  }, [updateRecord])

  const saveFeedback = useCallback((word, feedback, checkedSentence) => {
    const normalized = normalizeFeedback(feedback)
    updateRecord(word, record => ({
      ...record,
      status: record.status === 'new' ? 'learning' : record.status,
      lastCheckedSentence: checkedSentence,
      feedback: normalized,
      attempts: record.attempts + 1,
      acceptedAttempts: record.acceptedAttempts + (normalized.isAcceptable ? 1 : 0),
      updatedAt: new Date().toISOString(),
    }))
  }, [updateRecord])

  const markMastered = useCallback((word) => {
    updateRecord(word, record => ({
      ...record,
      status: 'mastered',
      reviewCount: 0,
      nextReviewAt: computeNextReviewAt(0),
      updatedAt: new Date().toISOString(),
    }))
  }, [updateRecord])

  const confirmReview = useCallback((word) => {
    updateRecord(word, record => {
      const newCount = record.reviewCount + 1
      return {
        ...record,
        reviewCount: newCount,
        nextReviewAt: computeNextReviewAt(newCount),
        updatedAt: new Date().toISOString(),
      }
    })
  }, [updateRecord])

  const resetToLearning = useCallback((word) => {
    updateRecord(word, record => ({
      ...record,
      status: 'learning',
      reviewCount: 0,
      nextReviewAt: null,
      acceptedAttempts: 0,
      updatedAt: new Date().toISOString(),
    }))
  }, [updateRecord])

  const progress = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(records)
          .filter(([, r]) => r.status !== 'new')
          .map(([word, r]) => [word, r.status])
      ),
    [records]
  )

  const drafts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(records)
          .filter(([, r]) => r.draft)
          .map(([word, r]) => [word, r.draft])
      ),
    [records]
  )

  const masteredCount = useMemo(
    () => Object.values(records).filter(r => r.status === 'mastered').length,
    [records]
  )

  return { records, progress, drafts, setStatus, saveDraft, saveFeedback, markMastered, confirmReview, resetToLearning, masteredCount, syncState }
}
