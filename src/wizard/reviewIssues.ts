import type { WizardState, WizardStep } from './types'

export interface ReviewIssue {
  id: string
  type: 'error' | 'warn' | 'info'
  label: string
  targetStep: WizardStep
  details: string[]
}

export function buildReviewIssues(state: WizardState): ReviewIssue[] {
  const issues: ReviewIssue[] = []

  const missingStakeholders = state.stakeholderAssignments.filter(
    (a) => !a.personName.trim() || !a.personEmail.trim(),
  )
  const unsentQuestions = state.questions.filter((q) => !q.sent)
  const pendingMandatory = state.questions.filter(
    (q) => q.mandatory && state.responses.find((r) => r.questionId === q.id)?.status !== 'answered',
  )
  const disconnectedIntegrations = state.integrations.filter((i) => !i.connected)

  const missingDetails: string[] = []
  if (missingStakeholders.length) {
    missingDetails.push(`${missingStakeholders.length} stakeholder(s) missing name or email`)
  }
  if (unsentQuestions.length) {
    missingDetails.push(`${unsentQuestions.length} stakeholder question(s) not sent`)
  }
  if (pendingMandatory.length) {
    missingDetails.push(`${pendingMandatory.length} mandatory response(s) still pending`)
  }
  if (!state.requirementsAnalyzed) {
    missingDetails.push('Requirements not analyzed yet')
  }
  if (disconnectedIntegrations.length > 3) {
    missingDetails.push(`${disconnectedIntegrations.length} integrations not connected`)
  }

  if (missingDetails.length > 0) {
    issues.push({
      id: 'missing',
      type: 'error',
      label: `${missingDetails.length} Missing decision${missingDetails.length > 1 ? 's' : ''}`,
      targetStep: missingStakeholders.length
        ? 'project-stakeholders'
        : unsentQuestions.length
          ? 'stakeholder-questions'
          : pendingMandatory.length
            ? 'stakeholder-responses'
            : 'requirements',
      details: missingDetails,
    })
  }

  const tbdTech = state.repoTechnologies.filter((t) => t.status === 'tbd')
  const tbdDetails = tbdTech.map((t) => {
    const repo = state.repositories.find((r) => r.id === t.repoId)
    return `${repo?.name ?? t.repoId}: technology stack marked TBD`
  })
  if (tbdDetails.length === 0) {
    tbdDetails.push(
      'Review recommended technology choices on repositories',
      'Confirm Spring Boot and React stack selections',
    )
  }

  issues.push({
    id: 'tbd',
    type: 'warn',
    label: `${tbdDetails.length} TBD item${tbdDetails.length > 1 ? 's' : ''}`,
    targetStep: 'technology-per-repo',
    details: tbdDetails,
  })

  const archDetails: string[] = []
  if (state.architectureStyle === 'microservices' && state.repositories.length < 3) {
    archDetails.push('Microservices selected but fewer than 3 repositories defined')
  }
  if (state.repositoryModel === 'multi-repo' && state.repositories.length < 2) {
    archDetails.push('Multi-repo model requires at least 2 repositories')
  }
  if (!state.cloudProvider) {
    archDetails.push('Cloud provider not configured')
  }
  if (archDetails.length === 0) {
    archDetails.push(`Architecture: ${state.architectureStyle.replace('-', ' ')}`)
    archDetails.push(`Repository model: ${state.repositoryModel.replace('-', ' ')}`)
  }

  issues.push({
    id: 'arch',
    type: 'info',
    label: `${archDetails.length} Architecture warning${archDetails.length > 1 ? 's' : ''}`,
    targetStep: 'project-shape',
    details: archDetails,
  })

  return issues
}
