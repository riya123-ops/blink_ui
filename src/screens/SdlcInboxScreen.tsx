import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Copy,
  GitBranch,
  Inbox,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import {
  answerTask,
  getRun,
  listRuns,
  listRunners,
  listTasks,
  registerRunner,
  startRun,
  type HumanTask,
  type JobEvent,
  type RunDetail,
  type Runner,
  type RunnerJob,
} from '../api/workflow'

const RUN_KEY = (projectId: string) => `blink.tracerRun.${projectId}`

function asPayload(raw: unknown): Record<string, unknown> | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : undefined
    } catch {
      return undefined
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return undefined
}

function payloadString(payload: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!payload) return ''
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function payloadList(payload: Record<string, unknown> | undefined, ...keys: string[]): string[] {
  if (!payload) return []
  for (const key of keys) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).filter(Boolean)
    }
  }
  return []
}

function jobPrUrl(job: RunnerJob | undefined): string {
  const result = job?.result
  if (!result || typeof result !== 'object') return ''
  const url = result.prUrl || result.pr_url || result.registered_pr
  return typeof url === 'string' ? url : ''
}

function statusLabel(status: string, stage?: string): string {
  if (status === 'WAITING_FOR_HUMAN' && stage === 'MERGE') {
    return 'Attest the draft PR — Blink will not merge'
  }
  if (status === 'WAITING_FOR_HUMAN' && stage === 'PLAN') {
    return 'G-PLAN is waiting'
  }
  if (status === 'WAITING_FOR_HUMAN' && stage === 'SECURITY') {
    return 'G-SEC is waiting'
  }
  switch (status) {
    case 'WAITING_FOR_HUMAN':
      return 'Waiting for your approval'
    case 'WAITING_FOR_RUNNER':
      return 'Waiting for the local runner'
    case 'RUNNING':
      return 'OpenHands is working on the machine'
    case 'COMPLETED':
      return 'You attested this draft PR. Blink did not merge.'
    case 'FAILED':
      return 'Run failed'
    default:
      return status.replace(/_/g, ' ').toLowerCase()
  }
}

function taskTitle(task: HumanTask): string {
  const gate = payloadString(asPayload(task.payload), 'gate')
  switch (task.kind) {
    case 'CONFIRM_RISKY':
      return 'Confirm a risky OpenHands action'
    case 'MERGE_ATTESTATION':
      return 'Attest the draft PR'
    default:
      if (gate === 'G-PLAN') return 'Approve the technical plan'
      if (gate === 'G-SEC') return 'Approve the security review'
      return 'Approve requirement wording'
  }
}

function taskHint(task: HumanTask): string {
  const summary = payloadString(asPayload(task.payload), 'summary')
  if (summary) return summary
  switch (task.kind) {
    case 'CONFIRM_RISKY':
      return 'This does not start a second job. The same runner resumes the conversation.'
    case 'MERGE_ATTESTATION':
      return 'G-PR-MERGE. Record that you reviewed and tested this commit. Blink never merges.'
    default:
      return 'G-GROOM. Implementation waits until you approve.'
  }
}

function eventLabel(event: JobEvent): string {
  switch (event.eventType) {
    case 'confirm_risky':
      return 'ConfirmRisky'
    case 'openhands_started':
      return 'OpenHands started'
    case 'openhands_finished':
      return 'OpenHands finished'
    default:
      return event.eventType.replace(/_/g, ' ')
  }
}

interface Props {
  projectId?: string | null
  requirementText: string
  questions?: Array<{ id: string; question: string; mandatory?: boolean }>
  responses?: Array<{ questionId: string; status?: string; response?: string }>
  onAnswerQuestion?: (questionId: string, text: string) => void
  onNavigate?: (step: 'stakeholder-qa') => void
}

