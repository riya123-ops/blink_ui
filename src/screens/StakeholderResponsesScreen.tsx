import { useState } from 'react'
import { Bell, Clock, RefreshCw, User } from 'lucide-react'
import { assigneeForQuestion } from '../wizard/questions'
import { roleLabel } from '../wizard/stakeholders'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onSimulateResponses: () => void
  onRefreshJira?: () => void
  refreshing?: boolean
}

type Filter = 'all' | 'responded' | 'pending'

export function StakeholderResponsesScreen({
  state,
  onSimulateResponses,
  onRefreshJira,
  refreshing,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const rows = state.questions.map((q) => {
    const assignee = assigneeForQuestion(state, q.assignedRoleId)
    const response = state.responses.find((r) => r.questionId === q.id)
    return { q, assignee, response }
  })

  const filtered = rows.filter(({ response }) => {
    if (filter === 'all') return true
    if (filter === 'responded') return response?.status === 'answered'
    return response?.status !== 'answered'
  })

  const mandatory = state.questions.filter((q) => q.mandatory)
  const answeredMandatory = mandatory.filter((q) =>
    state.responses.find((r) => r.questionId === q.id)?.status === 'answered',
  )

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Stakeholder Responses</h2>
        <p>Track which questions have been answered — from Jira poll, email, or operator proxy.</p>
      </div>

      <div className="tab-row">
        {(['all', 'responded', 'pending'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`tab-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="progress-block">
          <div className="progress-label">
            <span>Mandatory answered</span>
            <strong>{answeredMandatory.length} / {mandatory.length}</strong>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${mandatory.length ? (answeredMandatory.length / mandatory.length) * 100 : 100}%` }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Stakeholder</th>
                <th>Response</th>
                <th>Received</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">No leftover clarifications to track.</td>
                </tr>
              ) : (
                filtered.map(({ q, assignee, response }) => (
                  <tr key={q.id}>
                    <td>
                      <div className="avatar-row">
                        <span className="avatar"><User size={14} /></span>
                        <div>
                          <strong>{assignee.name}</strong>
                          <span className="sub">{roleLabel(q.assignedRoleId)} · {assignee.email || 'unassigned'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {response?.status === 'answered'
                        ? response.response
                        : q.proposedAnswer
                          ? `Proposed: ${q.proposedAnswer}`
                          : q.question.slice(0, 80) + (q.question.length > 80 ? '…' : '')}
                      {q.jiraIssueKey ? <div className="sub">Jira {q.jiraIssueKey}</div> : null}
                    </td>
                    <td>{response?.receivedAt ? new Date(response.receivedAt).toLocaleString() : '—'}</td>
                    <td>
                      <span className={`status-pill ${response?.status === 'answered' ? 'answered' : 'pending'}`}>
                        {response?.status === 'answered'
                          ? 'Responded'
                          : q.jiraCommentStatus === 'posted'
                            ? 'Awaiting Jira'
                            : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="row-actions">
          <button type="button" className="secondary-btn" onClick={onSimulateResponses}>
            <Clock size={14} /> Simulate Responses (Demo)
          </button>
          <button
            type="button"
            className="secondary-btn"
            disabled={refreshing || !onRefreshJira}
            onClick={() => onRefreshJira?.()}
          >
            <RefreshCw size={14} /> {refreshing ? 'Refreshing…' : 'Refresh Jira replies'}
          </button>
          <button type="button" className="secondary-btn" disabled title="Outlook reminders — future">
            <Bell size={14} /> Send Reminder
          </button>
        </div>
      </section>
    </div>
  )
}

export function validateStakeholderResponses(state: WizardState): string | null {
  if (state.questions.length === 0) return null
  const pending = state.questions
    .filter((q) => q.mandatory)
    .filter((q) => state.responses.find((r) => r.questionId === q.id)?.status !== 'answered')
  if (pending.length > 0) {
    return `${pending.length} mandatory question(s) still pending.`
  }
  return null
}
