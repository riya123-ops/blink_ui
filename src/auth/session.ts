export const AUTH_SESSION_KEY = 'blink.auth.v1'
export const LOGIN_ALLOWED_DOMAIN = 'talentserv.co.in'

export interface AuthSession {
  token: string
  email: string
  expiresAt: string
}

export function isTalentservEmail(value: string): boolean {
  const email = value.trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at <= 0 || at !== email.indexOf('@')) return false
  const local = email.slice(0, at)
  const host = email.slice(at + 1)
  return Boolean(local) && !local.includes(' ') && host === LOGIN_ALLOWED_DOMAIN
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed?.token || !parsed.email || !parsed.expiresAt) return null
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      localStorage.removeItem(AUTH_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY)
}
