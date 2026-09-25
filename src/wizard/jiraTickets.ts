import {
  clarifyProductScope,
  createJiraIssues,
  planProductScope,
  streamCreateJiraIssues,
  streamPlanProductScope,
  type CreateJiraIssuesPayload,
  type JiraCreatedIssueResult,
} from '../api/blink'
import { assignQuestionBands } from './grooming'
import type { JiraCreatedIssue, ProductScopeData, WizardState } from './types'

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

export function dropJiraCreatedIssues(
  current: JiraCreatedIssue[] | undefined,
  sourceIds: string[],
): JiraCreatedIssue[] {
  const drop = new Set(sourceIds)
  return (current || []).filter((item) => !item.sourceId || !drop.has(item.sourceId))
}

/** Tickets created in Jira for epics/stories currently listed on the product-scope screen. */
export function createdTicketsOnScreen(state: WizardState): JiraCreatedIssue[] {
  const onScreen = new Set([
    ...(state.productScope?.epics || []).map((item) => item.id),
    ...(state.productScope?.stories || []).map((item) => item.id),
  ])
  return (state.jiraCreatedIssues || []).filter(
    (item) =>
      item.status === 'created' &&
      Boolean(item.jiraKey) &&
      Boolean(item.sourceId) &&
      onScreen.has(item.sourceId as string),
  )
}

/** Jira keys for this screen only — stories first so epics are not deleted while their children remain. */
export function jiraKeysCreatedOnScreen(state: WizardState): string[] {
  const created = createdTicketsOnScreen(state)
  const epicIds = new Set((state.productScope?.epics || []).map((item) => item.id))
  const stories = created.filter((item) => !epicIds.has(item.sourceId as string))
  const epics = created.filter((item) => epicIds.has(item.sourceId as string))
  return [...stories, ...epics].map((item) => item.jiraKey as string)
}

export function idsForEpicRemoval(scope: ProductScopeData | null | undefined, epicId: string): string[] {
  const epic = scope?.epics?.find((item) => item.id === epicId)
  const childIds = (scope?.stories || [])
    .filter((story) => story.epicId === epicId || epic?.storyIds?.includes(story.id))
    .map((story) => story.id)
  return [epicId, ...childIds]
}

export function removePlannedTickets(
  scope: ProductScopeData | null | undefined,
  sourceIds: string[],
  opts?: { keepOrphanStories?: boolean },
): ProductScopeData | null {
  if (!scope) return null
  const drop = new Set(sourceIds)
  const epics = (scope.epics || [])
    .filter((epic) => !drop.has(epic.id))
    .map((epic) => ({
      ...epic,
      storyIds: epic.storyIds?.filter((id) => !drop.has(id)),
    }))
  const remainingEpicIds = new Set(epics.map((epic) => epic.id))
  const stories = (scope.stories || [])
    .filter((story) => {
      if (drop.has(story.id)) return false
      if (opts?.keepOrphanStories) return true
      return !story.epicId || !drop.has(story.epicId)
    })
    .map((story) => {
      if (!opts?.keepOrphanStories) return story
      if (story.epicId && !remainingEpicIds.has(story.epicId)) {
        return { ...story, epicId: undefined }
      }
      return story
    })
  return {
    ...scope,
    epics,
    stories,
    epicIds: epics.map((epic) => epic.id),
    storyIds: stories.map((story) => story.id),
  }
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

export type PlanScopeOptions = {
  productScope?: WizardState['productScope']
  answers?: WizardState['scopeAnswers']
  refresh?: boolean
  skipClarify?: boolean
}

export async function planScopeFromWording(
  state: WizardState,
  requirementText: string,
  onThinking?: (text: string) => void,
  opts?: PlanScopeOptions,
): Promise<Partial<WizardState>> {
  const wording = requirementText.trim()
  if (!wording) {
    throw new Error('Add a cleared requirement first so Blink can propose epics and stories.')
  }
  const payload = {
    projectName: state.projectName,
    requirementText: wording,
    actor: 'operator',
    refresh: opts?.refresh,
    productScope: opts?.productScope ?? undefined,
    answers: opts?.answers,
  }
  const scopeRes = onThinking
    ? await streamPlanProductScope(state.projectId, payload, { onThinking })
    : await planProductScope(state.projectId, payload)
  if (scopeRes?.status === 'ok' && scopeRes.productScope) {
    const patch: Partial<WizardState> = {
      productScope: scopeRes.productScope,
      scopeDigest: scopeRes.proposalDigest,
      scopeOverlays: scopeRes.overlayFiles || [],
      workClassification: null,
      specification: null,
      technicalPlan: null,
      nextSdlcCommand: scopeRes.nextCommand || '/confirm-product-scope',
    }
    if (!opts?.skipClarify && !opts?.refresh) {
      try {
        const clarify = await clarifyProductScope(state.projectId, {
          projectName: state.projectName,
          requirementText: wording,
          productScope: scopeRes.productScope,
        })
        if (clarify.status === 'need_choices' && (clarify.questions?.length || 0) > 0) {
          patch.scopeQuestions = assignQuestionBands(clarify.questions || [])
          patch.scopeClarifyStatus = 'need_choices'
          patch.scopeAnswers = []
        } else {
          patch.scopeQuestions = []
          patch.scopeClarifyStatus = clarify.status || 'draft_ready'
        }
      } catch {
        patch.scopeClarifyStatus = patch.scopeClarifyStatus ?? null
      }
    }
    if (opts?.refresh) {
      patch.scopeQuestions = []
      patch.scopeClarifyStatus = 'draft_ready'
    }
    return patch
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
