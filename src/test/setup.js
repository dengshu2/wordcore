import '@testing-library/jest-dom'

// Node.js 22+ exposes a broken localStorage stub in globalThis that Vitest
// inherits instead of the proper jsdom Storage implementation. Override it
// with the real jsdom Storage via the jsdom instance Vitest attaches to global.
if (typeof globalThis.jsdom !== 'undefined') {
  const jsdomWindow = globalThis.jsdom.window
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdomWindow.localStorage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: jsdomWindow.sessionStorage,
    writable: true,
    configurable: true,
  })
}

// jsdom does not implement scrollIntoView — stub it to prevent
// "not a function" errors when components call it under test.
Element.prototype.scrollIntoView ??= () => {}
