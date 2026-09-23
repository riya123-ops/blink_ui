import { useState } from 'react'
import {
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
import { ConfirmDialog } from '../components/ConfirmDialog'
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
          <div className="project-cards is-resume">
            <button type="button" className="project-card is-featured" onClick={onResume}>
              <div className="project-card-icon">
                <Play size={28} strokeWidth={1.75} />
              </div>
              <h3>Continue {resume.projectName}</h3>
              <p>Resume at {resume.stepLabel}</p>
            </button>
            <button type="button" className="project-card" onClick={() => onContinue('existing')}>
              <div className="project-card-icon">
                <FolderSearch size={28} strokeWidth={1.75} />
              </div>
              <h3>Existing project</h3>
              <p>Use a project you already have</p>
            </button>
            <button type="button" className="project-card" onClick={() => setConfirmStartOver(true)}>
              <div className="project-card-icon">
                <FolderPlus size={28} strokeWidth={1.75} />
              </div>
              <h3>Start over</h3>
              <p>Leave this draft and begin a new project</p>
            </button>
          </div>
        ) : (
          <div className="project-cards">
            <button type="button" className="project-card" onClick={onStartNew}>
              <div className="project-card-icon">
                <FolderPlus size={28} strokeWidth={1.75} />
              </div>
              <h3>New project</h3>
              <p>Start from scratch</p>
            </button>
            <button type="button" className="project-card" onClick={() => onContinue('existing')}>
              <div className="project-card-icon">
                <FolderSearch size={28} strokeWidth={1.75} />
              </div>
              <h3>Existing project</h3>
              <p>Use a project you already have</p>
            </button>
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
        <ConfirmDialog
          title="Start over?"
          copy="This leaves the current draft and starts a new project."
          confirmLabel="Start over"
          titleId="start-over-title"
          copyId="start-over-copy"
          onCancel={() => setConfirmStartOver(false)}
          onConfirm={() => {
            setConfirmStartOver(false)
            onStartNew()
          }}
        />
      )}
    </div>
  )
}
