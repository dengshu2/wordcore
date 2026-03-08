import { useState, useEffect, useMemo } from 'react'

const STORAGE_KEY = 'wordcore-records'
const LEGACY_PROGRESS_KEY = 'wordcore-progress'
const LEGACY_DRAFTS_KEY = 'wordcore-drafts'

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
    status: record?.status === 'mastered' ? 'mastered' : record?.status === 'learning' ? 'learning' : 'new',
    draft: String(record?.draft || ''),
    lastCheckedSentence: String(record?.lastCheckedSentence || ''),
    feedback: normalizeFeedback(record?.feedback),
    attempts: Number.isFinite(record?.attempts) ? record.attempts : 0,
    acceptedAttempts: Number.isFinite(record?.acceptedAttempts) ? record.acceptedAttempts : 0,
    updatedAt: String(record?.updatedAt || ''),
  }
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {}
  } catch {
    return {}
  }
}

function buildLegacyRecords(progress, drafts) {
  const words = new Set([...Object.keys(progress), ...Object.keys(drafts)])
  return Array.from(words).reduce((records, word) => {
    records[word] = normalizeRecord({
      status: progress[word] || (drafts[word] ? 'learning' : 'new'),
      draft: drafts[word] || '',
    })
    return records
  }, {})
}

function mergeRecordMaps(primary, secondary) {
  const words = new Set([...Object.keys(primary), ...Object.keys(secondary)])
  return Array.from(words).reduce((records, word) => {
    records[word] = normalizeRecord({
      ...secondary[word],
      ...primary[word],
      feedback: {
        ...(secondary[word]?.feedback || {}),
        ...(primary[word]?.feedback || {}),
      },
    })
    return records
  }, {})
}

function loadRecords() {
  const storedRecords = readJson(STORAGE_KEY)
  const normalizedRecords = Object.fromEntries(
    Object.entries(storedRecords).map(([word, record]) => [word, normalizeRecord(record)])
  )

  const legacyProgress = readJson(LEGACY_PROGRESS_KEY)
  const legacyDrafts = readJson(LEGACY_DRAFTS_KEY)
  const legacyRecords = buildLegacyRecords(legacyProgress, legacyDrafts)

  return mergeRecordMaps(normalizedRecords, legacyRecords)
}

function updateRecord(records, word, updater) {
  const nextRecord = normalizeRecord(updater(normalizeRecord(records[word])))
  return { ...records, [word]: nextRecord }
}

export default function useProgress() {
  const [records, setRecords] = useState(loadRecords)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  }, [records])

  const setStatus = (word, status) => {
    setRecords(prev =>
      updateRecord(prev, word, record => ({
        ...record,
        status,
        updatedAt: new Date().toISOString(),
      }))
    )
  }

  const saveDraft = (word, sentence) => {
    setRecords(prev =>
      updateRecord(prev, word, record => ({
        ...record,
        draft: sentence,
        status: record.status === 'new' && sentence.trim() ? 'learning' : record.status,
        updatedAt: new Date().toISOString(),
      }))
    )
  }

  const saveFeedback = (word, feedback, checkedSentence) => {
    const normalizedFeedback = normalizeFeedback(feedback)
    setRecords(prev =>
      updateRecord(prev, word, record => ({
        ...record,
        status: record.status === 'new' ? 'learning' : record.status,
        lastCheckedSentence: checkedSentence,
        feedback: normalizedFeedback,
        attempts: record.attempts + 1,
        acceptedAttempts: record.acceptedAttempts + (normalizedFeedback.isAcceptable ? 1 : 0),
        updatedAt: new Date().toISOString(),
      }))
    )
  }

  const progress = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(records)
          .filter(([, record]) => record.status !== 'new')
          .map(([word, record]) => [word, record.status])
      ),
    [records]
  )

  const drafts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(records)
          .filter(([, record]) => record.draft)
          .map(([word, record]) => [word, record.draft])
      ),
    [records]
  )

  const masteredCount = useMemo(
    () => Object.values(records).filter(record => record.status === 'mastered').length,
    [records]
  )

  return { records, progress, drafts, setStatus, saveDraft, saveFeedback, masteredCount }
}
