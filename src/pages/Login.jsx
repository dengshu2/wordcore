import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, register, loading, error, clearError } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLocalError('')
    clearError()

    if (!email.trim()) { setLocalError('Email is required.'); return }
    if (password.length < 8) { setLocalError('Password must be at least 8 characters.'); return }

    const fn = mode === 'login' ? login : register
    const result = await fn(email.trim(), password)
    if (result.ok) navigate('/')
  }

  const displayError = localError || error

  return (
    <div className="login-layout">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand__name">WordCore</div>
          <div className="login-brand__sub">
            {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="login-form">
          <div>
            <label htmlFor="login-email" className="label label--block">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="label label--block">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="8+ characters"
              required
            />
          </div>

          {displayError && (
            <div className="notice notice--warn" role="alert">
              {displayError}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn btn--primary w-full"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="login-footer">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            className="login-toggle"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setLocalError('')
              clearError()
            }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
