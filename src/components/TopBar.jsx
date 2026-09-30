import { useNavigate } from 'react-router'
import { BackIcon, MenuIcon } from './Icons'

export function StudyTopBar({ title, subtitle, action }) {
  const navigate = useNavigate()
  return (
    <header className="top">
      <button type="button" className="round" aria-label="All words" onClick={() => navigate('/words')}><MenuIcon /></button>
      <div className="status"><b>{title}</b>{subtitle && <span>{subtitle}</span>}</div>
      {action || <span />}
    </header>
  )
}

export function PageTopBar({ action }) {
  const navigate = useNavigate()
  function back() {
    // Pages are opened from the app, so going back returns to where the learner was.
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/study')
  }
  return (
    <header className="top">
      <button type="button" className="round" aria-label="Back" onClick={back}><BackIcon /></button>
      <span />
      {action || <span />}
    </header>
  )
}
