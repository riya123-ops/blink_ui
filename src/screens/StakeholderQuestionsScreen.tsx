import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Mail, MessageSquare, RefreshCw } from 'lucide-react'
import { assigneeForQuestion } from '../wizard/questions'
import { roleLabel } from '../wizard/stakeholders'
import {
  buildJiraClarifyComment,
  matchQuestionToJiraIssue,
  matchableJiraIssues,
  type MatchableIssue,
} from '../wizard/jiraMatch'
import { isJiraReady } from '../wizard/jiraTickets'
import type { StakeholderQuestion, WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  onSendOne: (questionId: string) => Promise<void>
  onSendAll: () => Promise<void>
  onPostJira: (questionId: string) => Promise<void>
  onPostAllJira: () => Promise<void>
  onRefreshJira: () => Promise<void>
  sending?: boolean
  posting?: boolean
  refreshing?: boolean
}

function ensureMatches(state: WizardState): StakeholderQuestion[] {
  const issues = matchableJiraIssues(state)
  return state.questions.map((q) => {
    if (q.jiraIssueKey) return q
    const match = matchQuestionToJiraIssue(q.question, issues)
    if (!match) return q
    return {
      ...q,
      jiraIssueKey: match.key,
      jiraIssueUrl: match.url || null,
    }
  })
}

