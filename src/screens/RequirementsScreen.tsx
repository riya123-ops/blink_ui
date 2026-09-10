import { useEffect, useRef } from 'react'
import { CloudUpload, FileUp, GitBranch, Link2 } from 'lucide-react'
import type { WizardState } from '../wizard/types'
import { GroomingPanel } from './GroomRequirementScreen'
import { unansweredRequired } from '../wizard/grooming'

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
}

function handleFile(file: File | undefined, onUpdate: Props['onUpdate']) {
  if (!file) return
  onUpdate({ requirementFileName: file.name, requirementFile: file, requirementsText: '' })
}

function clearFile(onUpdate: Props['onUpdate'], fileInputRef: React.RefObject<HTMLInputElement | null>) {
  onUpdate({ requirementFileName: null, requirementFile: null, requirementsText: '' })
  if (fileInputRef.current) fileInputRef.current.value = ''
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
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const hasUploadedFile = Boolean(state.requirementFileName)
  const hasPaste = Boolean(state.requirementsText.trim())
  const pasteLocked =
    !state.groomConfirmed &&
    (state.groomQuestions.length > 0 || state.groomStatus === 'draft_ready' || state.groomStatus === 'need_choices')

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

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Requirements</h2>
        <p>
          Upload a document or paste a short description. If you paste, answer one round of choices. Blink then
          proposes Jira tickets from the cleared wording.
        </p>
      </div>

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
          <button type="button" className="browse-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
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
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" hidden onChange={(e) => handleFile(e.target.files?.[0], onUpdate)} />
        </div>

        {!hasUploadedFile && (
          <>
            <div className="or-divider"><span>OR</span></div>

            <div className="field-group">
              <label htmlFor="requirementsText">Paste Requirements</label>
              <p className="field-hint">
                {pasteLocked
                  ? 'Your paste is locked while you answer. Start over if you need to change it.'
                  : 'Use this only if you don\u2019t have a requirement document to upload.'}
              </p>
              <textarea
                ref={pasteRef}
                id="requirementsText"
                className={`req-textarea${pasteLocked ? ' locked' : ''}`}
                rows={8}
                placeholder="Paste your requirements here…"
                value={state.requirementsText}
                readOnly={pasteLocked}
                onChange={(e) => onUpdate({ requirementsText: e.target.value, requirementFileName: null, requirementFile: null })}
              />
            </div>
          </>
        )}

        {hasPaste && onAsk && onPick && onOther && onToggleOther && onUseWording && onStartOver && (
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
          />
        )}

        <div className="existing-app-section">
          <h4>Provide Existing Application <span className="optional-tag">(Optional)</span></h4>
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
              <input ref={zipInputRef} type="file" accept=".zip" hidden onChange={(e) => onUpdate({ sourceZipName: e.target.files?.[0]?.name ?? null })} />
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
        </div>
      </section>
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
  if (state.groomConfirmed) return null
  if (!state.groomQuestions.length && state.groomStatus !== 'draft_ready' && state.groomStatus !== 'error') {
    return 'Click Make it clearer and answer the required questions on this page.'
  }
  const missing = unansweredRequired(state)
  if (missing.length) {
    return `Answer the ${missing.length} required question${missing.length === 1 ? '' : 's'} under Need clarification.`
  }
  return 'Click Use this wording so Blink can rewrite from your answers.'
}
