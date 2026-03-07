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
