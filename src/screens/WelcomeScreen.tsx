import {
  ArrowRight,
  ClipboardList,
  FileText,
  FolderPlus,
  FolderSearch,
  Link2,
  Play,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { SessionControls } from '../components/SessionControls'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  resume: { projectName: string; stepLabel: string } | null
  onContinue: (type: 'new' | 'existing') => void
  onResume: () => void
  onStartNew: () => void
}

const FLOW = [
  { icon: Users, label: 'People', desc: 'Stakeholders and owners' },
  { icon: Link2, label: 'Tools', desc: 'Jira, GitHub, the stack' },
  { icon: FileText, label: 'Wording', desc: 'Requirements you can agree on' },
  { icon: ClipboardList, label: 'Tickets', desc: 'A plan the team can run' },
  { icon: Rocket, label: 'Ship', desc: 'Repos, kit, and handoff' },
]

export function WelcomeScreen({ state, resume, onContinue, onResume, onStartNew }: Props) {
  return (
    <div className="welcome-page">
      <AppHeader end={<SessionControls />} />

      <div className="welcome-body">
        <div className="welcome-headline">
          <h1>
            Welcome to <span className="gradient-text">Blink</span>
          </h1>
          <p className="welcome-tagline">From people to ship</p>
          <p className="welcome-desc">
            Bring the team, tools, and wording together, then leave with tickets you can ship.
          </p>
        </div>

        {resume ? (
          <div className="resume-hero">
            <p className="resume-kicker">Draft in progress</p>
            <h2>Continue {resume.projectName}</h2>
            <p className="resume-hero-copy">Pick up at {resume.stepLabel}.</p>
            <div className="resume-hero-actions">
              <button type="button" className="primary-btn" onClick={onResume}>
                Continue project <Play size={16} />
              </button>
              <button type="button" className="ghost-btn" onClick={onStartNew}>
                Start over
              </button>
            </div>
            <p className="resume-alt">
              Or{' '}
              <button type="button" className="mini-btn" onClick={() => onContinue('existing')}>
                set up an existing project
              </button>
            </p>
          </div>
        ) : (
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
        )}

        <ol className="welcome-flow" aria-label="How Blink works">
          {FLOW.map(({ icon: Icon, label, desc }) => (
            <li className="welcome-flow-step" key={label}>
              <span className="welcome-flow-icon">
                <Icon size={18} />
              </span>
              <div>
                <strong>{label}</strong>
                <span>{desc}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <footer className="welcome-footer">
        <span className="footer-trust">
          <ShieldCheck size={14} /> Secure • Scalable • Smart
        </span>
        <span className="footer-copy">© {new Date().getFullYear()} TalentServ. All rights reserved.</span>
      </footer>
    </div>
  )
}