export function SdlcInboxScreen({
  projectId,
  requirementText,
  questions = [],
  responses = [],
  onAnswerQuestion,
  onNavigate,
}: Props) {
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [tasks, setTasks] = useState<HumanTask[]>([])
  const [runners, setRunners] = useState<Runner[]>([])
  const [runnerName, setRunnerName] = useState('devbox')
  const [freshToken, setFreshToken] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [clarifyDrafts, setClarifyDrafts] = useState<Record<string, string>>({})

  const wording = requirementText.trim()
  const runId = detail?.run.id
  const openTasks = useMemo(
    () => (detail?.tasks || tasks).filter((task) => task.status === 'OPEN' && (!runId || task.runId === runId)),
    [detail, tasks, runId],
  )
  const job = detail?.jobs?.[0]
  const prUrl =
    jobPrUrl(job)
    || payloadString(asPayload(openTasks.find((task) => task.kind === 'MERGE_ATTESTATION')?.payload), 'prUrl', 'pr_url')
  const events = detail?.events || []
  const polling = Boolean(
    detail && ['WAITING_FOR_HUMAN', 'WAITING_FOR_RUNNER', 'RUNNING'].includes(detail.run.status),
  )

  const refresh = useCallback(async (id?: string) => {
    if (!projectId) return
    const [taskRes, runnerRes, runRes] = await Promise.all([
      listTasks(projectId),
      listRunners(),
      listRuns(projectId),
    ])
    setTasks(taskRes.tasks || [])
    setRunners(runnerRes.runners || [])
    const stored = id || (typeof window !== 'undefined' ? window.localStorage.getItem(RUN_KEY(String(projectId))) : null)
    const latest = stored || runRes.runs?.[0]?.id
    if (!latest) {
      setDetail(null)
      return
    }
    const next = await getRun(projectId, latest)
    setDetail(next)
    window.localStorage.setItem(RUN_KEY(String(projectId)), next.run.id)
  }, [projectId])

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not load inbox.')
    })
  }, [refresh])

  useEffect(() => {
    if (!polling || !projectId || !runId) return
    const timer = window.setInterval(() => {
      void getRun(projectId, runId)
        .then((next) => setDetail(next))
        .catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [polling, projectId, runId])

  const begin = async () => {
    if (!projectId || !wording) return
    setBusy('start')
    setError(null)
    try {
      const next = await startRun(projectId, wording)
      setDetail(next)
      window.localStorage.setItem(RUN_KEY(String(projectId)), next.run.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the run.')
    } finally {
      setBusy(null)
    }
  }

  const answer = async (task: HumanTask, payload: Record<string, unknown>) => {
    setBusy(task.id)
    setError(null)
    try {
      const next = await answerTask(task.id, payload)
      setDetail(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer the task.')
    } finally {
      setBusy(null)
    }
  }

  const pair = async () => {
    setBusy('pair')
    setError(null)
    try {
      const runner = await registerRunner(runnerName.trim() || 'devbox')
      setFreshToken(runner.token || '')
      const listed = await listRunners()
      setRunners(listed.runners || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pair a runner.')
    } finally {
      setBusy(null)
    }
  }

  const copyToken = async () => {
    if (!freshToken) return
    try {
      await navigator.clipboard.writeText(freshToken)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy the token. Select it and copy manually.')
    }
  }

  const online = runners.some((runner) => runner.status === 'ONLINE')
  const workTier = detail?.run.workTier || 1
  const requiredGates = detail?.run.requiredGates || []
  const pendingQuestions = questions.filter((question) => {
    const response = responses.find((item) => item.questionId === question.id)
    return !(response?.status === 'answered' && response.response?.trim())
  })

  return (
    <div className="screen shape-screen inbox-screen">
      <div className="screen-header">
        <h2>
          <Inbox size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Inbox
        </h2>
        <p>
          Human gates, ConfirmRisky pauses, and merge attestation live here. The browser never talks
          to localhost. Blink never merges.
        </p>
      </div>

      {!projectId ? (
        <p className="muted small">Save the project first so the run has somewhere to live.</p>
      ) : null}
      {projectId && !wording ? (
        <p className="muted small">Need requirement wording from Groom or Requirements before starting.</p>
      ) : null}

      {wording ? <blockquote className="tracer-run__wording">{wording}</blockquote> : null}

      <div className="ship-actions">
        <button
          type="button"
          className="primary-btn"
          disabled={!projectId || !wording || busy === 'start'}
          onClick={() => void begin()}
        >
          {busy === 'start' ? <Loader2 className="spin" size={16} /> : <GitBranch size={16} />}
          {detail ? 'Start another run' : 'Start implementation run'}
        </button>
      </div>

      {detail ? (
        <section className="card shape-section ship-step-card tracer-run">
          <div className="sdlc-panel__head">
            <Inbox size={18} />
            <div>
              <p className="shape-kicker">Work tier {workTier}</p>
              <h3>{statusLabel(detail.run.status, detail.run.currentStage)}</h3>
              <p className="muted">
                {requiredGates.length ? `Required gates: ${requiredGates.join(', ')}` : 'G-GROOM and G-PR-MERGE are always on.'}
                {job?.status ? ` · job ${job.status}` : ''}
                {job?.conversationId ? ` · conversation ${job.conversationId.slice(0, 8)}` : ''}
              </p>
            </div>
            {detail.run.status === 'COMPLETED' ? <CheckCircle2 className="ok" size={18} /> : null}
          </div>
        </section>
      ) : null}

      {openTasks.map((task) => {
        const payload = asPayload(task.payload)
        const risk = payloadString(payload, 'risk')
        const blocked = payloadList(payload, 'blocked_actions', 'blockedActions')
        const conversationId = payloadString(payload, 'conversationId', 'conversation_id')
        const headSha = payloadString(payload, 'headSha', 'head_sha')
        const taskPr = payloadString(payload, 'prUrl', 'pr_url', 'registered_pr')
        return (
          <div key={task.id} className="card shape-section ship-step-card tracer-run__task">
            <div>
              <strong>{taskTitle(task)}</strong>
              <p className="muted small">{taskHint(task)}</p>
              {task.kind === 'CONFIRM_RISKY' ? (
                <p className="muted small">
                  Risk {risk || 'HIGH'}
                  {conversationId ? ` · conversation ${conversationId.slice(0, 8)}` : ''}
                </p>
              ) : null}
              {blocked.length ? (
                <ul className="inbox-blocked">
                  {blocked.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {task.kind === 'MERGE_ATTESTATION' && (taskPr || headSha) ? (
                <p className="muted small">
                  {taskPr ? (
                    <a href={taskPr} target="_blank" rel="noreferrer">
                      Draft PR
                    </a>
                  ) : null}
                  {headSha ? ` · ${headSha.slice(0, 12)}` : ''}
                  {payloadString(payload, 'merge_readiness_state')
                    ? ` · ${payloadString(payload, 'merge_readiness_state')}`
                    : ''}
                </p>
              ) : null}
            </div>
            <div className="ship-actions">
              {task.kind === 'CONFIRM_RISKY' ? (
                <>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busy === task.id}
                    onClick={() => void answer(task, { accept: true, reason: 'approved from Blink' })}
                  >
                    <ShieldCheck size={16} /> Allow
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    disabled={busy === task.id}
                    onClick={() => void answer(task, { accept: false, reason: 'rejected from Blink' })}
                  >
                    Reject
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="primary-btn"
                  disabled={busy === task.id}
                  onClick={() =>
                    void answer(
                      task,
                      task.kind === 'MERGE_ATTESTATION'
                        ? {
                            attested: true,
                            reviewed: true,
                            tested: true,
                            reviewed_commit: headSha,
                            tested_commit: headSha,
                          }
                        : { approved: true },
                    )
                  }
                >
                  <ShieldCheck size={16} />
                  {task.kind === 'MERGE_ATTESTATION' ? 'Attest review' : 'Approve'}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {pendingQuestions.length ? (
        <section className="card shape-section ship-step-card inbox-clarify">
          <p className="shape-kicker">Clarifying questions</p>
          <p className="muted small">Answer here instead of waiting on email or Jira. Full compose stays on Stakeholder Q&amp;A.</p>
          {pendingQuestions.map((question) => (
            <div key={question.id} className="tracer-run__task">
              <strong>{question.mandatory ? 'Required' : 'Optional'}</strong>
              <p>{question.question}</p>
              <textarea
                rows={3}
                value={clarifyDrafts[question.id] || ''}
                onChange={(event) =>
                  setClarifyDrafts((prev) => ({ ...prev, [question.id]: event.target.value }))
                }
                aria-label={`Answer: ${question.question}`}
              />
              <div className="ship-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!onAnswerQuestion || !(clarifyDrafts[question.id] || '').trim()}
                  onClick={() => {
                    const text = (clarifyDrafts[question.id] || '').trim()
                    if (!text || !onAnswerQuestion) return
                    onAnswerQuestion(question.id, text)
                    setClarifyDrafts((prev) => ({ ...prev, [question.id]: '' }))
                  }}
                >
                  Record answer
                </button>
              </div>
            </div>
          ))}
          {onNavigate ? (
            <button type="button" className="secondary-btn" onClick={() => onNavigate('stakeholder-qa')}>
              Open Stakeholder Q&amp;A
            </button>
          ) : null}
        </section>
      ) : null}

      {detail?.artifacts?.length ? (
        <section className="card shape-section ship-step-card">
          <p className="shape-kicker">Evidence</p>
          <ul className="inbox-blocked">
            {detail.artifacts.map((artifact) => (
              <li key={artifact.id}>
                {artifact.kind}
                {artifact.contentHash ? ` · ${artifact.contentHash.slice(0, 12)}` : ''}
                {artifact.uri ? (
                  <>
                    {' · '}
                    <a href={artifact.uri} target="_blank" rel="noreferrer">
                      {artifact.uri}
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {events.length ? (
        <section className="card shape-section ship-step-card">
          <p className="shape-kicker">Timeline</p>
          <ol className="inbox-timeline">
            {events.map((event) => (
              <li key={event.id}>
                <strong>{eventLabel(event)}</strong>
                <span className="muted small">
                  {event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : ''}
                  {payloadString(asPayload(event.payload), 'prUrl', 'pr_url')
                    ? ` · ${payloadString(asPayload(event.payload), 'prUrl', 'pr_url')}`
                    : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="card shape-section ship-step-card tracer-run__runner">
        <p className="muted small">
          Local runner: {runners.length ? `${runners.length} paired` : 'none yet'}
          {online ? ' · online' : runners.length ? ' · offline (start Docker + poller)' : ''}
        </p>
        <div className="ship-actions">
          <div className="field-group">
            <input
              value={runnerName}
              onChange={(event) => setRunnerName(event.target.value)}
              placeholder="Runner name"
              aria-label="Runner name"
            />
          </div>
          <button type="button" className="secondary-btn" disabled={busy === 'pair'} onClick={() => void pair()}>
            Pair runner
          </button>
        </div>
        {freshToken ? (
          <p className="tracer-run__token">
            <code>{freshToken}</code>
            <button type="button" className="secondary-btn" onClick={() => void copyToken()}>
              <Copy size={14} /> {copied ? 'Copied' : 'Copy token'}
            </button>
            <span className="muted small">Shown once. Set BLINK_RUNNER_TOKEN on the laptop, then python -m blink_runner.</span>
          </p>
        ) : null}
      </section>

      {prUrl ? (
        <p>
          <a href={prUrl} target="_blank" rel="noreferrer">
            Open draft pull request
          </a>
        </p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  )
}
