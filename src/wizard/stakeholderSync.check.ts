import {
  mandatoryStakeholderQuestionsResolved,
  responsesForStakeholderQuestions,
  stakeholderFeedbackFromState,
} from './stakeholderSync'
import type { StakeholderQuestion, WizardState } from './types'

const questions: StakeholderQuestion[] = [
  {
    id: 'q1',
    question: 'Auth method?',
    assignedRoleId: 'product_owner',
    mandatory: true,
    sent: false,
    deliveryStatus: 'pending',
    sentAt: null,
    deliveryMessage: '',
    priority: 'need_clarification',
    proposedAnswer: 'OAuth2',
    queueJira: true,
  },
]

const base: Pick<WizardState, 'questions' | 'responses'> = {
  questions,
  responses: responsesForStakeholderQuestions(questions),
}

if (base.responses[0]?.status !== 'answered' || base.responses[0]?.response !== 'OAuth2') {
  throw new Error('MCQ proposedAnswer should mark response answered')
}

const state = base as WizardState
if (!mandatoryStakeholderQuestionsResolved(state)) {
  throw new Error('mandatory should resolve when MCQ pre-filled')
}

const feedback = stakeholderFeedbackFromState(state)
if (!feedback.includes('OAuth2')) {
  throw new Error('stakeholder feedback should include MCQ answer')
}

console.log('stakeholderSync.check.ts ok')
