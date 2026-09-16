import { useCallback, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Layers,
  Loader2,
  Map,
  Sparkles,
} from 'lucide-react'
import {
  classifyWork,
  confirmProductScope,
  createSpec,
  postJiraGateEvidence,
  technicalPlan,
} from '../api/blink'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

type StepId = 'confirm' | 'classify' | 'spec' | 'plan'
type StepStatus = 'pending' | 'current' | 'running' | 'done' | 'blocked' | 'error'

interface PlanStep {
  id: StepId
  title: string
  command: string
  plain: string
  icon: typeof Layers
}

const PLAN_STEPS: PlanStep[] = [
  {
    id: 'confirm',
    title: 'Confirm product scope',
    command: '/confirm-product-scope',
    plain: 'Lock the proposed epics and stories so planning is based on an agreed scope.',
    icon: Layers,
  },
  {
    id: 'classify',
    title: 'Classify work',
    command: '/classify-work',
    plain: 'Decide risk tier and work type for how rigorously we should plan.',
    icon: ClipboardList,
  },
  {
    id: 'spec',
    title: 'Create specification',
    command: '/create-spec',
    plain: 'Turn the requirement into acceptance criteria and a clear spec.',
    icon: FileText,
  },
  {
    id: 'plan',
    title: 'Technical plan',
    command: '/technical-plan',
    plain: 'Produce ordered implementation steps, rollback, and test strategy.',
    icon: Map,
  },
]

function primaryIssueKey(state: WizardState): string | undefined {
  const fromJira = state.jiraCreatedIssues?.find((i) => i.jiraKey)?.jiraKey
  if (fromJira) return fromJira
  return state.workClassification?.issueId || state.specification?.issueId || state.productScope?.storyIds?.[0]
}

function stepDone(id: StepId, state: WizardState): boolean {
  switch (id) {
    case 'confirm':
      return Boolean(state.productScope?.status === 'confirmed' || state.productScope?.confirmationDigest)
    case 'classify':
      return Boolean(state.workClassification?.tier)
    case 'spec':
      return Boolean(state.specification?.markdown || state.specification?.title)
    case 'plan':
      return Boolean(state.technicalPlan?.markdown || state.technicalPlan?.steps?.length)
  }
}

function nextStepId(state: WizardState): StepId | null {
  for (const step of PLAN_STEPS) {
    if (!stepDone(step.id, state)) return step.id
  }
  return null
}

function blockReason(id: StepId, state: WizardState): string | null {
  const hasScope = Boolean(state.productScope?.epics?.length || state.productScope?.stories?.length)
  const hasOverlays = (state.scopeOverlays || []).length > 0
  const digest = state.scopeDigest || state.productScope?.proposalDigest || ''
  if (!state.projectId) return 'Save the project first so planning can run against a workspace.'
  if (id === 'confirm') {
    if (!hasScope) return 'Plan product scope on Requirements (Use this wording) first.'
    if (!digest) return 'Missing proposal digest — re-run product scope planning.'
    if (!hasOverlays) return 'Scope overlays missing — re-run product scope planning.'
  }
  return null
}

function outcomeFor(id: StepId, state: WizardState): string {
  switch (id) {
    case 'confirm': {
      const epics = state.productScope?.epics?.length || 0
      const stories = state.productScope?.stories?.length || 0
      const dig = state.productScope?.confirmationDigest
      return `Locked ${epics} epic(s), ${stories} story(ies)${dig ? ` · digest ${dig.slice(0, 10)}…` : ''}`
    }
    case 'classify': {
      const w = state.workClassification
      return `Tier ${w?.tier} · ${w?.workType || 'work'}${w?.riskSummary ? ` — ${w.riskSummary.slice(0, 120)}` : ''}`
    }
    case 'spec': {
      const s = state.specification
      const ac = s?.acceptanceCriteria?.length || 0
      return `${s?.title || 'Specification'} · ${ac} acceptance criterion(a)`
    }
    case 'plan': {
      const p = state.technicalPlan
      return `${p?.steps?.length || 0} step(s)${p?.summary ? ` — ${p.summary.slice(0, 140)}` : ''}`
    }
  }
}

