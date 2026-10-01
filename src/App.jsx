import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProgressProvider } from './context/ProgressContext'
import { ContentProvider } from './context/ContentContext'

import Study from './pages/Study'

// Study ships with the entry bundle because it is where a signed-in learner lands;
// the other pages load on demand and are fetched quietly once Study is up.
const loadWords = () => import('./pages/Words')
const loadDetails = () => import('./pages/Details')
const Words = lazy(loadWords)
const Details = lazy(loadDetails)
const Login = lazy(() => import('./pages/Login'))

function AppShell() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const t = setTimeout(() => { loadWords(); loadDetails() }, 2000)
    return () => clearTimeout(t)
  }, [user])

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
    <Suspense fallback={null}>
      <Routes>
        <Route path="/study" element={<Study />} />
        <Route path="/words" element={<Words />} />
        <Route path="/word/:word" element={<Details />} />
        <Route path="*" element={<Navigate to="/study" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProgressProvider>
          <ContentProvider>
            <AppShell />
          </ContentProvider>
        </ProgressProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
