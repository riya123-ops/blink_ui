import { createJiraIssues, planProductScope, type CreateJiraIssuesPayload } from '../api/blink'
import type { WizardState } from './types'

export function jiraConnection(state: WizardState) {
  return state.integrations.find((item) => item.id === 'jira')
}

export function isJiraReady(state: WizardState): boolean {
  const jira = jiraConnection(state)
  return Boolean(state.projectId && jira?.connected && jira.projectKey)
}

export function toCreateJiraPayload(state: WizardState): CreateJiraIssuesPayload | null {
  const jira = jiraConnection(state)
  if (!state.projectId || !jira?.connected || !jira.projectKey) return null
  const epics = state.productScope?.epics || []
  const stories = state.productScope?.stories || []
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
    stories: stories.map((story) => ({
      id: story.id,
      epicId: story.epicId || epics.find((epic) => epic.storyIds?.includes(story.id))?.id,
      title: story.title,
      objective: story.objective,
      asA: story.asA,
      iWant: story.iWant,
      soThat: story.soThat,
      acceptanceCriteria: story.acceptanceCriteria,
    })),
  }
}

export async function planScopeFromWording(
  state: WizardState,
  requirementText: string,
): Promise<Partial<WizardState>> {
  const wording = requirementText.trim()
  if (!wording) {
    throw new Error('Add a cleared requirement first so Blink can propose epics and stories.')
  }
  const scopeRes = await planProductScope(state.projectId, {
    projectName: state.projectName,
    requirementText: wording,
    actor: 'operator',
  })
  if (scopeRes?.status === 'ok' && scopeRes.productScope) {
    return {
      productScope: scopeRes.productScope,
      scopeDigest: scopeRes.proposalDigest,
      nextSdlcCommand: scopeRes.nextCommand || '/confirm-product-scope',
    }
  }
  throw new Error(scopeRes?.message || 'Product scope planning did not return epics yet.')
}

export async function createJiraIssuesFromState(state: WizardState) {
  const payload = toCreateJiraPayload(state)
  if (!payload) {
    throw new Error('Connect Jira and choose a project on Integrations first.')
  }
  const result = await createJiraIssues(payload)
  return {
    issues: result.issues || [],
    status: result.status,
    message: result.message,
  }
}
