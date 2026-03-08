import { useState, useEffect, useMemo } from 'react'

const STORAGE_KEY = 'wordcore-progress'
const DRAFTS_KEY = 'wordcore-drafts'

export default function useProgress() {
  const [progress, setProgress] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch {
      return {}
    }
  })
  const [drafts, setDrafts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAFTS_KEY)) || {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [progress])

  useEffect(() => {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
  }, [drafts])

  const setStatus = (word, status) => {
    setProgress(prev => ({ ...prev, [word]: status }))
  }

  const saveDraft = (word, sentence) => {
    setDrafts(prev => ({ ...prev, [word]: sentence }))
  }

  const masteredCount = useMemo(
    () => Object.values(progress).filter(s => s === 'mastered').length,
    [progress]
  )

  return { progress, drafts, setStatus, saveDraft, masteredCount }
}
