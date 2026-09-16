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
import type { WizardState } from '../wizard/types'

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
}: Props) {
  const [busy, setBusy] = useState<ShipAction | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ShipAction, string>>>({})
  const [copied, setCopied] = useState(false)
  const [kitOpen, setKitOpen] = useState(false)

  const hasPlan = Boolean(state.technicalPlan?.markdown || state.technicalPlan?.steps?.length)
  const stackReady = state.repoTechnologies.some((t) => t.status === 'confirmed')
  const reposCreated = state.repositories.some(
    (r) => r.createStatus === 'created' || r.createStatus === 'exists' || Boolean(r.htmlUrl),
  )
  const needsPlanAck = hasPlan && stackReady && !state.shipPlanAcknowledged
  const gitWritten = Boolean(state.gitWritten)
  const hasDraftPr = (state.draftPullRequests || []).length > 0
  const hasQa = Boolean(state.qaValidation?.verdict || state.qaValidation?.markdown)

  const requirementText =
    state.groomDraft?.trim()
    || state.requirementsText?.trim()
    || state.productScope?.markdown?.trim()
    || state.description?.trim()
    || ''

  const shipUnlocked = hasPlan && (!needsPlanAck) && Boolean(state.projectId)
  const canGit = Boolean(shipUnlocked && hasPlan && (state.scopeOverlays || []).length && !busy)
  const canImplement = Boolean(shipUnlocked && gitWritten && hasPlan && !busy)
  const canQa = Boolean(shipUnlocked && hasDraftPr && !busy)

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
    onUpdate({ shipPlanAcknowledged: true })
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
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || 'Refresh /technical-plan failed')
      }
      onUpdate({
        technicalPlan: res.technicalPlan || null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        shipPlanAcknowledged: true,
        nextSdlcCommand: res.nextCommand || '/implement-step',
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
          state.repositoriesTouched ? state.repositories : defaultRepositories(state.projectName),
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

  return (
    <div className="screen stack gap-lg">
      <header className="stack gap-sm">
        <h2>
          <Rocket size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Ship
        </h2>
        <p className="muted">
          Commit planning overlays, run <code>/implement-step</code> (draft PRs only), then{' '}
          <code>/qa-validation</code>. No merges. Download kit is optional.
        </p>
      </header>

      {!hasPlan && (
        <p className="status-banner info">
          Finish SDLC Planning (<code>/technical-plan</code>) before shipping.
        </p>
      )}
      {hasPlan && !reposCreated && (
        <p className="status-banner info">
          Create GitHub repositories on the Repositories step (including <code>*-workspace</code>) before Git
          apply.
        </p>
      )}

      {needsPlanAck && (
        <section className="sdlc-panel">
          <div className="sdlc-panel__head">
            <Workflow size={18} />
            <div>
              <h3>Plan was written before stack was confirmed</h3>
              <p className="muted">
                Continue with the current plan, or refresh via <code>/technical-plan</code> with confirmed
                stack context.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="primary-btn" disabled={!!busy} onClick={acknowledgePlan}>
              Continue with current plan
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

      {changeLog.length > 0 && (
        <section className="sdlc-panel">
          <h3>What changed</h3>
          <ul className="muted small">
            {changeLog.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <GitBranch size={18} />
          <div>
            <h3>1. Commit overlay to workspace</h3>
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

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <Workflow size={18} />
          <div>
            <h3>2. Implement step (draft PRs)</h3>
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

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <ShieldCheck size={18} />
          <div>
            <h3>3. QA validation (advisory)</h3>
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

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <Download size={18} />
          <div>
            <h3>Optional: download kit</h3>
            <p className="muted">ZIP escape hatch — not required for draft PRs.</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            className="secondary-btn"
            disabled={!githubReady || exporting}
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
        </div>
        {!githubReady && <p className="muted small">Connect GitHub on Integrations first.</p>}
      </section>

      {(kitOpen || state.generationComplete) && state.generationComplete && (
        <section className="sdlc-panel">
          <h3>Kit summary</h3>
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

      {onBack && (
        <button type="button" className="back-dashboard" onClick={onBack}>
          <ChevronLeft size={14} /> Back to Dashboard
        </button>
      )}
    </div>
  )
}
