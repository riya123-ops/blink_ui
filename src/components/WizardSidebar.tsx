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
      <svg className="sidebar-wave" viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 120 Q80 80 160 110 T320 90 L320 200 L0 200 Z" fill="url(#sidebarBlue)" />
        <path d="M0 150 Q100 120 200 140 T320 130 L320 200 L0 200 Z" fill="url(#sidebarGreen)" opacity="0.7" />
        <defs>
          <linearGradient id="sidebarBlue" x1="0" y1="90" x2="320" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" stopOpacity="0.12" />
            <stop offset="1" stopColor="#06b6d4" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="sidebarGreen" x1="0" y1="120" x2="320" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" stopOpacity="0.1" />
            <stop offset="1" stopColor="#34d399" stopOpacity="0.04" />
          </linearGradient>
        </defs>
      </svg>

      <div className="brand sidebar-brand">
        <BlinkLogo size="md" />
        <span className="brand-tag">AI-Powered SDLC Platform</span>
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
