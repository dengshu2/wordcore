// Keeps the docked composer above the on-screen keyboard.
//
// Chrome and Firefox on Android shrink the page for the keyboard because the
// viewport meta asks for `interactive-widget=resizes-content`. iOS Safari does
// not: the keyboard covers the bottom of the page and a `position: fixed;
// bottom: 0` composer ends up behind it, most visibly on the first focus. The
// visual viewport shows how much of the page the keyboard hides; that height
// goes into --kb, which the composer adds to its bottom offset.

export function keyboardInset(win = window) {
  const vv = win.visualViewport
  // A pinch-zoomed view is smaller than the page too, but that is not a keyboard.
  if (!vv || (vv.scale && vv.scale > 1.01)) return 0
  return Math.max(0, Math.round(win.innerHeight - vv.height - vv.offsetTop))
}

// iOS reports the keyboard's size only when its slide-in animation ends, and
// sometimes without another resize event, so the inset is measured again a few
// times after a field gains or loses focus.
const SETTLE_MS = [0, 120, 350, 700]

export function trackKeyboard(win = window) {
  const vv = win.visualViewport
  if (!vv) return () => {}
  const doc = win.document
  const root = doc.documentElement
  let last = -1
  const update = () => {
    const kb = keyboardInset(win)
    if (kb === last) return
    last = kb
    root.style.setProperty('--kb', `${kb}px`)
    redrawCaret(win)
  }
  let timers = []
  const settle = () => {
    timers.forEach(t => win.clearTimeout(t))
    timers = SETTLE_MS.map(ms => win.setTimeout(update, ms))
  }
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  doc.addEventListener('focusin', settle)
  doc.addEventListener('focusout', settle)
  update()
  return () => {
    timers.forEach(t => win.clearTimeout(t))
    vv.removeEventListener('resize', update)
    vv.removeEventListener('scroll', update)
    doc.removeEventListener('focusin', settle)
    doc.removeEventListener('focusout', settle)
  }
}

// When the composer moves while its field has focus, iOS can keep drawing the
// caret where the field used to be. Setting the same selection again makes it
// draw the caret in the right place.
function redrawCaret(win) {
  const el = win.document.activeElement
  if (!el || typeof el.setSelectionRange !== 'function' || !el.closest?.('.dock')) return
  win.requestAnimationFrame(() => {
    if (win.document.activeElement !== el) return
    const { selectionStart, selectionEnd, selectionDirection } = el
    el.setSelectionRange(selectionStart, selectionEnd, selectionDirection || 'none')
  })
}
