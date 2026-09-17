import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] || email
  const parts = local.split(/[._\-+]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function SessionControls({ compact = false }: { compact?: boolean }) {
  const { session, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!session) return null
  const initials = initialsFromEmail(session.email)

  return (
    <div ref={rootRef} className={`header-session${compact ? ' is-compact' : ''}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="header-session-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account, signed in as ${session.email}`}
        onClick={() => setOpen((value) => !value)}
      >
        {initials}
      </button>
      {open ? (
        <div className="header-session-menu" role="menu">
          <p className="header-session-menu-label">Signed in</p>
          <p className="header-session-menu-email">{session.email}</p>
          <button type="button" role="menuitem" className="header-session-menu-signout" onClick={signOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}
