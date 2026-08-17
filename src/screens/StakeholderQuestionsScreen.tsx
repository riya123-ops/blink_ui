import { ChevronRight, Mail } from 'lucide-react'
import { roleLabel } from '../wizard/stakeholders'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onSendOne: (questionId: string) => Promise<void>
  onSendAll: () => Promise<void>
  sending?: boolean
}

export function StakeholderQuestionsScreen({ state, onSendOne, onSendAll, sending }: Props) {
  const unsentCount = state.questions.filter((q) => !q.sent).length

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Questions for Stakeholders</h2>
        <p>Blink AI has identified questions that need clarifications.</p>
      </div>

      <section className="card ref-card">
        {state.questions.length === 0 ? (
          <p className="empty-state">No questions yet. Analyze requirements on the previous screen.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table ref-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Question</th>
                  <th className="col-requester">Requester</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {state.questions.map((q, idx) => (
                  <tr key={q.id}>
                    <td className="col-num">{idx + 1}</td>
                    <td className="question-cell">{q.question}</td>
                    <td className="col-requester">
                      <span className="requester-badge">{roleLabel(q.assignedRoleId)}</span>
                    </td>
                    <td className="col-action">
                      <button
                        type="button"
                        className="outlook-btn ref"
                        disabled={sending || q.sent}
                        onClick={() => void onSendOne(q.id)}
                      >
                        <Mail size={14} />
                        {q.sent ? 'Sent ✓' : 'Send via Outlook'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-footer-actions right">
          <button
            type="button"
            className="primary-btn arrow-btn"
            disabled={sending || unsentCount === 0}
            onClick={() => void onSendAll()}
          >
            Send All via Outlook <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  )
}

export function validateStakeholderQuestions(state: WizardState): string | null {
  if (state.questions.length === 0) return 'No questions available.'
  if (!state.questions.every((q) => q.sent)) return 'Send all questions via Outlook before continuing.'
  return null
}
