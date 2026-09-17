import { useEffect, useMemo, useRef, useState } from 'react'
import { CloudUpload, FileUp, GitBranch, Link2 } from 'lucide-react'
import type { WizardState, WizardStep } from '../wizard/types'
import { GroomingPanel } from './GroomRequirementScreen'
import { JiraScopePanel } from './JiraScopePanel'
import { ScopeStartStatus, validateSdlcScope } from './SdlcPlanningScreen'
import { unansweredRequired } from '../wizard/grooming'

type ReqStage = 'capture' | 'clarify' | 'tickets'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  grooming?: boolean
  onAsk?: () => void
  onPick?: (questionId: string, optionId: string, optionLabel: string) => void
  onOther?: (questionId: string, text: string) => void
  onToggleOther?: (questionId: string, checked: boolean) => void
  onUseWording?: () => void
  onStartOver?: () => void
  onNavigate?: (step: WizardStep) => void
}

function handleFile(file: File | undefined, onUpdate: Props['onUpdate']) {
  if (!file) return
  onUpdate({ requirementFileName: file.name, requirementFile: file, requirementsText: '' })
}

function clearFile(onUpdate: Props['onUpdate'], fileInputRef: React.RefObject<HTMLInputElement | null>) {
  onUpdate({ requirementFileName: null, requirementFile: null, requirementsText: '' })
  if (fileInputRef.current) fileInputRef.current.value = ''
}

function deriveStage(state: WizardState): ReqStage {
  if (state.groomConfirmed) return 'tickets'
  if (
    state.groomQuestions.length > 0 ||
    state.groomStatus === 'draft_ready' ||
    state.groomStatus === 'need_choices' ||
    state.groomStatus === 'error'
  ) {
    return 'clarify'
  }
  return 'capture'
}

