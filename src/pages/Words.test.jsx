import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import Words from './Words'

vi.mock('../context/ContentContext', () => ({
  useContent: () => ({
    words: [
      { word: 'while', display: 'while', level: 'A2', ready: true },
      { word: 'january', display: 'January', level: 'A1', ready: true },
      { word: 'bridge', display: 'bridge', level: 'A2', ready: false },
      { word: 'the', display: 'the', level: 'A1', ready: false },
    ],
  }),
}))
vi.mock('../context/ProgressContext', () => ({
  useProgressContext: () => ({
    masteredCount: 1,
    records: {
      january: { status: 'mastered' },
      the: { status: 'mastered' },
      while: { status: 'learning', attempts: 2, acceptedAttempts: 1, feedback: { isAcceptable: false } },
    },
  }),
}))

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname}{loc.search}</p>
}

function renderWords() {
  return render(
    <MemoryRouter initialEntries={['/words']}>
      <Routes>
        <Route path="/words" element={<Words />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Words', () => {
  it('lists every word with its progress', () => {
    renderWords()
    expect(screen.getByText('1 mastered · 4 words')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'January, Mastered' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'while, Needs work' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'bridge, Preparing' })).toBeDisabled()
    // Progress wins over "Preparing" for words studied before their new card exists.
    expect(screen.getByRole('button', { name: 'the, Mastered' })).toBeDisabled()
  })

  it('filters by search and status', () => {
    renderWords()
    fireEvent.change(screen.getByLabelText('Search words'), { target: { value: 'jan' } })
    expect(screen.queryByText('while')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search words'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Needs work' }))
    expect(screen.getByText('while')).toBeInTheDocument()
    expect(screen.queryByText('January')).not.toBeInTheDocument()
  })

  it('opens a word in study', () => {
    renderWords()
    fireEvent.click(screen.getByRole('button', { name: /January/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/study?word=january')
  })
})
