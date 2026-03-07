import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Study from './pages/Study'
import WordList from './pages/WordList'
import Nav from './components/Nav'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/study" element={<Study />} />
          <Route path="/words" element={<WordList />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Nav />
      </div>
    </BrowserRouter>
  )
}
