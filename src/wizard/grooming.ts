import type { GroomAnswer, GroomQuestion, WizardState } from './types'

export type GroomPriority = 'need_clarification' | 'important' | 'suggestion'

export const GROOM_BANDS: {
  id: GroomPriority
  title: string
  hint: string
  required: boolean
}[] = [
  {
    id: 'need_clarification',
    title: 'Need clarification',
    hint: 'Required. These gaps block a first version.',
    required: true,
  },
  {
    id: 'important',
    title: 'Important',
    hint: 'Optional. Answer if you already know.',
    required: false,
  },
  {
    id: 'suggestion',
    title: 'Suggestions',
    hint: 'Optional ideas. Skip anything that does not fit.',
    required: false,
  },
]

export function questionPriority(question: GroomQuestion): GroomPriority {
  const value = question.priority
  if (value === 'important' || value === 'suggestion') return value
  return 'need_clarification'
}

export function questionsInBand(questions: GroomQuestion[], band: GroomPriority): GroomQuestion[] {
  return questions.filter((question) => questionPriority(question) === band)
}

type IncomingQuestion = Omit<GroomQuestion, 'priority'> & { priority?: GroomPriority }

/** Fill missing bands: unbanded questions split 2 required / rest optional. Always keep at least two required when possible. */
export function assignQuestionBands(questions: IncomingQuestion[]): GroomQuestion[] {
  const explicit = questions.some((question) => Boolean(question.priority))
  const mapped: GroomQuestion[] = explicit
    ? questions.map((question) => ({ ...question, priority: questionPriority(question as GroomQuestion) }))
    : questions.map((question, index) => ({
        ...question,
        priority: (index < 2 ? 'need_clarification' : index < 5 ? 'important' : 'suggestion') as GroomPriority,
      }))
  if (mapped.length === 0) return mapped
  return mapped
}

export function requiredGroomQuestions(questions: GroomQuestion[]): GroomQuestion[] {
  return questionsInBand(questions, 'need_clarification')
}

export function isAnswered(question: GroomQuestion, answers: GroomAnswer[]): boolean {
  const answer = answers.find((item) => item.questionId === question.id)
  if (!answer) return false
  if (answer.optionId === 'other') return Boolean(answer.otherText?.trim())
  return Boolean(answer.optionId)
}

export function unansweredRequired(state: Pick<WizardState, 'groomQuestions' | 'groomAnswers'>): GroomQuestion[] {
  return requiredGroomQuestions(state.groomQuestions).filter((question) => !isAnswered(question, state.groomAnswers))
}

export function groomingComplete(state: WizardState): boolean {
  if (!state.requirementsText.trim() && state.requirementFileName) return true
  if (!state.requirementsText.trim()) return false
  return state.groomConfirmed
}
