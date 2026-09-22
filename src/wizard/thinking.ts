/** Auto-start helpers for Clarify and local ticket planning. Jira create is explicit. */

export function shouldAutoStartClarify(input: {
  hasPaste: boolean
  questionCount: number
  groomStatus: string | null
}): boolean {
  if (!input.hasPaste) return false
  if (input.questionCount > 0) return false
  if (input.groomStatus === 'draft_ready') return false
  if (input.groomStatus === 'need_choices') return false
  if (input.groomStatus === 'error') return false
  return true
}

export function shouldAutoStartTickets(input: {
  hasWording: boolean
  epicCount: number
  failed: boolean
}): boolean {
  if (!input.hasWording) return false
  if (input.epicCount > 0) return false
  if (input.failed) return false
  return true
}

export function isConnectFirstJiraError(message: string | null | undefined): boolean {
  return /connect atlassian/i.test(message || '')
}

export type JiraPublishState = {
  active: boolean
  total: number
  linked: number
  failed: number
  message: string
}