/** Single Continue planning CTA — hosted commands only, no per-step advanced mode. */
export function SdlcPlanningScreen({ state, onUpdate }: Props) {
  const [busy, setBusy] = useState<StepId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastChange, setLastChange] = useState<string | null>(null)

  const digest = state.scopeDigest || state.productScope?.proposalDigest || ''
  const requirementText =
    state.groomDraft?.trim()
    || state.requirementsText?.trim()
    || state.productScope?.markdown?.trim()
    || state.description?.trim()
    || ''

  const nextId = nextStepId(state)
  const doneCount = PLAN_STEPS.filter((s) => stepDone(s.id, state)).length
  const progressPct = Math.round((doneCount / PLAN_STEPS.length) * 100)
  const complete = nextId === null
  const blockedMsg = nextId ? blockReason(nextId, state) : null
  const canContinue = Boolean(nextId && !blockedMsg && !busy && state.projectId)

  const statuses = useMemo(() => {
    const map: Record<StepId, StepStatus> = {
      confirm: 'pending',
      classify: 'pending',
      spec: 'pending',
      plan: 'pending',
    }
    for (const step of PLAN_STEPS) {
      if (busy === step.id) {
        map[step.id] = 'running'
        continue
      }
      if (stepDone(step.id, state)) {
        map[step.id] = 'done'
        continue
      }
      if (nextId === step.id) {
        map[step.id] = blockedMsg ? 'blocked' : error && !busy ? 'error' : 'current'
        continue
      }
      map[step.id] = 'pending'
    }
    return map
  }, [blockedMsg, busy, error, nextId, state])

  const continueLabel = useMemo(() => {
    if (complete) return 'Planning complete'
    if (!nextId) return 'Continue planning'
    const step = PLAN_STEPS.find((s) => s.id === nextId)!
    if (busy) return `Running ${step.command}…`
    if (blockedMsg) return 'Fix blockers to continue'
    return `Continue · ${step.title}`
  }, [blockedMsg, busy, complete, nextId])

  const runNext = useCallback(async () => {
    const id = nextStepId(state)
    if (!id || !state.projectId) return
    const block = blockReason(id, state)
    if (block) {
      setError(block)
      return
    }
    setBusy(id)
    setError(null)
    try {
      if (id === 'confirm') {
        const res = await confirmProductScope(state.projectId, {
          expectedDigest: digest,
          overlayFiles: state.scopeOverlays || [],
        })
        if (res.status !== 'ok') throw new Error(res.message || res.errors?.join('; ') || 'Confirm failed')
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
          shipPlanAcknowledged: false,
          nextSdlcCommand: res.nextCommand || '/classify-work',
        })
        setLastChange(`Confirmed scope via ${PLAN_STEPS[0].command}. Downstream planning cleared for a fresh chain.`)
        return
      }

      if (id === 'classify') {
        const res = await classifyWork(state.projectId, {
          requirementText,
          productScope: state.productScope,
          overlayFiles: state.scopeOverlays || [],
          issueId: state.workClassification?.issueId || state.productScope?.storyIds?.[0],
        })
        if (res.status !== 'ok') throw new Error(res.message || res.errors?.join('; ') || 'Classify failed')
        const work = res.workClassification || res.classification || null
        onUpdate({
          workClassification: work,
          specification: null,
          technicalPlan: null,
          shipPlanAcknowledged: false,
          scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
          nextSdlcCommand: res.nextCommand || '/create-spec',
        })
        setLastChange(
          `Classified as tier ${work?.tier ?? '?'} (${work?.workType || 'work'}) via ${PLAN_STEPS[1].command}.`,
        )
        return
      }

      if (id === 'spec') {
        const res = await createSpec(state.projectId, {
          requirementText,
          productScope: state.productScope,
          workClassification: state.workClassification,
          overlayFiles: state.scopeOverlays || [],
          issueId: state.workClassification?.issueId || state.specification?.issueId,
        })
        if (res.status !== 'ok') throw new Error(res.message || res.errors?.join('; ') || 'Create spec failed')
        onUpdate({
          specification: res.specification || null,
          technicalPlan: null,
          shipPlanAcknowledged: false,
          scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
          nextSdlcCommand: res.nextCommand || '/technical-plan',
        })
        setLastChange(
          `Specification drafted via ${PLAN_STEPS[2].command}: ${res.specification?.title || 'untitled'}.`,
        )
        return
      }

      const res = await technicalPlan(state.projectId, {
        requirementText,
        productScope: state.productScope,
        workClassification: state.workClassification,
        specification: state.specification,
        overlayFiles: state.scopeOverlays || [],
        issueId: state.specification?.issueId || state.workClassification?.issueId,
      })
      if (res.status !== 'ok') throw new Error(res.message || res.errors?.join('; ') || 'Technical plan failed')
      onUpdate({
        technicalPlan: res.technicalPlan || null,
        shipPlanAcknowledged: false,
        scopeOverlays: res.overlayFiles || state.scopeOverlays || [],
        nextSdlcCommand: res.nextCommand || '/implement-step',
      })
      const issueKey = primaryIssueKey(state)
      if (issueKey) {
        void postJiraGateEvidence(state.projectId, {
          issueKey,
          gate: 'G-PLAN',
          message: `Technical plan drafted (${(res.technicalPlan?.steps || []).length} step(s)).`,
        }).catch(() => undefined)
      }
      setLastChange(
        `Technical plan ready via ${PLAN_STEPS[3].command}: ${(res.technicalPlan?.steps || []).length} step(s). Next: Shape → Ship.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planning step failed.')
    } finally {
      setBusy(null)
    }
  }, [digest, onUpdate, requirementText, state])

  return (
    <div className="sdlc-plan">
      <header className="sdlc-plan__hero">
        <div className="sdlc-plan__hero-copy">
          <p className="sdlc-plan__eyebrow">Clarify &amp; align</p>
          <h2>SDLC planning</h2>
          <p className="muted">
            One action walks the official command chain. When the plan is ready, shape the project and
            ship draft PRs later — not here.
          </p>
        </div>
        <div className="sdlc-plan__meter" aria-label={`Planning progress ${progressPct} percent`}>
          <div className="sdlc-plan__meter-ring">
            <strong>{doneCount}</strong>
            <span>of {PLAN_STEPS.length}</span>
          </div>
          <div className="sdlc-plan__meter-bar">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <p className="sdlc-plan__meter-label">
            {complete ? 'Ready for Shape & Ship' : busy ? 'Working…' : nextId ? `Next: ${PLAN_STEPS.find((s) => s.id === nextId)?.command}` : 'Waiting'}
          </p>
        </div>
      </header>

      {blockedMsg && !busy ? (
        <p className="status-banner info">
          <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {blockedMsg}
        </p>
      ) : null}
      {error ? <p className="status-banner error">{error}</p> : null}
      {lastChange && !error ? <p className="status-banner success">{lastChange}</p> : null}
      {complete ? (
        <p className="status-banner success">
          Planning complete. Continue to <strong>Project Shape</strong> → Repositories → <strong>Ship</strong>{' '}
          for <code>/implement-step</code> and <code>/qa-validation</code>.
        </p>
      ) : null}

      <ol className="sdlc-timeline">
        {PLAN_STEPS.map((step, index) => {
          const status = statuses[step.id]
          const Icon = step.icon
          const done = status === 'done'
          const active = status === 'current' || status === 'running' || status === 'error' || status === 'blocked'
          return (
            <li key={step.id} className={`sdlc-timeline__item is-${status}${active ? ' is-active' : ''}`}>
              <div className="sdlc-timeline__rail" aria-hidden="true">
                <span className="sdlc-timeline__dot">
                  {status === 'running' ? (
                    <Loader2 className="spin" size={16} />
                  ) : done ? (
                    <CheckCircle2 size={16} />
                  ) : status === 'blocked' || status === 'error' ? (
                    <AlertCircle size={16} />
                  ) : status === 'current' ? (
                    <Sparkles size={16} />
                  ) : (
                    <Circle size={16} />
                  )}
                </span>
                {index < PLAN_STEPS.length - 1 ? <span className="sdlc-timeline__line" /> : null}
              </div>
              <div className="sdlc-timeline__card">
                <div className="sdlc-timeline__head">
                  <Icon size={18} />
                  <div>
                    <h3>{step.title}</h3>
                    <p className="muted small">
                      <code>{step.command}</code>
                      <span className={`sdlc-chip sdlc-chip--${status}`}>{status}</span>
                    </p>
                  </div>
                </div>
                <p className="sdlc-timeline__plain">{step.plain}</p>
                {done ? <p className="sdlc-timeline__outcome">{outcomeFor(step.id, state)}</p> : null}
                {status === 'running' ? (
                  <p className="sdlc-timeline__outcome is-running">Calling hosted agent…</p>
                ) : null}
                {status === 'current' && !blockedMsg ? (
                  <p className="sdlc-timeline__outcome is-next">This runs when you continue.</p>
                ) : null}
                {status === 'blocked' && blockedMsg ? (
                  <p className="sdlc-timeline__outcome is-blocked">{blockedMsg}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="sdlc-plan__cta">
        <button
          type="button"
          className="primary-btn large sdlc-plan__continue"
          disabled={!canContinue}
          onClick={() => void runNext()}
        >
          {busy ? <Loader2 className="spin" size={18} /> : complete ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
          {continueLabel}
        </button>
        {!complete && nextId && !blockedMsg ? (
          <p className="muted small">
            Runs <code>{PLAN_STEPS.find((s) => s.id === nextId)?.command}</code> only — then stops so you can
            review what changed.
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function validateSdlcPlanning(_state: WizardState): string | null {
  return null
}
