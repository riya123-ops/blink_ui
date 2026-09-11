import { CircleCheck } from 'lucide-react'
import { TalentServLogo } from './TalentServLogo'
import { BlinkLogo } from './BlinkLogo'
import { STEP_ORDER, WIZARD_STEPS, canNavigateToStep, stepIndex } from '../wizard/steps'
import type { WizardStep } from '../wizard/types'

const ICON_DONE = '#16a34a'
const ICON_PENDING = '#94a3b8'

interface Props {
  currentStep: WizardStep
  completedThrough: number
  generationComplete: boolean
  groomingUnlocked: boolean
  unrestrictedNav?: boolean
  onNavigate: (step: WizardStep) => void
}

export function WizardSidebar({
  currentStep,
  completedThrough,
  generationComplete,
  groomingUnlocked,
  unrestrictedNav = false,
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
              !skipped && (idx <= completedThrough || (generationComplete && step.id === 'generation'))
            const clickable = canNavigateToStep(
              step.id,
              currentStep,
              completedThrough,
              groomingUnlocked,
              unrestrictedNav,
            )
            const Icon = isDone ? CircleCheck : step.icon
            return (
              <li
                key={step.id}
                className={`nav-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${skipped ? 'skipped' : ''} ${clickable ? 'clickable' : ''}`}
                onClick={() => clickable && onNavigate(step.id)}
                onKeyDown={(e) => e.key === 'Enter' && clickable && onNavigate(step.id)}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
              >
                <Icon size={15} color={isDone ? ICON_DONE : ICON_PENDING} strokeWidth={isDone ? 2.4 : 2} />
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
