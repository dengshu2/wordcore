import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProgressProvider } from './context/ProgressContext'
import { ContentProvider } from './context/ContentContext'

const Study = lazy(() => import('./pages/Study'))
const Words = lazy(() => import('./pages/Words'))
const Details = lazy(() => import('./pages/Details'))
const Login = lazy(() => import('./pages/Login'))

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
