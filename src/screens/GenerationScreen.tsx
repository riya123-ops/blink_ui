import { CheckCircle2, Circle, Download, Loader2, XCircle } from 'lucide-react'
import { IDE_TOOL_OPTIONS, ideOverlayPath } from '../wizard/defaults'
import type { GenerationStep, WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  loading: boolean
  onGenerate: () => void
  onDownloadAgain: () => void
}

function StepIcon({ status }: { status: GenerationStep['status'] }) {
  if (status === 'done') return <CheckCircle2 size={16} className="step-icon done" />
  if (status === 'running') return <Loader2 size={16} className="step-icon running" />
  if (status === 'error') return <XCircle size={16} className="step-icon error" />
  return <Circle size={16} className="step-icon pending" />
}

export function GenerationScreen({ state, loading, onGenerate, onDownloadAgain }: Props) {
  const started = state.generationSteps.length > 0

  return (
    <div className="screen">
      <section className="card">
        <div className="card-header">
          <Download size={16} />
          <h3>Generation &amp; Download</h3>
        </div>

        {!started && (
          <div className="generation-intro">
            <p>
              Generate a full workspace with <strong>Java Spring Boot</strong> backend and{' '}
              <strong>React + TypeScript + Vite</strong> frontend, including AI-SDLC framework overlay.
            </p>
            <ul className="output-list">
              <li>Project structure &amp; package layout</li>
              <li>Build configuration (Gradle/Maven + Vite)</li>
              <li>Application configuration (YAML/Properties)</li>
              <li>Spring Boot starter + React scaffold</li>
              <li>AI-SDLC workspace overlay &amp; {IDE_TOOL_OPTIONS.find((o) => o.id === state.ideTool)?.label ?? 'Cursor'} commands</li>
            </ul>
            <button type="button" className="primary-btn" disabled={loading} onClick={onGenerate}>
              {loading ? 'Generating…' : 'Generate Project'}
            </button>
          </div>
        )}

        {started && (
          <>
            <div className="generation-steps">
              {state.generationSteps.map((step) => (
                <div className={`gen-step ${step.status}`} key={step.id}>
                  <StepIcon status={step.status} />
                  <span>{step.label}</span>
                </div>
              ))}
            </div>

            {state.generationComplete && (
              <div className="generation-complete">
                <div className="status-banner success">
                  Project generated successfully. Extract the ZIP to start development.
                </div>
                <button type="button" className="primary-btn" onClick={onDownloadAgain}>
                  <Download size={14} />
                  Download Again
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {state.generationComplete && (
        <section className="card">
          <div className="card-header">
            <h3>Generated Output</h3>
          </div>
          <div className="output-tree">
            <div><strong>{state.artifactName}-workspace/</strong></div>
            <div className="tree-indent">├── automation_sdlc/</div>
            <div className="tree-indent">├── {ideOverlayPath(state.ideTool)}</div>
            <div className="tree-indent">├── {state.artifactName}-api/ <span className="muted">(Spring Boot {state.springBootVersion})</span></div>
            <div className="tree-indent">└── {state.artifactName}-web/ <span className="muted">(React + TS + Vite)</span></div>
          </div>
        </section>
      )}
    </div>
  )
}
