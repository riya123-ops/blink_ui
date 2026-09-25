import type { GroomAnswer, GroomQuestion, WizardState } from './types'

export function patchScopePick(
  state: Pick<WizardState, 'scopeQuestions' | 'scopeAnswers'>,
  questionId: string,
  optionId: string,
  optionLabel: string,
): GroomAnswer[] {
  const q = (state.scopeQuestions || []).find((item) => item.id === questionId)
  const isMultiple = Boolean(q?.allowMultiple)
  const isSame = (item: GroomAnswer) => item.questionId === questionId && item.optionId === optionId
  const answers = state.scopeAnswers || []
  const exists = answers.some(isSame)
  if (isMultiple) {
    return exists ? answers.filter((item) => !isSame(item)) : [...answers, { questionId, optionId, optionLabel }]
  }
  const withoutQuestion = answers.filter((item) => item.questionId !== questionId)
  return exists ? withoutQuestion : [...withoutQuestion, { questionId, optionId, optionLabel }]
}

export function patchScopeOther(
  state: Pick<WizardState, 'scopeQuestions' | 'scopeAnswers'>,
  questionId: string,
  text: string,
): GroomAnswer[] {
  const rest = (state.scopeAnswers || []).filter(
    (item) => !(item.questionId === questionId && item.optionId === 'other'),
  )
  return [...rest, { questionId, optionId: 'other', optionLabel: 'Other', otherText: text }]
}

export function patchScopeToggleOther(
  state: Pick<WizardState, 'scopeQuestions' | 'scopeAnswers'>,
  questionId: string,
  checked: boolean,
): GroomAnswer[] {
  const q = (state.scopeQuestions || []).find((item) => item.id === questionId)
  const isMultiple = Boolean(q?.allowMultiple)
  const answers = state.scopeAnswers || []
  if (!checked) {
    return answers.filter((item) => !(item.questionId === questionId && item.optionId === 'other'))
  }
  const existingOther = answers.find((item) => item.questionId === questionId && item.optionId === 'other')
  const otherItem: GroomAnswer = {
    questionId,
    optionId: 'other',
    optionLabel: 'Other',
    otherText: existingOther?.otherText ?? '',
  }
  if (isMultiple) {
    const kept = answers.filter((item) => !(item.questionId === questionId && item.optionId === 'other'))
    return [...kept, otherItem]
  }
  const kept = answers.filter((item) => item.questionId !== questionId)
  return [...kept, otherItem]
}

export function scopeAnswersForQuestion(questionId: string, answers: GroomAnswer[]): GroomAnswer[] {
  return answers.filter((item) => item.questionId === questionId)
}

export function isScopeOptionSelected(question: GroomQuestion, answers: GroomAnswer[], optionId: string): boolean {
  return scopeAnswersForQuestion(question.id, answers).some((item) => item.optionId === optionId)
}
