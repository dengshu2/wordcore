import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav'

const Home = lazy(() => import('./pages/Home'))
const Study = lazy(() => import('./pages/Study'))
const WordList = lazy(() => import('./pages/WordList'))

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen px-4 pb-24 pt-4 lg:px-6 lg:py-6">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1440px] gap-6 lg:min-h-[calc(100vh-3rem)]">
          <Nav />
          <div className="relative min-h-[calc(100vh-2rem)] flex-1 overflow-hidden rounded-[32px] border shadow-[var(--wc-shadow)] lg:min-h-[calc(100vh-3rem)]" style={{ background: 'var(--wc-surface)', borderColor: 'var(--wc-border)' }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/50 to-transparent" />
            <Suspense fallback={<div className="px-6 py-10 text-sm" style={{ color: 'var(--wc-muted)' }}>Loading...</div>}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/study" element={<Study />} />
                <Route path="/words" element={<WordList />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </div>
    </BrowserRouter>
  )
}
