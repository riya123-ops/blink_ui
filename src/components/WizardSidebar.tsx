import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AlertCircle, ChevronDown, CircleCheck, LogOut, Menu, Minimize2, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { TalentServLogo } from './TalentServLogo'
import { BlinkLogo } from './BlinkLogo'
import {
  WIZARD_PHASES,
  WIZARD_STEPS,
  canNavigateToStep,
  phaseForStep,
  phaseProgressLabel,
  stepAttention,
  type StepAttention,
} from '../wizard/steps'
import type { WizardState, WizardStep } from '../wizard/types'

const ICON_DONE = '#16a34a'
const ICON_ATTENTION = '#d97706'
const ICON_PENDING = '#94a3b8'
const ICON_ACTIVE = '#2563eb'

const ACCOUNT_OPEN_KEY = 'blink.accountFloat.open'
const ACCOUNT_HEIGHT_KEY = 'blink.accountFloat.height'
const ACCOUNT_MIN_H = 112
const ACCOUNT_MAX_H = 220
const ACCOUNT_DEFAULT_H = 132

interface Props {
  currentStep: WizardStep
  completedThrough: number
  generationComplete: boolean
  groomingUnlocked: boolean
  unrestrictedNav?: boolean
  state: WizardState
  onNavigate: (step: WizardStep) => void
}

