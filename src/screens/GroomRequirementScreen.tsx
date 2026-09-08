import { useState } from 'react'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import type { GroomQuestion, WizardState } from '../wizard/types'
import {
  GROOM_BANDS,
  isAnswered,
  questionPriority,
  questionsInBand,
  unansweredRequired,
  type GroomPriority,
} from '../wizard/grooming'

interface Props {
  state: WizardState
  loading: boolean
  onAsk: () => void
  onPick: (questionId: string, optionId: string, optionLabel: string) => void
  onOther: (questionId: string, text: string) => void
  onToggleOther: (questionId: string, checked: boolean) => void
  onUseWording: () => void
  onStartOver: () => void
}

function QuestionCard({
  question,
  state,
  onPick,
  onOther,
  onToggleOther,
}: {
  question: GroomQuestion
  state: WizardState
  onPick: Props['onPick']
  onOther: Props['onOther']
  onToggleOther: Props['onToggleOther']
}) {
  const [showOtherText, setShowOtherText] = useState(false)
  const options = (Array.isArray(question.options) ? question.options : []).filter(
    (option) => option.id !== 'other' && option.label.trim().toLowerCase() !== 'other',
  )
  if (!question.id || !question.text || options.length < 2) return null
  const selectedIds = new Set(
    state.groomAnswers.filter((item) => item.questionId === question.id).map((item) => item.optionId),
  )
  const otherAnswer = state.groomAnswers.find((item) => item.questionId === question.id && item.optionId === 'other')
  const optionsDisabled = showOtherText

  function toggleOther(checked: boolean) {
    setShowOtherText(checked)
    onToggleOther(question.id, checked)
  }

  return (
    <fieldset className="groom-question">
      <legend>{question.text}</legend>
      <div className="groom-options">
        {options.map((option) => {
          const checked = selectedIds.has(option.id)
          return (
            <label
              key={option.id}
              className={`groom-option ${checked ? 'selected' : ''} ${optionsDisabled ? 'disabled' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={optionsDisabled}
                onChange={() => onPick(question.id, option.id, option.label)}
              />
              {option.label}
            </label>
          )
        })}
        <label className={`groom-option ${showOtherText ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={showOtherText}
            onChange={(e) => toggleOther(e.target.checked)}
          />
          Other
        </label>
        {showOtherText ? (
          <textarea
            className="full-input groom-other-input"
            rows={3}
            placeholder="Type your answer"
            value={otherAnswer?.otherText ?? ''}
            onChange={(e) => onOther(question.id, e.target.value)}
          />
        ) : null}
      </div>
    </fieldset>
  )
}

function Band({
  band,
  questions,
  state,
  defaultOpen,
  onPick,
  onOther,
  onToggleOther,
}: {
  band: (typeof GROOM_BANDS)[number]
  questions: GroomQuestion[]
  state: WizardState
  defaultOpen: boolean
  onPick: Props['onPick']
  onOther: Props['onOther']
  onToggleOther: Props['onToggleOther']
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (!questions.length) return null
  const answered = questions.filter((question) => isAnswered(question, state.groomAnswers)).length
  return (
    <section className={`groom-band ${band.required ? 'required' : 'optional'} ${open ? 'open' : ''}`}>
      <button type="button" className="groom-band-header" onClick={() => setOpen((value) => !value)}>
        <span className="groom-band-title">
          {band.title}
          {band.required ? <span className="groom-required-tag">Required</span> : <span className="optional-tag">Optional</span>}
        </span>
        <span className="groom-band-meta">
          {answered}/{questions.length} answered
          <ChevronDown size={16} className={open ? 'chevron open' : 'chevron'} />
        </span>
      </button>
      {open && (
        <>
          <p className="groom-band-hint">{band.hint}</p>
          {questions.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              state={state}
              onPick={onPick}
              onOther={onOther}
              onToggleOther={onToggleOther}
            />
          ))}
        </>
      )}
    </section>
  )
}

export function GroomingPanel({ state, loading, onAsk, onPick, onOther, onToggleOther, onUseWording, onStartOver }: Props) {
  const questions = state.groomQuestions
  const missingRequired = unansweredRequired(state)
  const asked = questions.length > 0 || state.groomStatus === 'draft_ready' || state.groomStatus === 'error'
  const showDraft = Boolean(state.groomDraft && (state.groomStatus === 'draft_ready' || state.groomConfirmed))
  const required = questionsInBand(questions, 'need_clarification')
  const optional = questions.filter((question) => questionPriority(question) !== 'need_clarification')
  const requiredAnswered = required.filter((question) => isAnswered(question, state.groomAnswers)).length
  const optionalAnswered = optional.filter((question) => isAnswered(question, state.groomAnswers)).length
  const canSave = missingRequired.length === 0 || state.groomStatus === 'error'

  return (
    <div className="groom-panel">
      <div className="groom-panel-intro">
        <h3>Make it clearer</h3>
        <p>
          One round of choices on this page. Answer Need clarification. Important and Suggestions are optional.
        </p>
      </div>

      {!asked && (
        <div className="card-footer-actions">
          <button type="button" className="primary-btn" disabled={loading} onClick={onAsk}>
            {loading ? 'Reading your wording…' : 'Make it clearer'}
            <Sparkles size={16} />
          </button>
        </div>
      )}

      {state.groomMessage && asked && <p className="muted">{state.groomMessage}</p>}

      {asked && questions.length > 0 && (
        <p className="groom-progress">
          {requiredAnswered}/{required.length} required
          {optional.length > 0 ? ` · ${optionalAnswered}/${optional.length} optional` : ''}
        </p>
      )}

      {GROOM_BANDS.map((band) => (
        <Band
          key={band.id}
          band={band}
          questions={questionsInBand(questions, band.id as GroomPriority)}
          state={state}
          defaultOpen={band.required}
          onPick={onPick}
          onOther={onOther}
          onToggleOther={onToggleOther}
        />
      ))}

      {showDraft && (
        <div className="groom-compare">
          {state.groomOriginal && state.groomOriginal !== state.groomDraft && (
            <div>
              <h4>Before</h4>
              <pre className="groom-draft">{state.groomOriginal}</pre>
            </div>
          )}
          <div>
            <h4>Clearer wording</h4>
            <pre className="groom-draft">{state.groomDraft}</pre>
          </div>
        </div>
      )}

      {asked && (
        <div className="groom-panel-actions">
          <button type="button" className="ghost-btn" disabled={loading} onClick={onStartOver}>
            Start over
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={loading || state.groomConfirmed || !canSave}
            onClick={onUseWording}
          >
            {loading ? 'Updating wording…' : state.groomConfirmed ? 'Wording saved' : 'Use this wording'}
            {state.groomConfirmed ? <Check size={16} /> : <Sparkles size={16} />}
          </button>
        </div>
      )}
      {asked && !state.groomConfirmed && missingRequired.length > 0 && (
        <p className="field-hint">
          Answer {missingRequired.length} required question{missingRequired.length === 1 ? '' : 's'} under Need
          clarification.
        </p>
      )}
    </div>
  )
}
