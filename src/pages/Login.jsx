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
        <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--wc-bg)' }}>
            <div
                className="w-full max-w-sm rounded-[32px] border p-8"
                style={{ background: 'var(--wc-surface)', borderColor: 'var(--wc-border)', boxShadow: 'var(--wc-shadow)' }}
            >
                {/* Wordmark */}
                <div className="mb-8 text-center">
                    <div className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                        WordCore
                    </div>
                    <div className="mt-1 text-sm" style={{ color: 'var(--wc-muted)' }}>
                        {mode === 'login' ? 'Welcome back.' : 'Create your account.'}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div>
                        <label
                            htmlFor="login-email"
                            className="block text-xs font-medium uppercase tracking-[0.2em] mb-2"
                            style={{ color: 'var(--wc-muted)' }}
                        >
                            Email
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
                            style={{
                                borderColor: 'rgba(69, 44, 27, 0.16)',
                                background: 'rgba(255,250,241,0.92)',
                                color: 'var(--wc-text)',
                            }}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="login-password"
                            className="block text-xs font-medium uppercase tracking-[0.2em] mb-2"
                            style={{ color: 'var(--wc-muted)' }}
                        >
                            Password
                        </label>
                        <input
                            id="login-password"
                            type="password"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition"
                            style={{
                                borderColor: 'rgba(69, 44, 27, 0.16)',
                                background: 'rgba(255,250,241,0.92)',
                                color: 'var(--wc-text)',
                            }}
                            placeholder="8+ characters"
                            required
                        />
                    </div>

                    {displayError && (
                        <div
                            className="rounded-2xl px-4 py-3 text-sm leading-6"
                            style={{ background: 'rgba(154, 90, 31, 0.08)', color: '#9a5a1f' }}
                            role="alert"
                        >
                            {displayError}
                        </div>
                    )}

                    <button
                        id="login-submit"
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, var(--wc-accent) 0%, #2d7e65 100%)' }}
                    >
                        {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm" style={{ color: 'var(--wc-muted)' }}>
                    {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        className="font-medium underline-offset-2 hover:underline"
                        style={{ color: 'var(--wc-accent)' }}
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
