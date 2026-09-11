import { ArrowRight, CheckCircle2, FolderPlus, FolderSearch, Layers, LogOut, Play, Rocket, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { AppHeader } from '../components/AppHeader'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  resume: { projectName: string; stepLabel: string } | null
  onContinue: (type: 'new' | 'existing') => void
  onResume: () => void
  onStartNew: () => void
}

const FEATURES = [
  { icon: Rocket, label: 'Faster Setup', desc: 'Initialize projects in minutes', color: 'blue' },
  { icon: ShieldCheck, label: 'Best Practices', desc: 'Industry standard templates', color: 'green' },
  { icon: Layers, label: 'Flexible Stack', desc: 'Support for modern technologies', color: 'blue' },
  { icon: CheckCircle2, label: 'Consistent Quality', desc: 'Built-in guidelines and structure', color: 'green' },
]

export function WelcomeScreen({ state, resume, onContinue, onResume, onStartNew }: Props) {
  const { session, signOut } = useAuth()
  return (
    <div className="welcome-page">
      <AppHeader
        end={
          session ? (
            <div className="header-session">
              <span>{session.email}</span>
              <button type="button" className="ghost-btn header-signout" onClick={signOut}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          ) : null
        }
      />

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

        {resume ? (
          <div className="resume-banner">
            <div>
              <strong>Continue {resume.projectName}</strong>
              <span>Pick up at {resume.stepLabel}</span>
            </div>
            <div className="resume-banner-actions">
              <button type="button" className="card-cta blue" onClick={onResume}>
                Continue <Play size={16} />
              </button>
              <button type="button" className="ghost-btn" onClick={onStartNew}>
                Start over
              </button>
            </div>
          </div>
        ) : null}

        <div className="project-cards">
          <article
            className={`project-card blue ${state.projectType === 'new' ? 'selected' : ''}`}
            onClick={() => onStartNew()}
            onKeyDown={(e) => e.key === 'Enter' && onStartNew()}
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
                onStartNew()
              }}
            >
              Get Started <ArrowRight size={16} />
            </button>
          </article>

          <article
            className={`project-card green ${state.projectType === 'existing' ? 'selected' : ''}`}
            onClick={() => onContinue('existing')}
            onKeyDown={(e) => e.key === 'Enter' && onContinue('existing')}
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
        <span className="footer-copy">© 2024 TalentServ. All rights reserved.</span>
      </footer>
    </div>
  )
}
