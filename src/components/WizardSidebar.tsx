import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertCircle,
  ChevronDown,
  CircleCheck,
  Code2,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useDeveloperMode } from '../developer/DeveloperModeContext'
import { openDeveloperPopup } from '../developer/window'
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

const ACCOUNT_OPEN_KEY = 'blink.accountFloat.open.v2'
const ACCOUNT_HEIGHT_KEY = 'blink.accountFloat.height'
const SIDEBAR_OPEN_KEY = 'blink.sidebar.open'
const SIDEBAR_WIDTH_KEY = 'blink.sidebar.width'

const ACCOUNT_MIN_H = 132
const ACCOUNT_MAX_H = 220
const ACCOUNT_DEFAULT_H = 148
const SIDEBAR_MIN_W = 200
const SIDEBAR_MAX_W = 420
const SIDEBAR_DEFAULT_W = 272
const SIDEBAR_COLLAPSED_W = 56

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

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === '1'
  } catch {
    return fallback
  }
}

function readNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = Number(localStorage.getItem(key))
    if (Number.isFinite(raw)) return Math.min(max, Math.max(min, raw))
  } catch {
    /* ignore */
  }
  return fallback
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
  const { state: developerState } = useDeveloperMode()
  const currentPhase = phaseForStep(currentStep)
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WIZARD_PHASES.map((p) => [p.id, p.id === currentPhase.id])),
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => readBool(SIDEBAR_OPEN_KEY, true))
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readNumber(SIDEBAR_WIDTH_KEY, SIDEBAR_DEFAULT_W, SIDEBAR_MIN_W, SIDEBAR_MAX_W),
  )
  // Default minimized; only expand if user previously chose open ('1')
  const [accountOpen, setAccountOpen] = useState(() => readBool(ACCOUNT_OPEN_KEY, false))
  const [accountHeight, setAccountHeight] = useState(() =>
    readNumber(ACCOUNT_HEIGHT_KEY, ACCOUNT_DEFAULT_H, ACCOUNT_MIN_H, ACCOUNT_MAX_H),
  )
  const accountDragRef = useRef<{ startY: number; startH: number } | null>(null)
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null)

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

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarOpen])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
    } catch {
      /* ignore */
    }
  }, [sidebarWidth])

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

  function onAccountResizeDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    accountDragRef.current = { startY: event.clientY, startH: accountHeight }
  }

  function onAccountResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!accountDragRef.current) return
    const delta = accountDragRef.current.startY - event.clientY
    setAccountHeight(
      Math.min(ACCOUNT_MAX_H, Math.max(ACCOUNT_MIN_H, accountDragRef.current.startH + delta)),
    )
  }

  function onAccountResizeUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!accountDragRef.current) return
    accountDragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  function onSidebarResizeDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!sidebarOpen) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    sidebarDragRef.current = { startX: event.clientX, startW: sidebarWidth }
    document.body.classList.add('is-resizing-sidebar')
  }

  function onSidebarResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!sidebarDragRef.current) return
    const delta = event.clientX - sidebarDragRef.current.startX
    setSidebarWidth(
      Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, sidebarDragRef.current.startW + delta)),
    )
  }

  function onSidebarResizeUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!sidebarDragRef.current) return
    sidebarDragRef.current = null
    document.body.classList.remove('is-resizing-sidebar')
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  const railIcons = WIZARD_STEPS.filter((s) => s.id !== 'welcome')

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
          <div
            key={phase.id}
            className={`nav-phase${phaseActive ? ' is-active' : ''}${needsAttention ? ' needs-attention' : ''}`}
          >
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

  const width = sidebarOpen ? sidebarWidth : SIDEBAR_COLLAPSED_W

  return (
    <aside
      className={`sidebar${sidebarOpen ? '' : ' is-collapsed'}${mobileOpen ? ' is-mobile-open' : ''}`}
      style={{
        width,
        ['--sidebar-width' as string]: `${width}px`,
        ['--account-panel-h' as string]: `${accountHeight}px`,
      }}
      aria-label="SDLC steps"
    >
      <div className="sidebar-chrome">
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Minimize sidebar' : 'Expand sidebar'}
          aria-label={sidebarOpen ? 'Minimize sidebar' : 'Expand sidebar'}
          aria-pressed={!sidebarOpen}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
        <div className="brand sidebar-brand">
          {sidebarOpen ? (
            <div className="sidebar-brand-row">
              <TalentServLogo size="sm" />
              <span className="brand-divider" />
              <BlinkLogo size="sm" />
            </div>
          ) : null}
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

      {sidebarOpen ? (
        <div
          className={`sidebar-nav-wrap${mobileOpen ? ' is-open' : ''}${session ? (accountOpen ? ' has-account-panel' : ' has-account-chip') : ''}`}
        >
          {navBody}
        </div>
      ) : (
        <nav className="sidebar-rail" aria-label="SDLC step icons">
          {railIcons.map((step) => {
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
              <button
                key={step.id}
                type="button"
                className={`sidebar-rail-btn ${attention}${clickable ? ' clickable' : ''}`}
                title={step.label}
                aria-label={step.label}
                aria-current={attention === 'active' ? 'step' : undefined}
                disabled={!clickable}
                onClick={() => clickable && navigate(step.id)}
              >
                <Icon size={16} color={iconColor(attention)} strokeWidth={attention === 'done' ? 2.4 : 2} />
              </button>
            )
          })}
        </nav>
      )}

      {session && (
        <div className={`account-float${accountOpen && sidebarOpen ? ' is-open' : ' is-collapsed'}`}>
          {!accountOpen || !sidebarOpen ? (
            <div className="account-float-collapsed">
              <button
                type="button"
                className="account-float-chip"
                onClick={() => {
                  if (!sidebarOpen) setSidebarOpen(true)
                  setAccountOpen(true)
                }}
                title={session.email}
                aria-label="Open account"
              >
                <span className="account-avatar" aria-hidden="true">
                  {initials}
                </span>
              </button>
              <button
                type="button"
                className={`account-dev-btn${developerState.enabled ? ' is-on' : ''}`}
                onClick={() => openDeveloperPopup()}
                title="Developer tools (Ctrl+Shift+D)"
                aria-label="Open developer tools"
              >
                <Code2 size={14} strokeWidth={2.25} />
              </button>
            </div>
          ) : (
            <div className="account-float-panel" style={{ minHeight: accountHeight }}>
              <div
                className="account-float-resize"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize account panel"
                title="Drag to resize"
                onPointerDown={onAccountResizeDown}
                onPointerMove={onAccountResizeMove}
                onPointerUp={onAccountResizeUp}
                onPointerCancel={onAccountResizeUp}
              />
              <div className="account-float-head">
                <span className="account-avatar" aria-hidden="true">
                  {initials}
                </span>
                <div className="account-float-identity">
                  <span className="account-float-label">Signed in</span>
                  <span className="account-float-email" title={session.email}>
                    {session.email}
                  </span>
                </div>
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
              <div className="account-float-footer">
                <button
                  type="button"
                  className={`account-float-dev${developerState.enabled ? ' is-on' : ''}`}
                  onClick={() => openDeveloperPopup()}
                >
                  <Code2 size={14} strokeWidth={2.25} /> Developer tools
                </button>
                <button type="button" className="account-float-signout" onClick={signOut}>
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className="sidebar-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        title={sidebarOpen ? 'Drag to resize' : 'Expand sidebar'}
        onDoubleClick={() => setSidebarOpen((v) => !v)}
        onPointerDown={onSidebarResizeDown}
        onPointerMove={onSidebarResizeMove}
        onPointerUp={onSidebarResizeUp}
        onPointerCancel={onSidebarResizeUp}
      />
    </aside>
  )
}

export { STEP_ORDER } from '../wizard/steps'
