import { loadAuthSession } from '../auth/session'
import { apiUrl } from './blink'

export type WorkflowRun = {
  id: string
  projectId: number
  status: string
  currentStage: string
  requirementHash?: string
  requirementText?: string
  workTier?: number
  requiredGates?: string[]
  openTaskCount?: number
  waitingForRunner?: boolean
}

export type HumanTask = {
  id: string
  runId: string
  kind: string
  status: string
  assignedRole?: string
  boundHash?: string
  payload?: Record<string, unknown>
  answer?: Record<string, unknown>
}

export type Runner = {
  id: string
  name: string
  status: string
  token?: string
  allowlist?: string[]
}

export type RunnerJob = {
  id: string
  runId?: string
  status: string
  placement?: string
  conversationId?: string
  operationId?: string
  result?: Record<string, unknown> | null
}

export type JobEvent = {
  id: number
  jobId: string
  eventType: string
  payload?: Record<string, unknown>
  createdAt?: string
}

export type Artifact = {
  id: string
  runId: string
  kind: string
  contentHash: string
  uri?: string
}

export type RunDetail = {
  run: WorkflowRun
  tasks: HumanTask[]
  jobs: RunnerJob[]
  steps: Array<Record<string, unknown>>
  events?: JobEvent[]
  artifacts?: Artifact[]
}

function headers(json = false): HeadersInit {
  const out: Record<string, string> = {}
  if (json) out['Content-Type'] = 'application/json'
  const session = loadAuthSession()
  if (session?.token) out.Authorization = `Bearer ${session.token}`
  return out
}

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text) as { message?: string }
    return parsed.message || text || `Request failed (${response.status})`
  } catch {
    return text || `Request failed (${response.status})`
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<T>
}

export function startRun(projectId: string | number, requirementText: string) {
  return fetch(apiUrl(`/projects/${projectId}/runs`), {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ requirementText }),
  }).then((res) => parse<RunDetail>(res))
}

export function listRuns(projectId: string | number) {
  return fetch(apiUrl(`/projects/${projectId}/runs`), { headers: headers() }).then((res) =>
    parse<{ runs: WorkflowRun[] }>(res),
  )
}

export function getRun(projectId: string | number, runId: string) {
  return fetch(apiUrl(`/projects/${projectId}/runs/${runId}`), { headers: headers() }).then((res) => parse<RunDetail>(res))
}

export function listTasks(projectId?: string | number) {
  const q = projectId ? `?projectId=${encodeURIComponent(String(projectId))}` : ''
  return fetch(apiUrl(`/tasks${q}`), { headers: headers() }).then((res) => parse<{ tasks: HumanTask[] }>(res))
}

export function answerTask(taskId: string, answer: Record<string, unknown> = { approved: true }) {
  return fetch(apiUrl(`/tasks/${taskId}/answer`), {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(answer),
  }).then((res) => parse<RunDetail>(res))
}

export function registerRunner(name: string, allowlist: string[] = []) {
  return fetch(apiUrl('/runners'), {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify({ name, allowlist }),
  }).then((res) => parse<Runner>(res))
}

export function listRunners() {
  return fetch(apiUrl('/runners'), { headers: headers() }).then((res) => parse<{ runners: Runner[] }>(res))
}
