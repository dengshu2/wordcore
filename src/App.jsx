import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProgressProvider } from './context/ProgressContext'
import Nav from './components/Nav'

const Home = lazy(() => import('./pages/Home'))
const Study = lazy(() => import('./pages/Study'))
const WordList = lazy(() => import('./pages/WordList'))
const Login = lazy(() => import('./pages/Login'))

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppShell() {
  const { user } = useAuth()

  // On the login page, skip the main layout entirely.
  if (!user) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen px-4 pb-24 pt-4 lg:px-6 lg:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1440px] gap-6 lg:min-h-[calc(100vh-3rem)]">
        <Nav />
        <div
          className="relative min-h-[calc(100vh-2rem)] flex-1 overflow-hidden rounded-[32px] border shadow-(--wc-shadow) lg:min-h-[calc(100vh-3rem)]"
          style={{ background: 'var(--wc-surface)', borderColor: 'var(--wc-border)' }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-white/50 to-transparent" />
          <Suspense fallback={<div className="px-6 py-10 text-sm" style={{ color: 'var(--wc-muted)' }}>Loading…</div>}>
            <Routes>
              <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/study" element={<RequireAuth><Study /></RequireAuth>} />
              <Route path="/words" element={<RequireAuth><WordList /></RequireAuth>} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProgressProvider>
          <AppShell />
        </ProgressProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