function iconColor(attention: StepAttention): string {
  if (attention === 'done') return ICON_DONE
  if (attention === 'attention') return ICON_ATTENTION
  if (attention === 'active') return ICON_ACTIVE
  return ICON_PENDING
}

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] || email
  const parts = local.split(/[._\-+]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function WizardSidebar({
  currentStep,
  completedThrough,
  generationComplete,
  groomingUnlocked,
  unrestrictedNav = false,
  state,
  onNavigate,
}: Props) {
  const { session, signOut } = useAuth()
  const currentPhase = phaseForStep(currentStep)
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WIZARD_PHASES.map((p) => [p.id, p.id === currentPhase.id])),
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(() => {
    try {
      return localStorage.getItem(ACCOUNT_OPEN_KEY) !== '0'
    } catch {
      return true
    }
  })
  const [accountHeight, setAccountHeight] = useState(() => {
    try {
      const raw = Number(localStorage.getItem(ACCOUNT_HEIGHT_KEY))
      if (Number.isFinite(raw)) return Math.min(ACCOUNT_MAX_H, Math.max(ACCOUNT_MIN_H, raw))
    } catch {
      /* ignore */
    }
    return ACCOUNT_DEFAULT_H
  })
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => {
    setOpenPhases((prev) => ({ ...prev, [currentPhase.id]: true }))
  }, [currentPhase.id])

  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNT_OPEN_KEY, accountOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [accountOpen])

  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNT_HEIGHT_KEY, String(accountHeight))
    } catch {
      /* ignore */
    }
  }, [accountHeight])

  const progressLabel = useMemo(() => phaseProgressLabel(currentStep), [currentStep])
  const initials = useMemo(
    () => (session?.email ? initialsFromEmail(session.email) : '?'),
    [session?.email],
  )

  function togglePhase(phaseId: string) {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }))
  }

  function navigate(step: WizardStep) {
    onNavigate(step)
    setMobileOpen(false)
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    dragRef.current = { startY: event.clientY, startH: accountHeight }
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    // Drag up increases height (panel grows upward)
    const delta = dragRef.current.startY - event.clientY
    const next = Math.min(ACCOUNT_MAX_H, Math.max(ACCOUNT_MIN_H, dragRef.current.startH + delta))
    setAccountHeight(next)
  }

  function onResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return
    dragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  const navBody = (
    <nav className="nav-card">
      {WIZARD_PHASES.map((phase) => {
        const open = openPhases[phase.id] ?? phase.id === currentPhase.id
        const phaseActive = phase.id === currentPhase.id
        const phaseSteps = phase.stepIds
          .map((id) => WIZARD_STEPS.find((s) => s.id === id))
          .filter(Boolean)
        const doneCount = phase.stepIds.filter((id) => {
          const a = stepAttention(id, currentStep, completedThrough, generationComplete, state)
          return a === 'done'
        }).length
        const needsAttention = phase.stepIds.some(
          (id) => stepAttention(id, currentStep, completedThrough, generationComplete, state) === 'attention',
        )
        return (
          <div key={phase.id} className={`nav-phase${phaseActive ? ' is-active' : ''}${needsAttention ? ' needs-attention' : ''}`}>
            <button
              type="button"
              className="nav-phase-header"
              onClick={() => togglePhase(phase.id)}
              aria-expanded={open}
            >
              <span className="nav-phase-label">
                {phase.label}
                <span className="nav-phase-count">
                  {doneCount}/{phase.stepIds.length}
                </span>
              </span>
              <ChevronDown size={14} className={open ? 'chevron open' : 'chevron'} />
            </button>
            {open && (
              <ul className="nav-list">
                {phaseSteps.map((step) => {
                  if (!step) return null
                  const attention = stepAttention(
                    step.id,
                    currentStep,
                    completedThrough,
                    generationComplete,
                    state,
                  )
                  const clickable = canNavigateToStep(
                    step.id,
                    currentStep,
                    completedThrough,
                    groomingUnlocked,
                    unrestrictedNav,
                  )
                  const Icon =
                    attention === 'done'
                      ? CircleCheck
                      : attention === 'attention'
                        ? AlertCircle
                        : step.icon
                  return (
                    <li
                      key={step.id}
                      className={`nav-item ${attention} ${clickable ? 'clickable' : ''}`}
                      onClick={() => clickable && navigate(step.id)}
                      onKeyDown={(e) => e.key === 'Enter' && clickable && navigate(step.id)}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                    >
                      <Icon size={15} color={iconColor(attention)} strokeWidth={attention === 'done' ? 2.4 : 2} />
                      <span className="nav-label">{step.label}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )

  return (
    <>
      <div className="brand sidebar-brand">
        <div className="sidebar-brand-row">
          <TalentServLogo size="sm" />
          <span className="brand-divider" />
          <BlinkLogo size="sm" />
        </div>
      </div>

      <div className="sidebar-mobile-bar">
        <div className="sidebar-mobile-progress">
          <strong>{progressLabel}</strong>
          <span>{WIZARD_STEPS.find((s) => s.id === currentStep)?.label}</span>
        </div>
        <button
          type="button"
          className="ghost-btn sidebar-mobile-toggle"
          aria-label={mobileOpen ? 'Close steps' : 'Open steps'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div
        className={`sidebar-nav-wrap${mobileOpen ? ' is-open' : ''}${session ? (accountOpen ? ' has-account-panel' : ' has-account-chip') : ''}`}
      >
        {navBody}
      </div>

      {session && (
        <div className={`account-float${accountOpen ? ' is-open' : ' is-collapsed'}`}>
          {!accountOpen ? (
            <button
              type="button"
              className="account-float-chip"
              onClick={() => setAccountOpen(true)}
              title={session.email}
              aria-label="Open account"
            >
              <span className="account-avatar" aria-hidden="true">
                {initials}
              </span>
            </button>
          ) : (
            <div className="account-float-panel" style={{ height: accountHeight }}>
              <div
                className="account-float-resize"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize account panel"
                title="Drag to resize"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                onPointerCancel={onResizePointerUp}
              />
              <div className="account-float-head">
                <span className="account-avatar" aria-hidden="true">
                  {initials}
                </span>
                <div className="account-float-actions">
                  <button
                    type="button"
                    className="account-float-icon-btn"
                    onClick={() => setAccountOpen(false)}
                    title="Minimize"
                    aria-label="Minimize account"
                  >
                    <Minimize2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="account-float-icon-btn"
                    onClick={() => setAccountOpen(false)}
                    title="Close"
                    aria-label="Close account"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="account-float-body">
                <span className="account-float-label">Signed in</span>
                <span className="account-float-email" title={session.email}>
                  {session.email}
                </span>
              </div>
              <button type="button" className="account-float-signout" onClick={signOut}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export { STEP_ORDER } from '../wizard/steps'
