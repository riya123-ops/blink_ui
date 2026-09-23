import type { FigmaDesignBindingResult } from '../api/blink'
import type {
  DesignOption,
  DesignOptionsState,
  FigmaDesignState,
  FigmaJiraRef,
  FigmaScreenBinding,
  FigmaStoryRef,
  WizardState,
} from './types'

export function figmaStoryRefs(state: WizardState): FigmaStoryRef[] {
  return (state.productScope?.stories || [])
    .filter((story) => story.id && story.title)
    .map((story) => ({ id: story.id, title: story.title }))
}

export function figmaJiraRefs(state: WizardState): FigmaJiraRef[] {
  return (state.jiraCreatedIssues || [])
    .filter((item) => item.sourceId && item.jiraKey && item.status === 'created')
    .map((item) => ({ sourceId: item.sourceId as string, jiraKey: item.jiraKey as string }))
}

function normalizeName(raw?: string | null): string {
  return (raw || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function screenStoryScore(screenName: string, storyTitle: string): number {
  const screen = normalizeName(screenName)
  const story = normalizeName(storyTitle)
  if (!screen || !story) return 0
  if (screen === story) return 1000
  if (screen.length >= 4 && story.length >= 4 && (screen.includes(story) || story.includes(screen))) {
    return 100 + Math.min(screen.length, story.length)
  }
  const screenTokens = new Set(screen.split(' ').filter((token) => token.length >= 3))
  let overlap = 0
  for (const token of story.split(' ')) {
    if (token.length >= 3 && screenTokens.has(token)) overlap += 1
  }
  return overlap > 0 ? overlap * 10 : 0
}

/** Bind unbound Figma frames to stories: name match first, then leftover screens in order. */
export function autoLinkFigmaScreens(
  screens: FigmaScreenBinding[] | undefined,
  stories: FigmaStoryRef[],
  jiraIssues: Array<{ sourceId?: string; jiraKey?: string | null; status?: string }>,
): FigmaScreenBinding[] {
  const jiraBySource = new Map<string, string>()
  for (const item of jiraIssues) {
    if (item.sourceId && item.jiraKey && item.status !== 'failed' && item.status !== 'creating') {
      jiraBySource.set(item.sourceId, item.jiraKey)
    }
  }
  const storyList = stories.filter((story) => story.id)
  const usedStories = new Set(
    (screens || []).map((screen) => screen.storyId).filter((id): id is string => Boolean(id)),
  )
  const next = (screens || []).map((screen) => ({ ...screen }))

  for (const screen of next) {
    if (screen.storyId) continue
    let bestId: string | null = null
    let bestScore = 0
    for (const story of storyList) {
      if (usedStories.has(story.id)) continue
      const score = screenStoryScore(screen.name, story.title)
      if (score > bestScore) {
        bestScore = score
        bestId = story.id
      }
    }
    if (bestId) {
      screen.storyId = bestId
      usedStories.add(bestId)
    }
  }

  const leftoverScreens = next.filter((screen) => !screen.storyId)
  const leftoverStories = storyList.filter((story) => !usedStories.has(story.id))
  const pairCount = Math.min(leftoverScreens.length, leftoverStories.length)
  for (let i = 0; i < pairCount; i += 1) {
    leftoverScreens[i].storyId = leftoverStories[i].id
    usedStories.add(leftoverStories[i].id)
  }

  return next.map((screen) => ({
    ...screen,
    jiraKey: screen.storyId ? jiraBySource.get(screen.storyId) || screen.jiraKey || null : screen.jiraKey || null,
  }))
}

export function designFromBinding(result: FigmaDesignBindingResult, previous?: FigmaDesignState | null): FigmaDesignState {
  const incomingScreens = result.screens && result.screens.length > 0 ? result.screens : previous?.screens || []
  const summary = usableSyncSummary(result.lastSyncSummary) || usableSyncSummary(previous?.lastSyncSummary)
  return {
    fileKey: result.fileKey || previous?.fileKey,
    fileName: result.fileName || previous?.fileName,
    fileUrl: result.fileUrl || previous?.fileUrl,
    fileVersion: result.fileVersion ?? previous?.fileVersion,
    syncJira: result.syncJira ?? previous?.syncJira ?? true,
    webhookId: result.webhookId ?? previous?.webhookId,
    webhookStatus: result.webhookStatus ?? previous?.webhookStatus,
    lastSyncedAt: result.lastSyncedAt ?? previous?.lastSyncedAt,
    lastSyncSummary: summary,
    markdown: result.markdown ?? previous?.markdown,
    screens: incomingScreens,
    availableFiles: previous?.availableFiles,
    changes: result.changes || [],
  }
}

function usableSyncSummary(value?: string | null): string | undefined {
  if (!value || /rate.?limit|paused file reads/i.test(value)) return undefined
  return value
}

export function designOptionsFingerprint(
  state: Pick<WizardState, 'productScope' | 'groomDraft' | 'requirementsText'>,
): string {
  const stories = (state.productScope?.stories || [])
    .map((story) => `${story.id || ''}:${story.title || ''}`)
    .join('|')
  const req = (state.groomDraft || state.requirementsText || '').trim()
  return `${stories}::${req.length}:${req.slice(0, 80)}`
}

export function screensFromOption(option: DesignOption): FigmaScreenBinding[] {
  return (option.screens || []).map((screen) => ({
    nodeId: screen.id || screen.name,
    name: screen.name,
    storyId: screen.storyId || null,
    type: 'proposed',
  }))
}

export function mergeChosenIntoFigma(
  previous: FigmaDesignState | null | undefined,
  option: DesignOption,
  markdown?: string,
): FigmaDesignState {
  return {
    ...(previous || {}),
    screens: screensFromOption(option),
    markdown: markdown || previous?.markdown,
    lastSyncSummary: `Chose ${option.name}. Blink did not create a Figma file.`,
  }
}

export function applyOptionStoriesToScreens(
  screens: FigmaScreenBinding[],
  option: DesignOption,
): FigmaScreenBinding[] {
  const byName = new Map(
    (option.screens || []).map((screen) => [screen.name.trim().toLowerCase(), screen]),
  )
  return screens.map((screen) => {
    const match = byName.get((screen.name || '').trim().toLowerCase())
    if (!match) return screen
    return { ...screen, storyId: match.storyId || screen.storyId }
  })
}

export function designOptionsFromSpec(
  spec: { options?: DesignOption[]; markdown?: string } | null | undefined,
  fingerprint: string,
  message?: string,
): DesignOptionsState {
  return {
    status: 'ready',
    fingerprint,
    message,
    markdown: spec?.markdown,
    options: spec?.options || [],
    chosenId: null,
  }
}
