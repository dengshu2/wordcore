import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProgressProvider } from './context/ProgressContext'
import Nav from './components/Nav'

const Study = lazy(() => import('./pages/Study'))
const WordList = lazy(() => import('./pages/WordList'))
const Login = lazy(() => import('./pages/Login'))

function RequireAuth({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function LoadingFallback() {
  return (
    <div style={{ padding: '40px', color: 'var(--wc-muted)', fontFamily: 'var(--font-ui)', fontSize: '14px' }}>
      Loading…
    </div>
  )
}

function AppShell() {
  const { user } = useAuth()

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
    <div className="app-shell">
      <Nav />
      <main className="main-pane" id="main-content">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/study" replace />} />
            <Route path="/study" element={<RequireAuth><Study /></RequireAuth>} />
            <Route path="/words" element={<RequireAuth><WordList /></RequireAuth>} />
            <Route path="/login" element={<Navigate to="/study" replace />} />
            <Route path="*" element={<Navigate to="/study" replace />} />
          </Routes>
        </Suspense>
      </main>
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