export function RequirementsScreen({
  state,
  onUpdate,
  grooming,
  onAsk,
  onPick,
  onOther,
  onToggleOther,
  onUseWording,
  onStartOver,
  onNavigate,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const hasUploadedFile = Boolean(state.requirementFileName)
  const hasPaste = Boolean(state.requirementsText.trim())
  const pasteLocked =
    !state.groomConfirmed &&
    (state.groomQuestions.length > 0 || state.groomStatus === 'draft_ready' || state.groomStatus === 'need_choices')

  const autoStage = useMemo(() => deriveStage(state), [state])
  const [stage, setStage] = useState<ReqStage>(autoStage)

  useEffect(() => {
    setStage(autoStage)
  }, [autoStage])

  useEffect(() => {
    if (state.requirementFileName && state.requirementsText.trim()) {
      onUpdate({ requirementsText: '' })
    }
  }, [state.requirementFileName, state.requirementsText, onUpdate])

  useEffect(() => {
    const el = pasteRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [state.requirementsText, hasUploadedFile])

  const stages: { id: ReqStage; label: string; hint: string; enabled: boolean }[] = [
    { id: 'capture', label: '1. Capture', hint: 'Upload or paste', enabled: true },
    {
      id: 'clarify',
      label: '2. Clarify',
      hint: 'Answer or Jira later',
      enabled: hasPaste || state.groomQuestions.length > 0,
    },
    {
      id: 'tickets',
      label: '3. Tickets',
      hint: 'Epics & stories',
      enabled: state.groomConfirmed || Boolean(state.requirementFileName && !hasPaste),
    },
  ]

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Requirements</h2>
        <p>Capture wording, clarify gaps, then create tickets. Blink locks scope and starts the SDLC here — no extra tab.</p>
      </div>

      <div className="req-stage-tabs" role="tablist" aria-label="Requirements stages">
        {stages.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={stage === item.id}
            className={`req-stage-tab${stage === item.id ? ' active' : ''}`}
            disabled={!item.enabled}
            onClick={() => item.enabled && setStage(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>

      {stage === 'capture' && (
        <section className="card ref-card">
          <div
            className="req-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFile(e.dataTransfer.files[0], onUpdate)
            }}
          >
            <CloudUpload size={36} strokeWidth={1.5} />
            <p className="dropzone-title">Drag &amp; drop your requirement document here</p>
            <p className="dropzone-sub">PDF, DOCX, TXT, MD supported</p>
            <button
              type="button"
              className="browse-btn"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Browse Files
            </button>
            {state.requirementFileName && (
              <span className="file-badge">
                {state.requirementFileName}
                <button
                  type="button"
                  className="file-badge-clear"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFile(onUpdate, fileInputRef)
                  }}
                >
                  ×
                </button>
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0], onUpdate)}
            />
          </div>

          {!hasUploadedFile && (
            <>
              <div className="or-divider">
                <span>OR</span>
              </div>
              <div className="field-group">
                <label htmlFor="requirementsText">Paste Requirements</label>
                <p className="field-hint">
                  {pasteLocked
                    ? 'Your paste is locked while you answer. Start over if you need to change it.'
                    : 'Use this only if you don’t have a requirement document to upload.'}
                </p>
                <textarea
                  ref={pasteRef}
                  id="requirementsText"
                  className={`req-textarea${pasteLocked ? ' locked' : ''}`}
                  rows={8}
                  placeholder="Paste your requirements here…"
                  value={state.requirementsText}
                  readOnly={pasteLocked}
                  onChange={(e) =>
                    onUpdate({
                      requirementsText: e.target.value,
                      requirementFileName: null,
                      requirementFile: null,
                    })
                  }
                />
              </div>
            </>
          )}

          {hasPaste && (
            <div className="card-footer-actions right">
              <button type="button" className="secondary-btn" onClick={() => setStage('clarify')}>
                Clarify wording
              </button>
            </div>
          )}

          <details className="req-optional-source">
            <summary>
              Existing application <span className="optional-tag">Optional</span>
            </summary>
            <div className="source-cards ref">
              <button
                type="button"
                className={`source-card ${state.existingSourceMode === 'zip' ? 'active' : ''}`}
                onClick={() => onUpdate({ existingSourceMode: 'zip' })}
              >
                <FileUp size={22} />
                <strong>Upload ZIP</strong>
                <span>Existing project archive</span>
              </button>
              <button
                type="button"
                className={`source-card ${state.existingSourceMode === 'git' ? 'active' : ''}`}
                onClick={() => onUpdate({ existingSourceMode: 'git' })}
              >
                <GitBranch size={22} />
                <strong>Git Repository</strong>
                <span>GitHub / GitLab</span>
              </button>
              <button type="button" className="source-card disabled" disabled title="Coming soon">
                <Link2 size={22} />
                <strong>Connect Repository</strong>
                <span>Azure / Bitbucket</span>
              </button>
            </div>
            {state.existingSourceMode === 'zip' && (
              <div className="upload-zone compact" onClick={() => zipInputRef.current?.click()}>
                <span>{state.sourceZipName ?? 'Click to upload project ZIP'}</span>
                <input
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  hidden
                  onChange={(e) => onUpdate({ sourceZipName: e.target.files?.[0]?.name ?? null })}
                />
              </div>
            )}
            {state.existingSourceMode === 'git' && (
              <input
                className="full-input"
                placeholder="https://github.com/org/repo"
                value={state.gitRepositoryUrl}
                onChange={(e) => onUpdate({ gitRepositoryUrl: e.target.value })}
              />
            )}
          </details>
        </section>
      )}

      {stage === 'clarify' && hasPaste && onAsk && onPick && onOther && onToggleOther && onUseWording && onStartOver && (
        <section className="card ref-card">
          <GroomingPanel
            state={state}
            loading={Boolean(grooming)}
            onAsk={onAsk}
            onPick={onPick}
            onOther={onOther}
            onToggleOther={onToggleOther}
            onUseWording={onUseWording}
            onStartOver={onStartOver}
            onUpdate={onUpdate}
            onNavigate={onNavigate}
            showJiraPanel={false}
          />
        </section>
      )}

      {stage === 'clarify' && !hasPaste && (
        <section className="card ref-card">
          <p className="empty-state">
            Paste a short description on Capture first, then return here for one round of choices.
            {onNavigate ? null : null}
          </p>
          <button type="button" className="secondary-btn" onClick={() => setStage('capture')}>
            Back to Capture
          </button>
        </section>
      )}

      {stage === 'tickets' && (
        <section className="card ref-card">
          {state.groomConfirmed || state.requirementFileName ? (
            <>
              {(state.groomDraft || state.requirementsText) && (
                <div className="groom-compare">
                  <div>
                    <h4>Cleared wording</h4>
                    <pre className="groom-draft">{state.groomDraft || state.requirementsText}</pre>
                  </div>
                </div>
              )}
              <JiraScopePanel
                state={state}
                onUpdate={onUpdate}
                sourceText={state.groomDraft || state.requirementsText}
              />
              <ScopeStartStatus state={state} onUpdate={onUpdate} />
              {!state.integrations.find((i) => i.id === 'jira')?.connected && onNavigate ? (
                <p className="groom-blocker-hint">
                  Connect Atlassian first ·{' '}
                  <button type="button" className="link-btn" onClick={() => onNavigate('integrations')}>
                    Open Integrations
                  </button>
                </p>
              ) : null}
            </>
          ) : (
            <p className="empty-state">
              Finish Clarify and click Use this wording before creating tickets.
              <button type="button" className="secondary-btn" style={{ marginLeft: '0.75rem' }} onClick={() => setStage('clarify')}>
                Go to Clarify
              </button>
            </p>
          )}
        </section>
      )}
    </div>
  )
}

export function validateRequirements(state: WizardState): string | null {
  if (!state.requirementsText.trim() && !state.requirementFileName) {
    return 'Upload a document or paste requirements.'
  }
  if (!state.requirementsText.trim() && state.requirementFileName) {
    return null
  }
  if (!state.groomConfirmed) {
    if (!state.groomQuestions.length && state.groomStatus !== 'draft_ready' && state.groomStatus !== 'error') {
      return 'Open Clarify, click Make it clearer, and answer the required questions.'
    }
    const missing = unansweredRequired(state)
    if (missing.length) {
      return `Answer or mark Jira later on the ${missing.length} required question${missing.length === 1 ? '' : 's'} under Need clarification.`
    }
    return 'Click Use this wording so Blink can rewrite from your answers.'
  }
  return validateSdlcScope(state)
}
