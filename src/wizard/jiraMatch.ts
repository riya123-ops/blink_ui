import type { EpicSummary, StorySummary, WizardState } from './types'

export interface MatchableIssue {
  key: string
  url?: string | null
  title: string
  objective?: string
  type: 'Epic' | 'Story'
  sourceId?: string
}

/** Flatten created Jira issues with titles from product scope when possible. */
export function matchableJiraIssues(state: WizardState): MatchableIssue[] {
  const epics = state.productScope?.epics || []
  const stories = state.productScope?.stories || []
  const created = state.jiraCreatedIssues || []
  const bySource = new Map(created.filter((item) => item.sourceId).map((item) => [item.sourceId!, item]))
  const issues: MatchableIssue[] = []

  const pushEpic = (epic: EpicSummary) => {
    const row = bySource.get(epic.id)
    if (!row?.jiraKey || row.status !== 'created') return
    issues.push({
      key: row.jiraKey,
      url: row.jiraUrl,
      title: epic.title,
      objective: epic.objective,
      type: 'Epic',
      sourceId: epic.id,
    })
  }
  const pushStory = (story: StorySummary) => {
    const row = bySource.get(story.id)
    if (!row?.jiraKey || row.status !== 'created') return
    issues.push({
      key: row.jiraKey,
      url: row.jiraUrl,
      title: story.title,
      objective: story.objective,
      type: 'Story',
      sourceId: story.id,
    })
  }

  for (const epic of epics) pushEpic(epic)
  for (const story of stories) pushStory(story)

  // Fallback: created rows without scope match
  for (const row of created) {
    if (row.status !== 'created' || !row.jiraKey) continue
    if (issues.some((item) => item.key === row.jiraKey)) continue
    issues.push({
      key: row.jiraKey,
      url: row.jiraUrl,
      title: row.jiraKey,
      type: row.type === 'Epic' ? 'Epic' : 'Story',
      sourceId: row.sourceId || undefined,
    })
  }
  return issues
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2),
  )
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let hits = 0
  for (const word of a) {
    if (b.has(word)) hits += 1
  }
  return hits / Math.max(a.size, 1)
}

/** Word-overlap match; weak match falls back to first epic (or first issue). */
export function matchQuestionToJiraIssue(
  questionText: string,
  issues: MatchableIssue[],
): MatchableIssue | null {
  if (!issues.length) return null
  const qTokens = tokens(questionText)
  let best: MatchableIssue | null = null
  let bestScore = 0
  for (const issue of issues) {
    const hay = tokens(`${issue.title} ${issue.objective || ''}`)
    const score = overlapScore(qTokens, hay)
    if (score > bestScore) {
      bestScore = score
      best = issue
    }
  }
  if (best && bestScore >= 0.12) return best
  return issues.find((item) => item.type === 'Epic') || issues[0] || null
}

export const BLINK_QUESTION_MARKER_PREFIX = '<!-- blink-question:'

export function blinkQuestionMarker(questionId: string): string {
  return `<!-- blink-question:${questionId} -->`
}

export function parseBlinkQuestionMarker(body: string): string | null {
  const match = body.match(/<!--\s*blink-question:([^>\s]+)\s*-->/i)
  return match?.[1]?.trim() || null
}

export function buildJiraClarifyComment(options: {
  questionId: string
  question: string
  personName: string
  roleLabel: string
  proposedAnswer?: string
}): string {
  const lines = [
    blinkQuestionMarker(options.questionId),
    `Blink clarification for ${options.personName} (${options.roleLabel})`,
    '',
    `Question: ${options.question}`,
  ]
  if (options.proposedAnswer?.trim()) {
    lines.push('', `Proposed answer (operator proxy): ${options.proposedAnswer.trim()}`)
  }
  lines.push('', 'Please reply on this ticket with your confirmation or corrected answer.')
  return lines.join('\n')
}
