import type { GroomAnswer, GroomQuestion, StakeholderQuestion, WizardState } from './types'
import { isAnswered, questionPriority } from './grooming'
import { roleLabel } from './stakeholders'

function uid(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** @deprecated Prefer carryClarifyQuestionsForward — canned list removed by plan. */
export function generateQuestionsFromRequirements(_state: WizardState): StakeholderQuestion[] {
  return []
}

export function assigneeForQuestion(
  state: WizardState,
  roleId: string,
): { name: string; email: string; assigned: boolean } {
  const assignment = state.stakeholderAssignments.find((a) => a.roleId === roleId)
  if (assignment?.personName?.trim() && assignment?.personEmail?.trim()) {
    return {
      name: assignment.personName.trim(),
      email: assignment.personEmail.trim(),
      assigned: true,
    }
  }
  return { name: `Unassigned ${roleLabel(roleId)}`, email: '', assigned: false }
}

function proposedAnswerText(question: GroomQuestion, answers: GroomAnswer[]): string {
  const rows = answers.filter((item) => item.questionId === question.id)
  if (!rows.length) return ''
  const parts = rows.map((row) => {
    if (row.optionId === 'other') return (row.otherText || '').trim()
    return (row.optionLabel || row.optionId || '').trim()
  })
  return parts.filter(Boolean).join('; ')
}

/**
 * Leftover clarify items become the Stakeholder Questions queue:
 * - unanswered optional (important/suggestion) questions
 * - any question flagged queueEmail / queueJira (even if answered as proxy)
 */
export function carryClarifyQuestionsForward(state: WizardState): StakeholderQuestion[] {
  const out: StakeholderQuestion[] = []
  for (const q of state.groomQuestions) {
    const answered = isAnswered(q, state.groomAnswers)
    const priority = questionPriority(q)
    const mandatory = priority === 'need_clarification'
    const queued = Boolean(q.queueEmail || q.queueJira)
    // Required answered with no outbound queue → done on Requirements
    if (mandatory && answered && !queued) continue
    // Required unanswered should be blocked by wording gate; skip if present
    if (mandatory && !answered) continue
    // Optional unanswered, or anything explicitly queued
    if (!answered || queued) {
      out.push({
        id: q.id || uid(),
        question: q.text,
        assignedRoleId: q.ownerRole || 'product_owner',
        mandatory,
        sent: false,
        deliveryStatus: 'pending',
        sentAt: null,
        deliveryMessage: '',
        priority,
        proposedAnswer: proposedAnswerText(q, state.groomAnswers) || undefined,
        queueEmail: Boolean(q.queueEmail) || !answered,
        queueJira: Boolean(q.queueJira) || !answered,
        jiraIssueKey: null,
        jiraIssueUrl: null,
        jiraCommentId: null,
        jiraCommentStatus: 'pending',
      })
    }
  }
  return out
}

export function mockResponsesForQuestions(questions: StakeholderQuestion[]): Record<string, string> {
  const responses: Record<string, string> = {}
  for (const q of questions) {
    responses[q.id] = q.proposedAnswer?.trim() || 'Confirmed — proceed with the recommended approach.'
  }
  return responses
}
