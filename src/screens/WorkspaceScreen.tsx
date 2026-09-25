import { useCallback, useState } from 'react'
import { CheckCircle2, ChevronLeft, Download, ExternalLink, FolderGit2, GitBranch, Loader2 } from 'lucide-react'
import { gitApply } from '../api/blink'
import { githubRepoSlug } from '../wizard/defaults'
import type { WizardState, WizardStep } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  loading: boolean
  exporting?: boolean
  onExportGithub?: () => void
  onGenerateKit?: () => void
  onNavigate: (step: WizardStep) => void
  onBack?: () => void
}

export function WorkspaceScreen({
  state,
  onUpdate,
  loading,
  exporting,
  onExportGithub,
  onGenerateKit,
  onNavigate,
  onBack,
}: Props) {
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const planAcknowledged = Boolean(state.planAcknowledged || state.shipPlanAcknowledged)
  const repositoriesCreated = state.repositories.some(
    (repository) =>
      repository.createStatus === 'created' ||
      repository.createStatus === 'exists' ||
      Boolean(repository.htmlUrl),
  )
  const githubConnected = Boolean(state.integrations.find((item) => item.id === 'github')?.connected)
  const workspaceCommitted = Boolean(state.gitWritten)
  const workspaceRepository = state.repositories.find(
    (repository) => /workspace/i.test(repository.name) || /workspace/i.test(repository.purpose),
  )
  const canExport = planAcknowledged && state.bootstrapAcknowledged && githubConnected && !exporting
  const canCommit = Boolean(
    state.projectId &&
      planAcknowledged &&
      state.bootstrapAcknowledged &&
      repositoriesCreated &&
      (state.scopeOverlays || []).length &&
      !applying,
  )

  const commitWorkspace = useCallback(async () => {
    if (!state.projectId) return
    if (!window.confirm('Commit the Blink workspace overlay to the workspace repository?')) return
    setApplying(true)
    setError(null)
    try {
      const slug = githubRepoSlug(state.projectName || state.artifactName || 'project')
      const result = await gitApply(state.projectId, {
        confirm: true,
        overlayFiles: state.scopeOverlays || [],
        repositories: state.repositories.map((repository) => ({
          name: repository.name,
          htmlUrl: repository.htmlUrl,
          purpose: repository.purpose,
        })),
        workspaceRepo: workspaceRepository?.htmlUrl || workspaceRepository?.name || `${slug}-workspace`,
        issueKey:
          state.sdlcStartIssueId ||
          state.specification?.issueId ||
          state.workClassification?.issueId ||
          state.productScope?.storyIds?.[0],
      })
      if (result.status !== 'ok') {
        throw new Error(result.message || result.errors?.join('; ') || 'Could not commit the workspace overlay.')
      }
      onUpdate({
        gitWritten: true,
        gitApplyCommit: result.commit || null,
        nextSdlcCommand: '/sdlc-next',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not commit the workspace overlay.')
    } finally {
      setApplying(false)
    }
  }, [onUpdate, state, workspaceRepository])

  return (
    <div className="screen shape-screen workspace-screen">
      <div className="screen-header">
        <div>
          <p className="shape-kicker">Workspace</p>
          <h2>Prepare the workspace for Cursor</h2>
          <p>Create the repositories and commit Blink’s workspace guidance. Implementation happens in the next area.</p>
        </div>
      </div>

      {!planAcknowledged ? (
        <section className="card shape-section">
          <h3>Finish the Work plan first</h3>
          <p className="muted">
            Review and acknowledge the technical plan before preparing repositories and workspace guidance.
          </p>
          <button type="button" className="secondary-btn" onClick={() => onNavigate('sdlc-plan')}>
            Go to Work plan <ExternalLink size={14} aria-hidden />
          </button>
        </section>
      ) : (
        <>
          <section className="workspace-screen__grid">
            <article className={`card shape-section workspace-screen__card ${state.bootstrapAcknowledged ? 'is-done' : ''}`}>
              <div className="sdlc-panel__head">
                <GitBranch size={18} />
                <div>
                  <h3>Confirm repository setup</h3>
                  <p className="muted">Confirm that Blink may create or export the repository structure.</p>
                </div>
                {state.bootstrapAcknowledged ? <CheckCircle2 className="ok" size={18} /> : null}
              </div>
              <button
                type="button"
                className="primary-btn"
                disabled={Boolean(state.bootstrapAcknowledged)}
                onClick={() => onUpdate({ bootstrapAcknowledged: true })}
              >
                {state.bootstrapAcknowledged ? 'Repository setup confirmed' : 'Confirm repository setup'}
              </button>
            </article>

            <article className={`card shape-section workspace-screen__card ${repositoriesCreated ? 'is-done' : ''}`}>
              <div className="sdlc-panel__head">
                <FolderGit2 size={18} />
                <div>
                  <h3>Create or export repositories</h3>
                  <p className="muted">Create the selected repositories in GitHub, including the workspace repository.</p>
                </div>
                {repositoriesCreated ? <CheckCircle2 className="ok" size={18} /> : null}
              </div>
              <button type="button" className="primary-btn" disabled={!canExport} onClick={() => onExportGithub?.()}>
                {exporting ? <Loader2 className="spin" size={16} /> : <ExternalLink size={16} />}
                {exporting ? 'Creating repositories…' : 'Create or export repositories'}
              </button>
              {!githubConnected ? <p className="muted small">Connect GitHub in Integrations first.</p> : null}
            </article>

            <article className={`card shape-section workspace-screen__card ${workspaceCommitted ? 'is-done' : ''}`}>
              <div className="sdlc-panel__head">
                <GitBranch size={18} />
                <div>
                  <h3>Commit workspace guidance</h3>
                  <p className="muted">Commit the approved Blink guidance to the workspace repository.</p>
                </div>
                {workspaceCommitted ? <CheckCircle2 className="ok" size={18} /> : null}
              </div>
              {workspaceCommitted && state.gitApplyCommit?.sha ? (
                <p className="muted small">
                  Commit {state.gitApplyCommit.sha.slice(0, 7)}
                  {state.gitApplyCommit.url ? (
                    <>
                      {' · '}
                      <a href={state.gitApplyCommit.url} target="_blank" rel="noreferrer">Open commit</a>
                    </>
                  ) : null}
                </p>
              ) : null}
              <button type="button" className="primary-btn" disabled={!canCommit} onClick={() => void commitWorkspace()}>
                {applying ? <Loader2 className="spin" size={16} /> : <GitBranch size={16} />}
                {workspaceCommitted ? 'Commit updated guidance' : 'Commit workspace guidance'}
              </button>
              {!state.scopeOverlays?.length ? (
                <p className="muted small">Generate the workspace kit before committing the workspace guidance.</p>
              ) : null}
              {error ? <p className="error-text">{error}</p> : null}
            </article>
          </section>

          <section className="card shape-section workspace-screen__next">
            <h3>Next: Implementation</h3>
            <p className="muted">
              Once workspace guidance is committed, continue to Implementation to prepare the Cursor handoff.
            </p>
            <button type="button" className="secondary-btn" onClick={() => onNavigate('implementation')}>
              Go to Implementation <ExternalLink size={14} aria-hidden />
            </button>
          </section>
        </>
      )}

      <section className="card shape-section workspace-screen__kit">
        <div className="sdlc-panel__head">
          <Download size={18} />
          <div>
            <h3>Optional workspace kit</h3>
            <p className="muted">Download the generated workspace as a local reference or backup.</p>
          </div>
        </div>
        <button type="button" className="ghost-btn" disabled={loading} onClick={() => onGenerateKit?.()}>
          <Download size={14} /> {state.generationComplete ? 'Download workspace kit again' : 'Generate workspace kit'}
        </button>
      </section>

      {onBack ? (
        <button type="button" className="back-dashboard" onClick={onBack}>
          <ChevronLeft size={14} /> Back to Dashboard
        </button>
      ) : null}
    </div>
  )
}
