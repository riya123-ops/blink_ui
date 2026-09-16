import { useCallback, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Map,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import {
  classifyWork,
  confirmProductScope,
  createSpec,
  gitApply,
  implementStep,
  postJiraGateEvidence,
  qaValidation,
  technicalPlan,
} from '../api/blink'
import { githubRepoSlug } from '../wizard/defaults'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

type ActionKey = 'confirm' | 'classify' | 'spec' | 'plan' | 'git' | 'implement' | 'qa'

function primaryIssueKey(state: WizardState): string | undefined {
  const fromJira = state.jiraCreatedIssues?.find((i) => i.jiraKey)?.jiraKey
  if (fromJira) return fromJira
  return state.workClassification?.issueId || state.specification?.issueId || state.productScope?.storyIds?.[0]
}

export function SdlcPlanningScreen({ state, onUpdate }: Props) {
  const [busy, setBusy] = useState<ActionKey | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ActionKey, string>>>({})

  const digest = state.scopeDigest || state.productScope?.proposalDigest || ''
  const confirmed = Boolean(
    state.productScope?.status === 'confirmed' || state.productScope?.confirmationDigest,
  )
  const hasScope = Boolean(state.productScope?.epics?.length || state.productScope?.stories?.length)
  const hasOverlays = (state.scopeOverlays || []).length > 0
  const hasClassify = Boolean(state.workClassification?.tier)
  const hasSpec = Boolean(state.specification?.markdown || state.specification?.title)
  const hasPlan = Boolean(state.technicalPlan?.markdown || state.technicalPlan?.steps?.length)
  const gitWritten = Boolean(state.gitWritten)
  const hasDraftPr = (state.draftPullRequests || []).length > 0
  const hasQa = Boolean(state.qaValidation?.verdict || state.qaValidation?.markdown)

  const requirementText =
    state.groomDraft?.trim()
    || state.requirementsText?.trim()
    || state.productScope?.markdown?.trim()
    || state.description?.trim()
    || ''

  const canConfirm = Boolean(state.projectId && hasScope && digest && hasOverlays && !busy)
  const canClassify = Boolean(state.projectId && confirmed && !busy)
  const canSpec = Boolean(state.projectId && confirmed && hasClassify && !busy)
  const canPlan = Boolean(state.projectId && confirmed && hasClassify && hasSpec && !busy)
  const canGit = Boolean(state.projectId && hasPlan && hasOverlays && !busy)
  const canImplement = Boolean(state.projectId && gitWritten && hasPlan && !busy)
  const canQa = Boolean(state.projectId && hasDraftPr && !busy)

  const setError = (key: ActionKey, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev }
      if (message) next[key] = message
      else delete next[key]
      return next
    })
  }

  const runConfirm = useCallback(async () => {
    if (!state.projectId || !digest) return
    setBusy('confirm')
    setError('confirm', null)
    try {
      const res = await confirmProductScope(state.projectId, {
        expectedDigest: digest,
        overlayFiles: state.scopeOverlays || [],
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || 'Confirm failed')
      }
      onUpdate({
        productScope: res.productScope || {
          ...state.productScope,
          status: 'confirmed',
          confirmationDigest: res.confirmationDigest,
          proposalDigest: undefined,
        },
        scopeDigest: null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        workClassification: null,
        specification: null,
        technicalPlan: null,
        nextSdlcCommand: res.nextCommand || '/classify-work',
      })
    } catch (err) {
      setError('confirm', err instanceof Error ? err.message : 'Could not confirm product scope.')
    } finally {
      setBusy(null)
    }
  }, [digest, onUpdate, state.productScope, state.projectId, state.scopeOverlays])

  const runClassify = useCallback(async () => {
    if (!state.projectId) return
    setBusy('classify')
    setError('classify', null)
    try {
      const res = await classifyWork(state.projectId, {
        requirementText,
        productScope: state.productScope,
        overlayFiles: state.scopeOverlays || [],
        issueId: state.workClassification?.issueId || state.productScope?.storyIds?.[0],
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || 'Classify failed')
      }
      const work = res.workClassification || res.classification || null
      onUpdate({
        workClassification: work,
        specification: null,
        technicalPlan: null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || '/create-spec',
      })
    } catch (err) {
      setError('classify', err instanceof Error ? err.message : 'Could not classify work.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state.productScope, state.projectId, state.scopeOverlays, state.workClassification?.issueId])

  const runSpec = useCallback(async () => {
    if (!state.projectId) return
    setBusy('spec')
    setError('spec', null)
    try {
      const res = await createSpec(state.projectId, {
        requirementText,
        productScope: state.productScope,
        workClassification: state.workClassification,
        overlayFiles: state.scopeOverlays || [],
        issueId: state.workClassification?.issueId || state.specification?.issueId,
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || 'Create spec failed')
      }
      onUpdate({
        specification: res.specification || null,
        technicalPlan: null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || '/technical-plan',
      })
    } catch (err) {
      setError('spec', err instanceof Error ? err.message : 'Could not create specification.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state.productScope, state.projectId, state.scopeOverlays, state.specification?.issueId, state.workClassification])

  const runPlan = useCallback(async () => {
    if (!state.projectId) return
    setBusy('plan')
    setError('plan', null)
    try {
      const res = await technicalPlan(state.projectId, {
        requirementText,
        productScope: state.productScope,
        workClassification: state.workClassification,
        specification: state.specification,
        overlayFiles: state.scopeOverlays || [],
        issueId: state.specification?.issueId || state.workClassification?.issueId,
      })
      if (res.status !== 'ok') {
        throw new Error(res.message || res.errors?.join('; ') || 'Technical plan failed')
      }
      onUpdate({
        technicalPlan: res.technicalPlan || null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || '/implement-step',
      })
      const issueKey = primaryIssueKey(state)
      if (issueKey && state.projectId) {
        void postJiraGateEvidence(state.projectId, {
          issueKey,
          gate: 'G-PLAN',
          message: `Technical plan drafted (${(res.technicalPlan?.steps || []).length} step(s)).`,
        }).catch(() => undefined)
      }
    } catch (err) {
      setError('plan', err instanceof Error ? err.message : 'Could not draft technical plan.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state, state.productScope, state.projectId, state.scopeOverlays, state.specification, state.workClassification])

  const runGitApply = useCallback(async () => {
    if (!state.projectId) return
    const ok = window.confirm('Commit .cursor/ai-sdlc overlays to the *-workspace default branch?')
    if (!ok) return
    setBusy('git')
    setError('git', null)
    try {
      const slug = githubRepoSlug(state.projectName || state.artifactName || 'project')
      const workspaceFromList = state.repositories.find((r) =>
        /workspace/i.test(r.name) || /workspace/i.test(r.purpose),
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
    const ok = window.confirm('Generate patches and open draft PRs on app repos only (no merge)?')
    if (!ok) return
    setBusy('implement')
    setError('implement', null)
    try {
      const res = await implementStep(state.projectId, {
        confirm: true,
        gitWritten: true,
        requirementText,
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
        throw new Error(res.message || res.errors?.join('; ') || 'Implement-step failed')
      }
      onUpdate({
        implementStep: res.implementStep || null,
        draftPullRequests: res.draftPullRequests || [],
        scopeOverlays: (res.overlayFiles as WizardState['scopeOverlays']) || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || '/qa-validation',
      })
    } catch (err) {
      setError('implement', err instanceof Error ? err.message : 'Could not run implement-step.')
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
        throw new Error(res.message || res.errors?.join('; ') || 'QA validation failed')
      }
      onUpdate({
        qaValidation: res.qaValidation || null,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || null,
      })
    } catch (err) {
      setError('qa', err instanceof Error ? err.message : 'Could not run QA validation.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state])

  return (
    <div className="stack gap-lg">
      <header className="stack gap-sm">
        <h2>SDLC planning</h2>
        <p className="muted">
          Confirm scope, classify, specify, plan — then commit overlays, open draft PRs, and run
          advisory QA. No merges.
        </p>
      </header>

      {!hasScope && (
        <p className="status-banner info">
          Plan product scope on Requirements (Use this wording) before confirming here.
        </p>
      )}
      {hasScope && !hasOverlays && (
        <p className="status-banner info">
          Scope overlays are missing. Re-run product scope planning on Requirements so Confirm can
          CAS-check the proposal digest.
        </p>
      )}

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <Layers size={18} />
          <div>
            <h3>1. Confirm product scope</h3>
            <p className="muted">Locks the proposal digest from plan-product-scope.</p>
          </div>
          {confirmed ? <CheckCircle2 className="ok" size={18} /> : null}
        </div>
        <p className="muted small">
          Epics: {state.productScope?.epics?.length || 0} · Stories:{' '}
          {state.productScope?.stories?.length || 0}
          {digest ? ` · Digest ${digest.slice(0, 12)}…` : ''}
          {confirmed && state.productScope?.confirmationDigest
            ? ` · Confirmed ${state.productScope.confirmationDigest.slice(0, 12)}…`
            : ''}
        </p>
        <button type="button" className="primary-btn" disabled={!canConfirm} onClick={() => void runConfirm()}>
          {busy === 'confirm' ? <Loader2 className="spin" size={16} /> : null}
          {confirmed ? 'Re-confirm scope' : 'Confirm scope'}
        </button>
        {errors.confirm ? <p className="error-text">{errors.confirm}</p> : null}
      </section>

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <ClipboardList size={18} />
          <div>
            <h3>2. Classify work</h3>
            <p className="muted">Propose tier 1–4 and work type (advisory).</p>
          </div>
          {hasClassify ? <CheckCircle2 className="ok" size={18} /> : null}
        </div>
        {hasClassify ? (
          <p className="muted small">
            Tier {state.workClassification?.tier} · {state.workClassification?.workType}
            {state.workClassification?.riskSummary
              ? ` — ${state.workClassification.riskSummary.slice(0, 140)}`
              : ''}
          </p>
        ) : null}
        <button type="button" className="primary-btn" disabled={!canClassify} onClick={() => void runClassify()}>
          {busy === 'classify' ? <Loader2 className="spin" size={16} /> : null}
          {hasClassify ? 'Re-classify' : 'Classify work'}
        </button>
        {errors.classify ? <p className="error-text">{errors.classify}</p> : null}
      </section>

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <FileText size={18} />
          <div>
            <h3>3. Create specification</h3>
            <p className="muted">Draft specification.md from confirmed scope + classification.</p>
          </div>
          {hasSpec ? <CheckCircle2 className="ok" size={18} /> : null}
        </div>
        {hasSpec ? (
          <p className="muted small">{state.specification?.title || 'Specification ready'}</p>
        ) : null}
        <button type="button" className="primary-btn" disabled={!canSpec} onClick={() => void runSpec()}>
          {busy === 'spec' ? <Loader2 className="spin" size={16} /> : null}
          {hasSpec ? 'Regenerate spec' : 'Create specification'}
        </button>
        {errors.spec ? <p className="error-text">{errors.spec}</p> : null}
      </section>

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <Map size={18} />
          <div>
            <h3>4. Technical plan</h3>
            <p className="muted">Ordered implementation steps, rollback, and test strategy.</p>
          </div>
          {hasPlan ? <CheckCircle2 className="ok" size={18} /> : null}
        </div>
        {hasPlan ? (
          <p className="muted small">
            {state.technicalPlan?.steps?.length || 0} step(s)
            {state.technicalPlan?.summary ? ` — ${state.technicalPlan.summary.slice(0, 140)}` : ''}
          </p>
        ) : null}
        <button type="button" className="primary-btn" disabled={!canPlan} onClick={() => void runPlan()}>
          {busy === 'plan' ? <Loader2 className="spin" size={16} /> : null}
          {hasPlan ? 'Regenerate plan' : 'Draft technical plan'}
        </button>
        {errors.plan ? <p className="error-text">{errors.plan}</p> : null}
      </section>

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <GitBranch size={18} />
          <div>
            <h3>5. Commit overlay to workspace</h3>
            <p className="muted">Writes `.cursor/ai-sdlc/**` to the *-workspace default branch.</p>
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
        <button type="button" className="primary-btn" disabled={!canGit} onClick={() => void runGitApply()}>
          {busy === 'git' ? <Loader2 className="spin" size={16} /> : null}
          {gitWritten ? 'Re-commit overlay' : 'Commit overlay to workspace'}
        </button>
        {errors.git ? <p className="error-text">{errors.git}</p> : null}
      </section>

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <Workflow size={18} />
          <div>
            <h3>6. Implement step (draft PRs)</h3>
            <p className="muted">App repos only — opens draft PRs, never merges.</p>
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
        <button type="button" className="primary-btn" disabled={!canImplement} onClick={() => void runImplement()}>
          {busy === 'implement' ? <Loader2 className="spin" size={16} /> : null}
          {hasDraftPr ? 'Re-run implement-step' : 'Run implement-step'}
        </button>
        {errors.implement ? <p className="error-text">{errors.implement}</p> : null}
      </section>

      <section className="sdlc-panel">
        <div className="sdlc-panel__head">
          <ShieldCheck size={18} />
          <div>
            <h3>7. QA validation (advisory)</h3>
            <p className="muted">Report only — does not approve G-QA or merge.</p>
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
          {hasQa ? 'Re-run QA validation' : 'Run QA validation'}
        </button>
        {errors.qa ? <p className="error-text">{errors.qa}</p> : null}
      </section>
    </div>
  )
}

export function validateSdlcPlanning(_state: WizardState): string | null {
  return null
}
