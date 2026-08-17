import { ArrowRight, CheckCircle2, FolderPlus, FolderSearch, Layers, Rocket, ShieldCheck } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onSelectType: (type: 'new' | 'existing') => void
  onContinue: (type: 'new' | 'existing') => void
}

const FEATURES = [
  { icon: Rocket, label: 'Faster Setup', desc: 'Launch in minutes', color: 'blue' },
  { icon: ShieldCheck, label: 'Best Practices', desc: 'Built-in standards', color: 'green' },
  { icon: Layers, label: 'Flexible Stack', desc: 'Any technology', color: 'blue' },
  { icon: CheckCircle2, label: 'Consistent Quality', desc: 'Every project', color: 'green' },
]

export function WelcomeScreen({ state, onSelectType, onContinue }: Props) {
  return (
    <div className="welcome-page">
      <div className="welcome-bg" aria-hidden="true">
        <div className="wave wave-blue" />
        <div className="wave wave-green" />
        <div className="circuit-pattern" />
      </div>

      <AppHeader />

      <div className="welcome-body">
        <div className="welcome-headline">
          <h1>
            Welcome to <span className="gradient-text">Blink</span>
          </h1>
          <p className="welcome-tagline">Project Initializer</p>
          <p className="welcome-desc">
            Kickstart your projects in seconds with the right stack, structure and best practices.
          </p>
        </div>

        <div className="project-cards">
          <article
            className={`project-card blue ${state.projectType === 'new' ? 'selected' : ''}`}
            onClick={() => onSelectType('new')}
            onKeyDown={(e) => e.key === 'Enter' && onSelectType('new')}
            role="button"
            tabIndex={0}
          >
            <div className="project-card-icon blue">
              <FolderPlus size={28} strokeWidth={1.75} />
            </div>
            <h3>New Project</h3>
            <p>Create a new project from scratch</p>
            <button
              type="button"
              className="card-cta blue"
              onClick={(e) => {
                e.stopPropagation()
                onContinue('new')
              }}
            >
              Get Started <ArrowRight size={16} />
            </button>
          </article>

          <article
            className={`project-card green ${state.projectType === 'existing' ? 'selected' : ''}`}
            onClick={() => onSelectType('existing')}
            onKeyDown={(e) => e.key === 'Enter' && onSelectType('existing')}
            role="button"
            tabIndex={0}
          >
            <div className="project-card-icon green">
              <FolderSearch size={28} strokeWidth={1.75} />
            </div>
            <h3>Existing Project</h3>
            <p>Configure and enhance an existing project</p>
            <button
              type="button"
              className="card-cta green"
              onClick={(e) => {
                e.stopPropagation()
                onContinue('existing')
              }}
            >
              Open Project <ArrowRight size={16} />
            </button>
          </article>
        </div>

        <div className="feature-bar">
          {FEATURES.map(({ icon: Icon, label, desc, color }) => (
            <div className={`feature-item ${color}`} key={label}>
              <span className="feature-icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>{label}</strong>
                <span>{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="welcome-footer">
        <span className="footer-trust">
          <ShieldCheck size={14} /> Secure • Scalable • Smart
        </span>
        <span className="footer-copy">© 2026 TalentServ. All rights reserved.</span>
      </footer>
    </div>
  )
}
