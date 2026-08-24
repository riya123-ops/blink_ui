import { TalentServLogo } from './TalentServLogo'
import { BlinkLogo } from './BlinkLogo'
import { STEP_ORDER, WIZARD_STEPS, canNavigateToStep, stepIndex } from '../wizard/steps'
import type { WizardStep } from '../wizard/types'

interface Props {
  currentStep: WizardStep
  completedThrough: number
  onNavigate: (step: WizardStep) => void
}

export function WizardSidebar({ currentStep, completedThrough, onNavigate }: Props) {
  return (
    <>
      <div className="brand sidebar-brand">
        <div className="sidebar-brand-row">
          <TalentServLogo size="sm" />
          <span className="brand-divider" />
          <BlinkLogo size="sm" />
        </div>
      </div>

      <nav className="nav-card">
        <ul className="nav-list">
          {WIZARD_STEPS.map((step) => {
            const idx = stepIndex(step.id)
            const isActive = currentStep === step.id
            const isDone = idx < stepIndex(currentStep) || idx <= completedThrough
            const clickable = canNavigateToStep(step.id, currentStep, completedThrough)
            const Icon = step.icon
            return (
              <li
                key={step.id}
                className={`nav-item ${isActive ? 'active' : ''} ${isDone && !isActive ? 'done' : ''} ${clickable ? 'clickable' : ''}`}
                onClick={() => clickable && onNavigate(step.id)}
                onKeyDown={(e) => e.key === 'Enter' && clickable && onNavigate(step.id)}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
              >
                <span className="step-num">{isDone && !isActive ? '✓' : step.number}</span>
                <Icon size={14} />
                <span className="nav-label">{step.label}</span>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}

export { STEP_ORDER }