export function StakeholderQuestionsScreen({
  state,
  onUpdate,
  onSendOne,
  onSendAll,
  onPostJira,
  onPostAllJira,
  onRefreshJira,
  sending,
  posting,
  refreshing,
}: Props) {
  const issues = useMemo(() => matchableJiraIssues(state), [state])
  const jiraReady = isJiraReady(state) && issues.length > 0
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated || !state.questions.length) return
    const next = ensureMatches(state)
    const changed = next.some((q, i) => q.jiraIssueKey !== state.questions[i]?.jiraIssueKey)
    if (changed) onUpdate({ questions: next })
    setHydrated(true)
  }, [hydrated, state, onUpdate])

  useEffect(() => {
    if (!jiraReady || !state.questions.some((q) => q.jiraCommentStatus === 'posted')) return
    void onRefreshJira()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll once on mount when tickets exist
  }, [])

  const emailable = state.questions.filter((q) => !q.sent && assigneeForQuestion(state, q.assignedRoleId).assigned)
  const jiraPostable = state.questions.filter(
    (q) =>
      q.jiraCommentStatus !== 'posted' &&
      q.jiraCommentStatus !== 'replied' &&
      Boolean(q.jiraIssueKey) &&
      assigneeForQuestion(state, q.assignedRoleId).assigned,
  )

  function setIssue(questionId: string, issue: MatchableIssue | null) {
    onUpdate({
      questions: state.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              jiraIssueKey: issue?.key || null,
              jiraIssueUrl: issue?.url || null,
            }
          : q,
      ),
    })
  }

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Questions for Stakeholders</h2>
        <p>
          Leftover clarify items from Requirements. Email one message per person, and/or post a Jira
          comment on a matched ticket after epics/stories exist.
        </p>
      </div>

      <section className="card ref-card">
        {state.questions.length === 0 ? (
          <p className="empty-state">
            No leftover clarifications. Continue to Responses, or go back if you need to queue more.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table ref-table stakeholder-clarify-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Question</th>
                  <th>Person / role</th>
                  <th>Proposed</th>
                  <th>Jira ticket</th>
                  <th className="col-action">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.questions.map((q, idx) => {
                  const assignee = assigneeForQuestion(state, q.assignedRoleId)
                  const canEmail = assignee.assigned && !q.sent
                  const canJira =
                    assignee.assigned &&
                    jiraReady &&
                    Boolean(q.jiraIssueKey) &&
                    q.jiraCommentStatus !== 'posted' &&
                    q.jiraCommentStatus !== 'replied'
                  return (
                    <tr key={q.id}>
                      <td className="col-num">{idx + 1}</td>
                      <td className="question-cell">
                        <div>{q.question}</div>
                        {q.priority ? (
                          <span className="requester-badge muted-badge">{q.priority.replace('_', ' ')}</span>
                        ) : null}
                      </td>
                      <td>
                        <strong>{assignee.name}</strong>
                        <div className="sub">{roleLabel(q.assignedRoleId)}</div>
                        <div className="sub">{assignee.email || 'No email — assign on Project & Stakeholders'}</div>
                      </td>
                      <td className="question-cell">
                        {q.proposedAnswer?.trim() ? q.proposedAnswer : <span className="muted">—</span>}
                      </td>
                      <td>
                        {issues.length === 0 ? (
                          <span className="muted">Create Jira tickets first</span>
                        ) : (
                          <select
                            className="jira-match-select"
                            value={q.jiraIssueKey || ''}
                            onChange={(event) => {
                              const key = event.target.value
                              const issue = issues.find((item) => item.key === key) || null
                              setIssue(q.id, issue)
                            }}
                          >
                            <option value="">Select ticket…</option>
                            {issues.map((issue) => (
                              <option key={issue.key} value={issue.key}>
                                {issue.key} · {issue.title} ({issue.type})
                              </option>
                            ))}
                          </select>
                        )}
                        {q.jiraCommentStatus && q.jiraCommentStatus !== 'pending' ? (
                          <div className="sub">Jira: {q.jiraCommentStatus}</div>
                        ) : null}
                      </td>
                      <td className="col-action stake-actions">
                        <button
                          type="button"
                          className="outlook-btn ref"
                          disabled={sending || !canEmail}
                          title={!assignee.assigned ? 'Assign a person with email first' : undefined}
                          onClick={() => void onSendOne(q.id)}
                        >
                          <Mail size={14} />
                          {q.sent ? 'Emailed ✓' : 'Send email'}
                        </button>
                        <button
                          type="button"
                          className="outlook-btn ref"
                          disabled={posting || !canJira}
                          title={
                            !jiraReady
                              ? 'Create Jira epics/stories first'
                              : !assignee.assigned
                                ? 'Assign a person first'
                                : !q.jiraIssueKey
                                  ? 'Pick a ticket'
                                  : undefined
                          }
                          onClick={() => void onPostJira(q.id)}
                        >
                          <MessageSquare size={14} />
                          {q.jiraCommentStatus === 'posted' || q.jiraCommentStatus === 'replied'
                            ? 'Posted ✓'
                            : 'Post to Jira'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-footer-actions right stake-footer">
          <button
            type="button"
            className="ghost-btn"
            disabled={refreshing || !jiraReady}
            onClick={() => void onRefreshJira()}
          >
            <RefreshCw size={14} />
            {refreshing ? 'Refreshing…' : 'Refresh Jira replies'}
          </button>
          <button
            type="button"
            className="secondary-btn"
            disabled={posting || jiraPostable.length === 0}
            onClick={() => void onPostAllJira()}
          >
            <MessageSquare size={14} />
            Post all to Jira
          </button>
          <button
            type="button"
            className="primary-btn arrow-btn"
            disabled={sending || emailable.length === 0}
            onClick={() => void onSendAll()}
          >
            Send all emails <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  )
}

export function validateStakeholderQuestions(state: WizardState): string | null {
  if (state.questions.length === 0) return null
  const pending = state.questions.filter((q) => {
    const emailed = q.sent
    const jiraDone = q.jiraCommentStatus === 'posted' || q.jiraCommentStatus === 'replied'
    const answered = state.responses.find((r) => r.questionId === q.id)?.status === 'answered'
    return !(emailed || jiraDone || answered)
  })
  if (pending.length > 0) {
    return `Email, post to Jira, or record an answer for ${pending.length} leftover question(s).`
  }
  return null
}

/** Helper for App when composing Jira comment bodies. */
export function jiraCommentForQuestion(state: WizardState, question: StakeholderQuestion): string {
  const assignee = assigneeForQuestion(state, question.assignedRoleId)
  return buildJiraClarifyComment({
    questionId: question.id,
    question: question.question,
    personName: assignee.name,
    roleLabel: roleLabel(question.assignedRoleId),
    proposedAnswer: question.proposedAnswer,
  })
}
