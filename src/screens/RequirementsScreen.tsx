import { useEffect, useRef } from 'react'
import { ChevronRight, CloudUpload, FileUp, GitBranch, Link2 } from 'lucide-react'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  onAnalyze: () => void
  analyzing?: boolean
}

function handleFile(file: File | undefined, onUpdate: Props['onUpdate']) {
  if (!file) return
  onUpdate({ requirementFileName: file.name, requirementsText: '' })
}

function clearFile(onUpdate: Props['onUpdate'], fileInputRef: React.RefObject<HTMLInputElement | null>) {
  onUpdate({ requirementFileName: null, requirementsText: '' })
  if (fileInputRef.current) fileInputRef.current.value = ''
}

export function RequirementsScreen({ state, onUpdate, onAnalyze, analyzing }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const hasUploadedFile = Boolean(state.requirementFileName)

  useEffect(() => {
    if (state.requirementFileName && state.requirementsText.trim()) {
      onUpdate({ requirementsText: '' })
    }
  }, [state.requirementFileName, state.requirementsText, onUpdate])

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Requirements</h2>
        <p>How would you like to provide your requirements?</p>
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
              <p className="field-hint">Use this only if you don&apos;t have a requirement document to upload.</p>
              <textarea
                id="requirementsText"
                className="req-textarea"
                rows={6}
                placeholder="Paste your requirements here…"
                value={state.requirementsText}
                onChange={(e) => onUpdate({ requirementsText: e.target.value, requirementFileName: null })}
              />
            </div>
          </>
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

        <div className="card-footer-actions">
          <button type="button" className="primary-btn arrow-btn" disabled={analyzing} onClick={onAnalyze}>
            {analyzing ? 'Analyzing…' : 'Analyze Requirements'} <ChevronRight size={16} />
          </button>
        </div>

        {state.requirementsAnalyzed && (
          <div className="inline-success">{state.questions.length} clarification questions generated.</div>
        )}
      </section>
    </div>
  )
}

export function validateRequirements(state: WizardState): string | null {
  if (!state.requirementsText.trim() && !state.requirementFileName) {
    return 'Upload a document or paste requirements.'
  }
  if (!state.requirementsAnalyzed) return 'Click Analyze Requirements before continuing.'
  return null
}
