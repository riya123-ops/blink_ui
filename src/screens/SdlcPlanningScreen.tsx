import { useCallback, useState } from 'react'
import { CheckCircle2, ClipboardList, FileText, Layers, Loader2, Map } from 'lucide-react'
import {
  classifyWork,
  confirmProductScope,
  createSpec,
  technicalPlan,
} from '../api/blink'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

type ActionKey = 'confirm' | 'classify' | 'spec' | 'plan'

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
    } catch (err) {
      setError('plan', err instanceof Error ? err.message : 'Could not draft technical plan.')
    } finally {
      setBusy(null)
    }
  }, [onUpdate, requirementText, state.productScope, state.projectId, state.scopeOverlays, state.specification, state.workClassification])

  return (
    <div className="stack gap-lg">
      <header className="stack gap-sm">
        <h2>SDLC planning</h2>
        <p className="muted">
          Confirm the proposed product scope, then run classify, specification, and technical plan
          as separate steps. Artifacts are saved to the project workspace.
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
    </div>
  )
}

export function validateSdlcPlanning(_state: WizardState): string | null {
  return null
}
