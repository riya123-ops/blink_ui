import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, CircleCheck, LogOut, Menu, X } from 'lucide-react'
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
const ICON_ACTIVE = '#0066cc'

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

  useEffect(() => {
    setOpenPhases((prev) => ({ ...prev, [currentPhase.id]: true }))
  }, [currentPhase.id])

  const progressLabel = useMemo(() => phaseProgressLabel(currentStep), [currentStep])

  function togglePhase(phaseId: string) {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: !prev[phaseId] }))
  }

  function navigate(step: WizardStep) {
    onNavigate(step)
    setMobileOpen(false)
  }

  const navBody = (
    <>
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
      {session && (
        <div className="sidebar-session">
          <span className="sidebar-session-email" title={session.email}>
            {session.email}
          </span>
          <button type="button" className="ghost-btn sidebar-signout" onClick={signOut}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      )}
    </>
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

      <div className={`sidebar-nav-wrap${mobileOpen ? ' is-open' : ''}`}>{navBody}</div>
    </>
  )
}

export { STEP_ORDER } from '../wizard/steps'
