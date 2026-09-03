import { TalentServLogo } from './TalentServLogo'
import { BlinkLogo } from './BlinkLogo'
import { STEP_ORDER, WIZARD_STEPS, canNavigateToStep, stepIndex } from '../wizard/steps'
import type { WizardStep } from '../wizard/types'

interface Props {
  currentStep: WizardStep
  completedThrough: number
  generationComplete: boolean
  groomingUnlocked: boolean
  onNavigate: (step: WizardStep) => void
}

export function WizardSidebar({
  currentStep,
  completedThrough,
  generationComplete,
  groomingUnlocked,
  onNavigate,
}: Props) {
  const generationIdx = stepIndex('generation')
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
            const skipped = generationComplete && idx > completedThrough && idx < generationIdx
            const isDone =
              !skipped &&
              !isActive &&
              (idx <= completedThrough || (generationComplete && step.id === 'generation'))
            const clickable = canNavigateToStep(step.id, currentStep, completedThrough, groomingUnlocked)
            const Icon = step.icon
            return (
              <li
                key={step.id}
                className={`nav-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${skipped ? 'skipped' : ''} ${clickable ? 'clickable' : ''}`}
                onClick={() => clickable && onNavigate(step.id)}
                onKeyDown={(e) => e.key === 'Enter' && clickable && onNavigate(step.id)}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
              >
                <Icon size={14} color={skipped ? '#94a3b8' : step.iconColor} />
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
