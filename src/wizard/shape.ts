import { STEP_ORDER, stepIndex } from './steps.ts'
import type { WizardState, WizardStep } from './types.ts'

/** Saved drafts from before Shape moved ahead of Work plan. */
export const WIZARD_LAYOUT_VERSION = 2

export const WIZARD_STEPS_V1: WizardStep[] = [
  'welcome',
  'project-stakeholders',
  'integrations',
  'requirements',
  'sdlc-scope',
  'stakeholder-qa',
  'sdlc-plan',
  'project-shape',
  'repositories',
  'technology-per-repo',
  'generation',
]

export function shapeFingerprint(
  state: Pick<
    WizardState,
    'topology' | 'repositoryModel' | 'architectureStyle' | 'repositories' | 'repoTechnologies'
  >,
): string {
  const repos = (state.repositories || [])
    .map((repo) => `${repo.id}:${repo.name.trim()}`)
    .join('|')
  const tech = (state.repoTechnologies || [])
    .map(
      (row) =>
        `${row.repoId}:${row.language}:${row.framework}:${row.database}:${row.buildTool}:${row.status}`,
    )
    .join('|')
  return [state.topology, state.repositoryModel, state.architectureStyle, repos, tech].join('::')
}

export function hasWorkPlanArtifacts(
  state: Pick<
    WizardState,
    | 'workClassification'
    | 'specification'
    | 'technicalPlan'
    | 'planAcknowledged'
    | 'shipPlanAcknowledged'
    | 'acceptanceCriteriaAcknowledged'
  >,
): boolean {
  return Boolean(
    state.workClassification?.tier
      || state.specification?.markdown
      || state.specification?.title
      || state.technicalPlan?.markdown
      || state.technicalPlan?.steps?.length
      || state.planAcknowledged
      || state.shipPlanAcknowledged
      || state.acceptanceCriteriaAcknowledged,
  )
}

/** Scope, groom, and start stay. Classify / spec / technical-plan do not. */
export function clearWorkPlanPatch(): Partial<WizardState> {
  return {
    workClassification: null,
    specification: null,
    technicalPlan: null,
    planAcknowledged: false,
    shipPlanAcknowledged: false,
    acceptanceCriteriaAcknowledged: false,
    shapeAcknowledged: false,
    shapeDigest: null,
  }
}

export function withShapeInvalidation(
  prev: WizardState,
  updates: Partial<WizardState>,
): Partial<WizardState> {
  const next = { ...prev, ...updates }
  if (shapeFingerprint(prev) === shapeFingerprint(next)) return updates
  if (!prev.shapeAcknowledged && !hasWorkPlanArtifacts(prev)) return updates
  return { ...updates, ...clearWorkPlanPatch() }
}

export function validateProjectShape(state: WizardState): string | null {
  if (!state.topology) return 'Pick an application topology before continuing.'
  if (!state.repositoryModel) return 'Pick a repository model before continuing.'
  if (!state.architectureStyle) return 'Pick an architecture style before continuing.'
  return null
}

export function validateRepositories(state: WizardState): string | null {
  if (!(state.repositories || []).some((repo) => repo.name.trim())) {
    return 'Keep at least one named repository.'
  }
  return null
}

export function validateShapeReview(state: WizardState): string | null {
  const repos = validateRepositories(state)
  if (repos) return repos
  const rows = state.repoTechnologies || []
  if (!rows.length) return 'Confirm a technology stack for each repository.'
  if (rows.some((row) => row.status === 'tbd')) {
    return 'Resolve TBD stacks before the work plan.'
  }
  if (rows.some((row) => row.status !== 'confirmed')) {
    return 'Confirm each repository stack before the work plan.'
  }
  if (!state.shapeAcknowledged) {
    return 'Review this setup, then confirm it is ready for the work plan.'
  }
  return null
}

export function acknowledgeShapePatch(state: WizardState): Partial<WizardState> {
  return {
    shapeAcknowledged: true,
    shapeDigest: shapeFingerprint(state),
    wizardLayoutVersion: WIZARD_LAYOUT_VERSION,
  }
}

export function shapePlanContext(state: WizardState) {
  return {
    topology: state.topology,
    repositoryModel: state.repositoryModel,
    architectureStyle: state.architectureStyle,
    repositories: state.repositories,
    repoTechnologies: state.repoTechnologies,
  }
}

export function remapWizardProgress(input: {
  step: WizardStep
  completedThrough: number
  state: WizardState
}): { step: WizardStep; completedThrough: number; state: WizardState } {
  const version = input.state.wizardLayoutVersion ?? 0
  if (version >= WIZARD_LAYOUT_VERSION) {
    return input
  }

  const oldCompleted = Math.max(0, Math.min(input.completedThrough, WIZARD_STEPS_V1.length - 1))
  const generationIdx = stepIndex('generation')
  const qaIdx = stepIndex('stakeholder-qa')
  let step = input.step
  let completedThrough = input.completedThrough
  let state: WizardState = { ...input.state, wizardLayoutVersion: WIZARD_LAYOUT_VERSION }

  if (state.generationComplete || step === 'generation') {
    if (oldCompleted >= 9) {
      state = {
        ...state,
        shapeAcknowledged: true,
        shapeDigest: state.shapeDigest || shapeFingerprint(state),
      }
    }
    return {
      step: state.generationComplete ? 'generation' : step,
      completedThrough: Math.max(oldCompleted >= 9 ? generationIdx : qaIdx, completedThrough === 10 ? generationIdx : completedThrough),
      state,
    }
  }

  if (oldCompleted >= 9) {
    state = {
      ...state,
      shapeAcknowledged: true,
      shapeDigest: state.shapeDigest || shapeFingerprint(state),
    }
    completedThrough = stepIndex('sdlc-plan')
    if (step === 'sdlc-plan' || STEP_ORDER.includes(step)) {
      return { step, completedThrough, state }
    }
    return { step: 'sdlc-plan', completedThrough, state }
  }

  if (oldCompleted >= 8) {
    completedThrough = stepIndex('repositories')
    if (step === 'sdlc-plan') step = 'technology-per-repo'
    return { step, completedThrough, state }
  }

  if (oldCompleted >= 7) {
    completedThrough = stepIndex('project-shape')
    if (step === 'sdlc-plan') step = 'repositories'
    return { step, completedThrough, state }
  }

  if (oldCompleted >= 6 || step === 'sdlc-plan') {
    completedThrough = qaIdx
    if (step === 'sdlc-plan') step = 'project-shape'
    return { step, completedThrough, state }
  }

  return { step, completedThrough: oldCompleted, state }
}
