import type { StakeholderQuestion, WizardState } from './types'
import { roleLabel } from './stakeholders'

function uid(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function generateQuestionsFromRequirements(state: WizardState): StakeholderQuestion[] {
  const text = state.requirementsText.toLowerCase()
  const questions: StakeholderQuestion[] = []

  const add = (question: string, roleId: string, mandatory = true) => {
    questions.push({
      id: uid(),
      question,
      assignedRoleId: roleId,
      mandatory,
      sent: false,
      deliveryStatus: 'pending',
      sentAt: null,
      deliveryMessage: '',
    })
  }

  add('Which authentication mechanism should be used (OAuth2, SAML, JWT, or other)?', 'sc', true)
  add('What is the expected maximum concurrent user count?', 'sa', true)
  add('Are there regulatory or data-retention requirements (GDPR, HIPAA, etc.)?', 'sc', true)
  add('Is multi-factor authentication required for all users?', 'sc', false)

  if (text.includes('payment') || text.includes('billing')) {
    add('Which payment gateway or billing provider should be integrated?', 'po', true)
  }

  if (text.includes('api') || text.includes('integration')) {
    add('Should external APIs be exposed as REST, GraphQL, or gRPC?', 'tl', true)
  }

  if (state.projectType === 'existing') {
    add('Are there legacy modules that must remain unchanged during migration?', 'tl', true)
  }

  add('What are the primary acceptance criteria for the first release?', 'po', true)
  add('Which environments are required (dev, staging, production)?', 'devops', false)

  return questions
}

export function assigneeForQuestion(state: WizardState, roleId: string): { name: string; email: string } {
  const assignment = state.stakeholderAssignments.find((a) => a.roleId === roleId)
  if (assignment?.personName && assignment.personEmail) {
    return { name: assignment.personName, email: assignment.personEmail }
  }
  return { name: roleLabel(roleId), email: `${roleId}@example.com` }
}

export function mockResponsesForQuestions(questions: StakeholderQuestion[]): Record<string, string> {
  const responses: Record<string, string> = {}
  for (const q of questions) {
    if (q.question.includes('authentication')) {
      responses[q.id] = 'OAuth2/OIDC with JWT tokens; Spring Security recommended.'
    } else if (q.question.includes('concurrent')) {
      responses[q.id] = 'Up to 5,000 concurrent users at peak.'
    } else if (q.question.includes('regulatory')) {
      responses[q.id] = 'GDPR compliance required; data retained for 7 years.'
    } else if (q.question.includes('multi-factor')) {
      responses[q.id] = 'Yes, MFA required for admin and privileged roles.'
    } else if (q.question.includes('REST')) {
      responses[q.id] = 'REST with OpenAPI documentation.'
    } else if (q.question.includes('acceptance')) {
      responses[q.id] = 'User registration, core CRUD flows, and API documentation.'
    } else if (q.question.includes('environments')) {
      responses[q.id] = 'Dev, staging, and production with CI/CD pipeline.'
    } else {
      responses[q.id] = 'Confirmed — proceed with the recommended approach.'
    }
  }
  return responses
}
