import { useCallback, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  Copy,
  Download,
  ExternalLink,
  File,
  Folder,
  GitBranch,
  Loader2,
  Rocket,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { ReviewResolveScreen } from './ExtendedScreens'
import {
  gitApply,
  implementStep,
  qaValidation,
  technicalPlan,
} from '../api/blink'
import {
  NEXT_SDLC_COMMAND,
  buildDownloadStructure,
  defaultRepositories,
  githubRepoSlug,
  sanitizeDownloadStructure,
  workspaceRootName,
} from '../wizard/defaults'
import type { WizardState, WizardStep } from '../wizard/types'
import { shapePlanContext } from '../wizard/shape'

const GENERATION_CHECKLIST = [
  'Project structure created',
  'Build configuration generated',
  'AI-SDLC overlay included',
  'IDE commands packaged',
] as const

type ShipAction = 'git' | 'implement' | 'qa' | 'refresh-plan'

function primaryIssueKey(state: WizardState): string | undefined {
  const fromJira = state.jiraCreatedIssues?.find((i) => i.jiraKey)?.jiraKey
  if (fromJira) return fromJira
  return state.workClassification?.issueId || state.specification?.issueId || state.productScope?.storyIds?.[0]
}

function stackContext(state: WizardState): string {
  const lines = state.repoTechnologies.map((t) => {
    const repo = state.repositories.find((r) => r.id === t.repoId)
    return `- ${repo?.name || t.repoId}: ${t.language} / ${t.framework} / ${t.buildTool} (${t.status})`
  })
  return lines.length ? `Confirmed delivery stack:\n${lines.join('\n')}` : ''
}

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  loading: boolean
  onBack?: () => void
  exporting?: boolean
  onExportGithub?: () => void
  onGenerateKit?: () => void
  onNavigate?: (step: WizardStep) => void
}

/**
 * Ship workbench: Git apply → /implement-step → /qa-validation.
 * Agent actions call registered hosted commands (framework prompts), not UI-invented prompts.
 */
