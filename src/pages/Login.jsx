import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const { login, register, loading, error, clearError } = useAuth()
    const navigate = useNavigate()
    const [mode, setMode] = useState('login') // 'login' | 'register'
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
        <div style={{
            display: 'flex',
            minHeight: '100dvh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            background: 'var(--wc-bg)',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '360px',
                background: 'var(--wc-surface)',
                border: '1px solid var(--wc-border)',
                borderRadius: 'var(--r-xl)',
                boxShadow: 'var(--wc-shadow)',
                padding: 'var(--space-8)',
            }}>
                {/* Wordmark */}
                <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
                    <div style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        color: 'var(--wc-text)',
                    }}>
                        WordCore
                    </div>
                    <div style={{
                        marginTop: 'var(--space-1)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.875rem',
                        color: 'var(--wc-muted)',
                    }}>
                        {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                        <label
                            htmlFor="login-email"
                            className="label"
                            style={{ display: 'block', marginBottom: 'var(--space-2)' }}
                        >
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
                        <label
                            htmlFor="login-password"
                            className="label"
                            style={{ display: 'block', marginBottom: 'var(--space-2)' }}
                        >
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
                        className="btn btn--primary"
                        style={{ width: '100%' }}
                    >
                        {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                </form>

                <div style={{
                    marginTop: 'var(--space-6)',
                    textAlign: 'center',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.875rem',
                    color: 'var(--wc-muted)',
                }}>
                    {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        style={{
                            fontWeight: 600,
                            color: 'var(--wc-accent)',
                            textDecoration: 'underline',
                            textUnderlineOffset: '2px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-ui)',
                            fontSize: 'inherit',
                        }}
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
