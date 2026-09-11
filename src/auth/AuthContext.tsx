import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
} from './session'
import { parkDraftForNextLogin } from '../wizard/resume'
import { writeStepUrl } from '../wizard/history'

interface AuthContextValue {
  session: AuthSession | null
  signIn: (session: AuthSession) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn: (next) => {
        saveAuthSession(next)
        setSession(next)
      },
      signOut: () => {
        parkDraftForNextLogin(session?.email)
        writeStepUrl('welcome', 'replace')
        clearAuthSession()
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth requires AuthProvider')
  }
  return ctx
}