export function ShipScreen({
  state,
  onUpdate,
  loading,
  onBack,
  exporting,
  onExportGithub,
  onGenerateKit,
  onNavigate,
}: Props) {
  const [busy, setBusy] = useState<ShipAction | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ShipAction, string>>>({})
  const [copied, setCopied] = useState(false)
  const [kitOpen, setKitOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const hasPlan = Boolean(state.technicalPlan?.markdown || state.technicalPlan?.steps?.length)
  const reposCreated = state.repositories.some(
    (r) => r.createStatus === 'created' || r.createStatus === 'exists' || Boolean(r.htmlUrl),
  )
  const planAck = Boolean(state.planAcknowledged || state.shipPlanAcknowledged)
  const needsPlanAck = hasPlan && !planAck
  const needsBootstrapAck = planAck && !state.bootstrapAcknowledged
  const gitWritten = Boolean(state.gitWritten)
  const needsImplAuth = Boolean(state.bootstrapAcknowledged && gitWritten && !state.implementationAuthorized)
  const hasDraftPr = (state.draftPullRequests || []).length > 0
  const hasQa = Boolean(state.qaValidation?.verdict || state.qaValidation?.markdown)

  const requirementText =
    state.groomDraft?.trim()
    || state.requirementsText?.trim()
    || state.productScope?.markdown?.trim()
    || state.description?.trim()
    || ''

  const shipUnlocked = hasPlan && planAck && Boolean(state.bootstrapAcknowledged) && Boolean(state.projectId)
  const canGit = Boolean(
    shipUnlocked && planAck && state.bootstrapAcknowledged && hasPlan && reposCreated && (state.scopeOverlays || []).length && !busy,
  )
  const canImplement = Boolean(
    state.implementationAuthorized && gitWritten && planAck && state.bootstrapAcknowledged && hasPlan && !busy,
  )
  const canQa = Boolean(shipUnlocked && hasDraftPr && !busy)
  const canExportGithub = Boolean(state.bootstrapAcknowledged && !exporting)

  const changeLog = useMemo(() => {
    const items: string[] = []
    if (state.gitApplyCommit?.sha) {
      items.push(
        `Git apply: ${state.gitApplyCommit.owner || ''}/${state.gitApplyCommit.repo || ''}@${state.gitApplyCommit.sha.slice(0, 7)}`,
      )
    }
    for (const pr of state.draftPullRequests || []) {
      items.push(`Draft PR (${pr.kind || 'app'}): ${pr.url || `#${pr.number}`}`)
    }
    if (state.qaValidation?.verdict) {
      items.push(`QA (advisory): ${state.qaValidation.verdict}`)
    }
    return items
  }, [state.draftPullRequests, state.gitApplyCommit, state.qaValidation])

  const setError = (key: ShipAction, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev }
      if (message) next[key] = message
      else delete next[key]
      return next
    })
  }

  const acknowledgePlan = () => {
    onUpdate({ planAcknowledged: true, shipPlanAcknowledged: true })
  }

  const acknowledgeBootstrap = () => {
    onUpdate({ bootstrapAcknowledged: true })
  }

  const authorizeImplementation = () => {
    onUpdate({ implementationAuthorized: true })
  }

  const refreshPlan = useCallback(async () => {
    if (!state.projectId) return
    setBusy('refresh-plan')
    setError('refresh-plan', null)
    try {
      const stack = stackContext(state)
      const res = await technicalPlan(state.projectId, {
        requirementText: [requirementText, stack].filter(Boolean).join('\n\n'),
        productScope: state.productScope,
        workClassification: state.workClassification,
        specification: state.specification,
        overlayFiles: state.scopeOverlays || [],
        issueId: state.specification?.issueId || state.workClassification?.issueId,
        ...shapePlanContext(state),
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || 'Refresh /technical-plan failed')
      }
      onUpdate({
        technicalPlan: res.technicalPlan || null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        planAcknowledged: true,
        shipPlanAcknowledged: true,
        nextSdlcCommand: res.nextCommand || '/sdlc-next',
      })
    } catch (err) {
      setError('refresh-plan', err instanceof Error ? err.message : 'Could not refresh technical plan.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state])

  const runGitApply = useCallback(async () => {
    if (!state.projectId) return
    const ok = window.confirm('Commit .cursor/ai-sdlc overlays to the *-workspace default branch?')
    if (!ok) return
    setBusy('git')
    setError('git', null)
    try {
      const slug = githubRepoSlug(state.projectName || state.artifactName || 'project')
      const workspaceFromList = state.repositories.find(
        (r) => /workspace/i.test(r.name) || /workspace/i.test(r.purpose),
      )
      const res = await gitApply(state.projectId, {
        confirm: true,
        overlayFiles: state.scopeOverlays || [],
        repositories: state.repositories.map((r) => ({
          name: r.name,
          htmlUrl: r.htmlUrl,
          purpose: r.purpose,
        })),
        workspaceRepo: workspaceFromList?.htmlUrl || workspaceFromList?.name || `${slug}-workspace`,
        issueKey: primaryIssueKey(state),
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || 'Git apply failed')
      }
      onUpdate({
        gitWritten: true,
        gitApplyCommit: res.commit || null,
        nextSdlcCommand: '/implement-step',
      })
    } catch (err) {
      setError('git', err instanceof Error ? err.message : 'Could not apply overlay to Git.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, state])

  const runImplement = useCallback(async () => {
    if (!state.projectId) return
    const ok = window.confirm('Run /implement-step and open draft PRs on app repos only (no merge)?')
    if (!ok) return
    setBusy('implement')
    setError('implement', null)
    try {
      const stack = stackContext(state)
      const res = await implementStep(state.projectId, {
        confirm: true,
        gitWritten: true,
        requirementText: [requirementText, stack].filter(Boolean).join('\n\n'),
        productScope: state.productScope,
        workClassification: state.workClassification,
        specification: state.specification,
        technicalPlan: state.technicalPlan,
        overlayFiles: state.scopeOverlays || [],
        issueId: state.specification?.issueId || state.workClassification?.issueId,
        issueKey: primaryIssueKey(state),
        repositories: state.repositories.map((r) => ({
          name: r.name,
          htmlUrl: r.htmlUrl,
          purpose: r.purpose,
        })),
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || '/implement-step failed')
      }
      onUpdate({
        implementStep: res.implementStep || null,
        draftPullRequests: res.draftPullRequests || [],
        scopeOverlays: (res.overlayFiles as WizardState['scopeOverlays']) || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || '/qa-validation',
      })
    } catch (err) {
      setError('implement', err instanceof Error ? err.message : 'Could not run /implement-step.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state])

  const runQa = useCallback(async () => {
    if (!state.projectId) return
    setBusy('qa')
    setError('qa', null)
    try {
      const first = state.draftPullRequests?.[0]
      const res = await qaValidation(state.projectId, {
        requirementText,
        specification: state.specification,
        technicalPlan: state.technicalPlan,
        overlayFiles: state.scopeOverlays || [],
        issueId: state.specification?.issueId || state.workClassification?.issueId,
        draftPrUrl: first?.url,
        prSummary: first ? `Draft PR #${first.number} ${first.url}` : '',
        owner: first?.owner,
        repo: first?.repo,
        sha: first?.sha,
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || '/qa-validation failed')
      }
      onUpdate({
        qaValidation: res.qaValidation || null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || null,
      })
    } catch (err) {
      setError('qa', err instanceof Error ? err.message : 'Could not run /qa-validation.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state])

  const github = state.integrations.find((item) => item.id === 'github')
  const githubReady = Boolean(github?.connected)
  const nextCommand = state.nextSdlcCommand || NEXT_SDLC_COMMAND
  const structure = sanitizeDownloadStructure(
    state.downloadStructure.length
      ? state.downloadStructure
      : buildDownloadStructure(
          state.repositoriesTouched
          ? state.repositories
          : defaultRepositories(state.projectName, {
              topology: state.topology,
              repositoryModel: state.repositoryModel,
              architectureStyle: state.architectureStyle,
            }),
        ),
  )
  const rootName =
    state.downloadFilename?.replace(/\.zip$/i, '') || workspaceRootName(state.projectName)
  const timeStr = state.generationTimeSec
    ? `${String(Math.floor(state.generationTimeSec / 60)).padStart(2, '0')}:${String(state.generationTimeSec % 60).padStart(2, '0')} min`
    : null

  if (!state.generationComplete && loading) {
    const steps = state.generationSteps
    const total = Math.max(steps.length, 1)
    const done = steps.filter((step) => step.status === 'done').length
    const running = steps.find((step) => step.status === 'running')
    const percent = running
      ? Math.min(99, Math.round((done / total) * 100) + Math.round(50 / total))
      : Math.round((done / total) * 100)
    return (
      <div className="screen screen-ref gen-loading">
        <h2>Preparing kit…</h2>
        <p>{running?.label || 'Scaffolding workspace overlay (optional kit path).'}</p>
        <div className="gen-progress">
          <div className="gen-progress-copy">
            <span>{running?.label || 'Working…'}</span>
            <strong>{percent}%</strong>
          </div>
          <div className="gen-progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span className="gen-progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
    )
  }

  const pipeline = [
    { id: 'git', label: 'Overlay', done: gitWritten },
    { id: 'implement', label: 'Draft PRs', done: hasDraftPr },
    { id: 'qa', label: 'QA', done: hasQa },
  ] as const

  return (
    <div className="screen shape-screen ship-screen">
      <div className="screen-header">
        <h2>
          <Rocket size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Ship
        </h2>
        <p>
          After G-PLAN, acknowledge G-BOOTSTRAP, create remotes, commit overlays, authorize, then{' '}
          <code>/implement-step</code> and advisory <code>/qa-validation</code>. Nothing merges automatically.
        </p>
      </div>

      <ol className="ship-pipeline" aria-label="Ship progress">
        {pipeline.map((step, index) => (
          <li key={step.id} className={step.done ? 'done' : busy === step.id ? 'active' : ''}>
            <span className="ship-pipeline-index">{step.done ? <CheckCircle2 size={14} /> : index + 1}</span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>

      {!hasPlan && (
        <p className="status-banner info">
          Finish Work plan (<code>/technical-plan</code> + G-PLAN) before shipping.
        </p>
      )}
      {hasPlan && planAck && state.bootstrapAcknowledged && !reposCreated && (
        <p className="status-banner info">
          Create GitHub repositories below (including <code>*-workspace</code>) after G-BOOTSTRAP — then run Git
          apply.
        </p>
      )}

      {needsPlanAck && (
        <section className="card shape-section ship-step-card">
          <div className="sdlc-panel__head">
            <Workflow size={18} />
            <div>
              <h3>Acknowledge G-PLAN</h3>
              <p className="muted">
                Normally completed on Work plan. Human acknowledgement that the technical plan was
                reviewed — not an approve-gate.
              </p>
            </div>
          </div>
          <div className="ship-actions">
            <button type="button" className="primary-btn" disabled={!!busy} onClick={acknowledgePlan}>
              Acknowledge G-PLAN (human)
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={!!busy || !state.projectId}
              onClick={() => void refreshPlan()}
            >
              {busy === 'refresh-plan' ? <Loader2 className="spin" size={16} /> : null}
              Refresh plan (/technical-plan)
            </button>
          </div>
          {errors['refresh-plan'] ? <p className="error-text">{errors['refresh-plan']}</p> : null}
        </section>
      )}

      {needsBootstrapAck && (
        <section className="card shape-section ship-step-card">
          <div className="sdlc-panel__head">
            <GitBranch size={18} />
            <div>
              <h3>Acknowledge G-BOOTSTRAP</h3>
              <p className="muted">
                Enables remote repository create/export. Human acknowledgement only — not an approve-gate.
              </p>
            </div>
          </div>
          <button type="button" className="primary-btn" disabled={!!busy} onClick={acknowledgeBootstrap}>
            Acknowledge G-BOOTSTRAP
          </button>
        </section>
      )}

      {planAck && state.bootstrapAcknowledged ? (
        <section className="card shape-section ship-step-card">
          <div className="sdlc-panel__head">
            <ExternalLink size={18} />
            <div>
              <h3>Create / export remotes</h3>
              <p className="muted">
                Remotes are created here after G-BOOTSTRAP — not on Repositories Continue.
              </p>
            </div>
            {reposCreated ? <CheckCircle2 className="ok" size={18} /> : null}
          </div>
          <button
            type="button"
            className="primary-btn"
            disabled={!githubReady || !canExportGithub}
            onClick={() => onExportGithub?.()}
          >
            <ExternalLink size={16} /> {exporting ? 'Creating repos…' : 'Export / create GitHub repos'}
          </button>
          {!githubReady && <p className="muted small">Connect GitHub on Integrations first.</p>}
        </section>
      ) : null}

      {needsImplAuth && (
        <section className="card shape-section ship-step-card">
          <div className="sdlc-panel__head">
            <ShieldCheck size={18} />
            <div>
              <h3>Authorize implementation</h3>
              <p className="muted">
                Required before <code>/implement-step</code>. Confirms you intend to open draft PRs (no merge).
              </p>
            </div>
          </div>
          <button type="button" className="primary-btn" disabled={!!busy} onClick={authorizeImplementation}>
            Authorize implementation
          </button>
        </section>
      )}

      {changeLog.length > 0 && (
        <section className="card shape-section">
          <h3 className="card-title">What changed</h3>
          <ul className="muted small ship-changelog">
            {changeLog.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="ship-step-grid">
        <section className={`card shape-section ship-step-card ${gitWritten ? 'is-done' : ''}`}>
          <div className="sdlc-panel__head">
            <GitBranch size={18} />
            <div>
              <p className="shape-kicker">Step 1</p>
              <h3>Commit overlay to workspace</h3>
              <p className="muted">Writes <code>.cursor/ai-sdlc/**</code> to the *-workspace default branch.</p>
            </div>
            {gitWritten ? <CheckCircle2 className="ok" size={18} /> : null}
          </div>
          {gitWritten && state.gitApplyCommit?.sha ? (
            <p className="muted small">
              SHA {state.gitApplyCommit.sha.slice(0, 7)}
              {state.gitApplyCommit.url ? (
                <>
                  {' · '}
                  <a href={state.gitApplyCommit.url} target="_blank" rel="noreferrer">
                    commit
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          <button type="button" className="primary-btn" disabled={!canGit || !reposCreated} onClick={() => void runGitApply()}>
            {busy === 'git' ? <Loader2 className="spin" size={16} /> : null}
            {gitWritten ? 'Re-commit overlay' : 'Commit overlay to workspace'}
          </button>
          {errors.git ? <p className="error-text">{errors.git}</p> : null}
        </section>

        <section className={`card shape-section ship-step-card ${hasDraftPr ? 'is-done' : ''}`}>
          <div className="sdlc-panel__head">
            <Workflow size={18} />
            <div>
              <p className="shape-kicker">Step 2</p>
              <h3>Implement step (draft PRs)</h3>
              <p className="muted">
                Hosted command <code>/implement-step</code> — app repos only, never merges.
              </p>
            </div>
            {hasDraftPr ? <CheckCircle2 className="ok" size={18} /> : null}
          </div>
          {hasDraftPr ? (
            <ul className="muted small">
              {(state.draftPullRequests || []).map((pr) => (
                <li key={pr.url || `${pr.owner}/${pr.repo}/${pr.number}`}>
                  {pr.kind || 'app'}:{' '}
                  {pr.url ? (
                    <a href={pr.url} target="_blank" rel="noreferrer">
                      draft PR #{pr.number}
                    </a>
                  ) : (
                    `PR #${pr.number}`
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {state.implementStep?.summary ? (
            <p className="muted small">{state.implementStep.summary.slice(0, 200)}</p>
          ) : null}
          <button type="button" className="primary-btn" disabled={!canImplement} onClick={() => void runImplement()}>
            {busy === 'implement' ? <Loader2 className="spin" size={16} /> : null}
            {hasDraftPr ? 'Re-run /implement-step' : 'Run /implement-step'}
          </button>
          {errors.implement ? <p className="error-text">{errors.implement}</p> : null}
        </section>

        <section className={`card shape-section ship-step-card ${hasQa ? 'is-done' : ''}`}>
          <div className="sdlc-panel__head">
            <ShieldCheck size={18} />
            <div>
              <p className="shape-kicker">Step 3</p>
              <h3>QA validation (advisory)</h3>
              <p className="muted">Hosted command <code>/qa-validation</code> — report only, no gate approval.</p>
            </div>
            {hasQa ? <CheckCircle2 className="ok" size={18} /> : null}
          </div>
          {hasQa ? (
            <p className="muted small">
              Verdict: {state.qaValidation?.verdict}
              {state.qaValidation?.summary ? ` — ${state.qaValidation.summary.slice(0, 140)}` : ''}
            </p>
          ) : null}
          <button type="button" className="primary-btn" disabled={!canQa} onClick={() => void runQa()}>
            {busy === 'qa' ? <Loader2 className="spin" size={16} /> : null}
            {hasQa ? 'Re-run /qa-validation' : 'Run /qa-validation'}
          </button>
          {errors.qa ? <p className="error-text">{errors.qa}</p> : null}
        </section>
      </div>

      <section className="card shape-section">
        <div className="sdlc-panel__head">
          <Download size={18} />
          <div>
            <h3>Optional: download kit</h3>
            <p className="muted">ZIP escape hatch — not required for draft PRs.</p>
          </div>
        </div>
        <div className="ship-actions">
          <button
            type="button"
            className="secondary-btn"
            disabled={!githubReady || !canExportGithub}
            onClick={() => onExportGithub?.()}
          >
            <ExternalLink size={16} /> {exporting ? 'Creating repos…' : 'Export / create GitHub repos'}
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={loading}
            onClick={() => {
              setKitOpen(true)
              onGenerateKit?.()
            }}
          >
            <Download size={14} /> {state.generationComplete ? 'Show kit summary' : 'Generate kit ZIP'}
          </button>
          <button type="button" className="ghost-btn" onClick={() => setReviewOpen((open) => !open)}>
            {reviewOpen ? 'Hide review checklist' : 'Review checklist'}
          </button>
        </div>
        {!state.bootstrapAcknowledged && (
          <p className="muted small">Acknowledge G-BOOTSTRAP above before creating remotes.</p>
        )}
        {!githubReady && <p className="muted small">Connect GitHub on Integrations first.</p>}
      </section>

      {(kitOpen || state.generationComplete) && state.generationComplete && (
        <section className="card shape-section">
          <h3 className="card-title">Kit summary</h3>
          {timeStr ? <p className="muted small">Generated in {timeStr}</p> : null}
          <div className="next-command-box">
            <h4>Next SDLC command (local Cursor)</h4>
            <div className="next-command-row">
              <code>{nextCommand}</code>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  void navigator.clipboard.writeText(nextCommand).then(() => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1600)
                  })
                }}
              >
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="download-structure">
            <div className="download-structure-root">{rootName}</div>
            <ul className="download-structure-list">
              {structure.map((entry) => (
                <li key={`${entry.kind}-${entry.name}`} className={entry.kind}>
                  {entry.kind === 'file' ? <File size={16} /> : <Folder size={16} />}
                  <span>{entry.name}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="checklist ref">
            {GENERATION_CHECKLIST.map((item) => (
              <li key={item}>
                <CheckCircle2 size={16} className="check-green" />
                <span className="check-label">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviewOpen && onNavigate ? (
        <ReviewResolveScreen state={state} onNavigate={onNavigate} />
      ) : null}

      {onBack && (
        <button type="button" className="back-dashboard" onClick={onBack}>
          <ChevronLeft size={14} /> Back to Dashboard
        </button>
      )}
    </div>
  )
}
