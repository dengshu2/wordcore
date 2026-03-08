import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav'

const Home = lazy(() => import('./pages/Home'))
const Study = lazy(() => import('./pages/Study'))
const WordList = lazy(() => import('./pages/WordList'))

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 pb-16">
        <Suspense fallback={<div className="px-6 py-10 text-gray-500">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/study" element={<Study />} />
            <Route path="/words" element={<WordList />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
        <Nav />
      </div>
    </BrowserRouter>
  )
}
