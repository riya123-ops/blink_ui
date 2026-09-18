import { useState } from 'react'
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
  { icon: Users, label: 'Stakeholders', desc: 'Who is in the loop' },
  { icon: Link2, label: 'Integrations', desc: 'Jira, GitHub, and tools' },
  { icon: FileText, label: 'Requirements', desc: 'What you are building' },
  { icon: ClipboardList, label: 'Work plan', desc: 'Work the team can run' },
  { icon: Rocket, label: 'Ship', desc: 'Repos and handoff' },
]

export function WelcomeScreen({ resume, onContinue, onResume, onStartNew }: Props) {
  const [confirmStartOver, setConfirmStartOver] = useState(false)

  return (
    <div className="welcome-page">
      <AppHeader end={<SessionControls />} />

      <div className="welcome-body">
        <div className="welcome-headline">
          <h1>
            Welcome to <span className="gradient-text">Blink</span>
          </h1>
          <p className="welcome-desc">
            Set up the project and stakeholders, then work through a plan you can ship.
          </p>
        </div>

        {resume ? (
          <div className="resume-hero">
            <p className="resume-kicker">Draft in progress</p>
            <h2>Continue {resume.projectName}</h2>
            <p className="resume-hero-copy">Resume at {resume.stepLabel}.</p>
            <div className="resume-hero-actions">
              <button type="button" className="primary-btn" onClick={onResume}>
                Continue <Play size={16} />
              </button>
              <button type="button" className="secondary-btn" onClick={() => onContinue('existing')}>
                Existing project
              </button>
              <button type="button" className="ghost-btn" onClick={() => setConfirmStartOver(true)}>
                Start over
              </button>
            </div>
          </div>
        ) : (
          <div className="project-cards">
            <article className="project-card">
              <div className="project-card-icon">
                <FolderPlus size={28} strokeWidth={1.75} />
              </div>
              <h3>New project</h3>
              <p>Start from scratch</p>
              <button type="button" className="primary-btn" onClick={onStartNew}>
                Start <ArrowRight size={16} />
              </button>
            </article>

            <article className="project-card">
              <div className="project-card-icon">
                <FolderSearch size={28} strokeWidth={1.75} />
              </div>
              <h3>Existing project</h3>
              <p>Use a project you already have</p>
              <button type="button" className="secondary-btn" onClick={() => onContinue('existing')}>
                Open <ArrowRight size={16} />
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

      {confirmStartOver && (
        <div className="modal-backdrop" onClick={() => setConfirmStartOver(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="start-over-title"
            aria-describedby="start-over-copy"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="start-over-title">Start over?</h3>
            <p id="start-over-copy">This leaves the current draft and starts a new project.</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-btn" autoFocus onClick={() => setConfirmStartOver(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={() => {
                  setConfirmStartOver(false)
                  onStartNew()
                }}
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
