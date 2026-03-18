import { createContext, useContext } from 'react'
import useProgress from '../hooks/useProgress'
import { useAuth } from './AuthContext'

const ProgressContext = createContext(null)

export function ProgressProvider({ children }) {
    const { user } = useAuth()
    const progress = useProgress(user)
    return (
        <ProgressContext.Provider value={progress}>
            {children}
        </ProgressContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- intentional: Provider and hook are co-located for cohesion
export function useProgressContext() {
    const ctx = useContext(ProgressContext)
    if (!ctx) throw new Error('useProgressContext must be used within ProgressProvider')
    return ctx
}
