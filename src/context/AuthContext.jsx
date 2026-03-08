import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getToken, setToken, clearToken, login as apiLogin, register as apiRegister } from '../services/api'

const AuthContext = createContext(null)

function parseTokenPayload(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return { id: payload.user_id, email: payload.email }
    } catch {
        return null
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const token = getToken()
        return token ? parseTokenPayload(token) : null
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Listen for 401 events dispatched by the API layer (api.js).
    // Setting user to null triggers the route guard redirect, without a full page reload.
    useEffect(() => {
        function handleSessionExpired() {
            setUser(null)
        }
        window.addEventListener('auth:session-expired', handleSessionExpired)
        return () => window.removeEventListener('auth:session-expired', handleSessionExpired)
    }, [])

    const login = useCallback(async (email, password) => {
        setLoading(true)
        setError('')
        try {
            const { token, user } = await apiLogin(email, password)
            setToken(token)
            setUser(user)
            return { ok: true }
        } catch (err) {
            setError(err.message)
            return { ok: false, error: err.message }
        } finally {
            setLoading(false)
        }
    }, [])

    const register = useCallback(async (email, password) => {
        setLoading(true)
        setError('')
        try {
            const { token, user } = await apiRegister(email, password)
            setToken(token)
            setUser(user)
            return { ok: true }
        } catch (err) {
            setError(err.message)
            return { ok: false, error: err.message }
        } finally {
            setLoading(false)
        }
    }, [])

    const logout = useCallback(() => {
        clearToken()
        setUser(null)
    }, [])

    const clearError = useCallback(() => setError(''), [])

    return (
        <AuthContext.Provider value={{ user, loading, error, login, register, logout, clearError }}>
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- intentional: Provider and hook are co-located for cohesion
export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
