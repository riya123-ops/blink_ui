import {
  createJiraIssues,
  planProductScope,
  streamCreateJiraIssues,
  streamPlanProductScope,
  type CreateJiraIssuesPayload,
  type JiraCreatedIssueResult,
} from '../api/blink'
import type { JiraCreatedIssue, WizardState } from './types'

let ticketsPipelineBusy = false
let jiraCreateBusy = false

export function markTicketsPipelineBusy(busy: boolean) {
  ticketsPipelineBusy = busy
}

export function isTicketsPipelineBusy() {
  return ticketsPipelineBusy
}

export function beginJiraCreate(): boolean {
  if (jiraCreateBusy) return false
  jiraCreateBusy = true
  markTicketsPipelineBusy(true)
  return true
}

export function endJiraCreate() {
  jiraCreateBusy = false
  markTicketsPipelineBusy(false)
}

export function isJiraCreateBusy() {
  return jiraCreateBusy
}

export function jiraConnection(state: WizardState) {
  return state.integrations.find((item) => item.id === 'jira')
}

export function isJiraReady(state: WizardState): boolean {
  const jira = jiraConnection(state)
  return Boolean(state.projectId && jira?.connected && jira.projectKey)
}

export function pendingJiraTicketCount(state: WizardState): number {
  const created = new Set(
    (state.jiraCreatedIssues || [])
      .filter((item) => item.status === 'created' && item.sourceId)
      .map((item) => item.sourceId as string),
  )
  const epics = state.productScope?.epics || []
  const stories = state.productScope?.stories || []
  return [...epics, ...stories].filter((item) => item.id && !created.has(item.id)).length
}

export function mergeJiraCreatedIssues(
  current: JiraCreatedIssue[] | undefined,
  incoming: Array<JiraCreatedIssue | JiraCreatedIssueResult>,
): JiraCreatedIssue[] {
  const map = new Map<string, JiraCreatedIssue>()
  for (const item of current || []) {
    if (item.sourceId) map.set(item.sourceId, item)
  }
  for (const item of incoming) {
    const sourceId = item.sourceId
    if (!sourceId) continue
    map.set(sourceId, {
      sourceId,
      jiraKey: item.jiraKey,
      jiraUrl: item.jiraUrl || item.url,
      url: item.url,
      type: item.type,
      status: item.status,
      message: item.message,
    })
  }
  return [...map.values()]
}

export function toCreateJiraPayload(
  state: WizardState,
  opts?: { pendingOnly?: boolean },
): CreateJiraIssuesPayload | null {
  const jira = jiraConnection(state)
  if (!state.projectId || !jira?.connected || !jira.projectKey) return null
  const createdBySource = new Map(
    (state.jiraCreatedIssues || []).filter((item) => item.sourceId).map((item) => [item.sourceId as string, item]),
  )
  let epics = state.productScope?.epics || []
  let stories = state.productScope?.stories || []
  if (opts?.pendingOnly) {
    epics = epics.filter((epic) => createdBySource.get(epic.id)?.status !== 'created')
    stories = stories.filter((story) => createdBySource.get(story.id)?.status !== 'created')
  }
  if (epics.length === 0 && stories.length === 0) return null
  return {
    projectId: state.projectId,
    projectKey: jira.projectKey,
    epics: epics.map((epic) => ({
      id: epic.id,
      title: epic.title,
      objective: epic.objective,
      storyIds: epic.storyIds,
    })),
    stories: stories.map((story) => {
      const epicId = story.epicId || epics.find((epic) => epic.storyIds?.includes(story.id))?.id
      const parent = epicId ? createdBySource.get(epicId) : undefined
      return {
        id: story.id,
        epicId,
        epicKey: parent?.jiraKey || undefined,
        title: story.title,
        objective: story.objective,
        asA: story.asA,
        iWant: story.iWant,
        soThat: story.soThat,
        acceptanceCriteria: story.acceptanceCriteria,
      }
    }),
  }
}

export async function planScopeFromWording(
  state: WizardState,
  requirementText: string,
  onThinking?: (text: string) => void,
): Promise<Partial<WizardState>> {
  const wording = requirementText.trim()
  if (!wording) {
    throw new Error('Add a cleared requirement first so Blink can propose epics and stories.')
  }
  const payload = {
    projectName: state.projectName,
    requirementText: wording,
    actor: 'operator',
  }
  const scopeRes = onThinking
    ? await streamPlanProductScope(state.projectId, payload, { onThinking })
    : await planProductScope(state.projectId, payload)
  if (scopeRes?.status === 'ok' && scopeRes.productScope) {
    return {
      productScope: scopeRes.productScope,
      scopeDigest: scopeRes.proposalDigest,
      scopeOverlays: scopeRes.overlayFiles || [],
      workClassification: null,
      specification: null,
      technicalPlan: null,
      nextSdlcCommand: scopeRes.nextCommand || '/confirm-product-scope',
    }
  }
  throw new Error(scopeRes?.message || 'Product scope planning did not return epics yet.')
}

export async function createJiraIssuesFromState(
  state: WizardState,
  handlers?: {
    pendingOnly?: boolean
    onStart?: (total: number) => void
    onItem?: (issue: JiraCreatedIssue) => void
  },
) {
  const payload = toCreateJiraPayload(state, { pendingOnly: handlers?.pendingOnly })
  if (!payload) {
    throw new Error('Connect Atlassian and choose a Jira project on Integrations first.')
  }
  const result = handlers
    ? await streamCreateJiraIssues(payload, {
        onStart: (total) => handlers.onStart?.(total),
        onItem: (issue) => handlers.onItem?.(issue),
      })
    : await createJiraIssues(payload)
  return {
    issues: result.issues || [],
    status: result.status,
    message: result.message,
  }
}
