import { useEffect, useRef } from 'react'
import { SendIcon } from '../Icons'

const IDEAS = [
  { key: 'answer', label: 'Answer a question' },
  { key: 'finish', label: 'Finish a sentence' },
  { key: 'rewrite', label: 'Rewrite' },
]

// The floating composer. Writing ideas sit above it as plain chips while the
// box is empty, so there is nothing to open or dismiss.
export default function Composer({ value, onChange, onSend, onIdea, onMastered, canSend, busy, hint, placeholder, focusSignal }) {
  const ref = useRef(null)
  const dockRef = useRef(null)

  // The page leaves exactly this much room under its content, so the actions
  // end just above the composer whatever it currently shows.
  useEffect(() => {
    const dock = dockRef.current
    if (!dock || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const ro = new ResizeObserver(() => root.style.setProperty('--dock-h', `${dock.offsetHeight}px`))
    ro.observe(dock)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`
  }, [value])

  useEffect(() => {
    if (!focusSignal || !ref.current) return
    const ta = ref.current
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }, [focusSignal])

  function handleKeyDown(e) {
    // An Enter that confirms an input-method candidate is not a send. Safari ends
    // the composition before that keydown, so isComposing is already false there
    // and only keyCode 229 ("being processed by the IME") gives it away.
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault()
      onMastered?.()
      return
    }
    if (!e.shiftKey) {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div className="dock" ref={dockRef}>
      <div className="dock-in">
        {!value.trim() && !busy && (
          <div className="ideas" role="group" aria-label="Writing ideas">
            {IDEAS.map(idea => (
              <button key={idea.key} type="button" className="idea" onClick={() => onIdea(idea.key)}>{idea.label}</button>
            ))}
          </div>
        )}
        {hint && <p className="hint" aria-live="polite">{hint}</p>}
        <form className="composer" onSubmit={e => { e.preventDefault(); if (canSend) onSend() }}>
          <textarea
            ref={ref}
            id="study-sentence"
            rows={1}
            value={value}
            placeholder={placeholder}
            aria-label="Your sentence"
            enterKeyHint="send"
            autoComplete="off"
            autoCapitalize="sentences"
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="send" aria-label="Check my sentence" disabled={!canSend}><SendIcon /></button>
        </form>
      </div>
    </div>
  )
}
