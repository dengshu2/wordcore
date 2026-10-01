import { describe, expect, it, vi } from 'vitest'
import { keyboardInset, trackKeyboard } from './keyboard'

function fakeWindow({ innerHeight, height, offsetTop = 0 }) {
  const listeners = {}
  const docListeners = {}
  const vv = {
    height, offsetTop,
    addEventListener: (type, fn) => { listeners[type] = fn },
    removeEventListener: type => { delete listeners[type] },
  }
  const style = new Map()
  return {
    innerHeight, visualViewport: vv, listeners, docListeners,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: t => clearTimeout(t),
    requestAnimationFrame: fn => fn(),
    document: {
      activeElement: null,
      documentElement: { style: { setProperty: (k, v) => style.set(k, v) } },
      addEventListener: (type, fn) => { docListeners[type] = fn },
      removeEventListener: type => { delete docListeners[type] },
    },
    style,
  }
}

describe('keyboard inset', () => {
  it('is zero when the page is resized for the keyboard or there is none', () => {
    expect(keyboardInset(fakeWindow({ innerHeight: 800, height: 800 }))).toBe(0)
    expect(keyboardInset({ innerHeight: 800 })).toBe(0)
  })

  it('ignores a pinch-zoomed view', () => {
    const win = fakeWindow({ innerHeight: 844, height: 400, offsetTop: 200 })
    win.visualViewport.scale = 2
    expect(keyboardInset(win)).toBe(0)
  })

  it('is the part of the page the keyboard covers (iOS)', () => {
    // 844px page, keyboard leaves 508px visible, and Safari has scrolled the view by 120px.
    expect(keyboardInset(fakeWindow({ innerHeight: 844, height: 508, offsetTop: 120 }))).toBe(216)
  })

  it('writes --kb and follows the visual viewport', () => {
    const win = fakeWindow({ innerHeight: 844, height: 844 })
    const stop = trackKeyboard(win)
    expect(win.style.get('--kb')).toBe('0px')
    win.visualViewport.height = 508
    win.listeners.resize()
    expect(win.style.get('--kb')).toBe('336px')
    stop()
    expect(win.listeners.resize).toBeUndefined()
    expect(win.docListeners.focusin).toBeUndefined()
  })

  it('measures again after focus, since iOS reports the keyboard late', async () => {
    vi.useFakeTimers()
    const win = fakeWindow({ innerHeight: 844, height: 844 })
    trackKeyboard(win)
    win.docListeners.focusin()
    win.visualViewport.height = 508 // the keyboard finishes sliding in, no resize event
    vi.advanceTimersByTime(400)
    expect(win.style.get('--kb')).toBe('336px')
    vi.useRealTimers()
  })

  it('sets the selection again when the focused composer moves', () => {
    const win = fakeWindow({ innerHeight: 844, height: 844 })
    const field = { selectionStart: 4, selectionEnd: 4, selectionDirection: 'none', closest: () => ({}), setSelectionRange: vi.fn() }
    win.document.activeElement = field
    trackKeyboard(win)
    win.visualViewport.height = 508
    win.listeners.resize()
    expect(field.setSelectionRange).toHaveBeenCalledWith(4, 4, 'none')
  })
})
