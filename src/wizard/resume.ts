import { DEFAULT_INTEGRATIONS } from './defaults.ts'
import { STEP_ORDER, WIZARD_STEPS } from './steps.ts'
import { defaultWizardState, type WizardState, type WizardStep } from './types.ts'

interface RemoteProject {
  id?: number
  projectName?: string
  description?: string
  projectType?: string
  stakeholders?: { roleCode: string; name: string; email: string }[]
  wizardStep?: string | null
  wizardCompletedThrough?: number | null
  wizardState?: unknown
  wizardUpdatedAt?: string | null
}

export const WIZARD_DRAFT_KEY = 'blink.wizard.v1'
export const WIZARD_SESSION_STEP_KEY = 'blink.wizard.session.v1'

export interface WizardDraft {
  email: string
  step: WizardStep
  completedThrough: number
  state: WizardState
  updatedAt: number
  freshStart?: boolean
}

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === 'string' && STEP_ORDER.includes(value as WizardStep)
}

export function serializeWizardState(state: WizardState): WizardState {
  return {
    ...state,
    requirementFile: null,
    integrations: (state.integrations || []).map((item) => {
      const { token: _token, ...rest } = item
      return rest
    }),
  }
}

export function restoreWizardState(raw: unknown): WizardState {
  const parsed = raw && typeof raw === 'object' ? (raw as Partial<WizardState>) : {}
  const integrationsById = new Map(
    (Array.isArray(parsed.integrations) ? parsed.integrations : []).map((item) => [item.id, item]),
  )
  return {
    ...defaultWizardState,
    ...parsed,
    requirementFile: null,
    projectId: parsed.projectId ? String(parsed.projectId) : null,
    integrations: DEFAULT_INTEGRATIONS.map((item) => {
      const saved = integrationsById.get(item.id)
      if (!saved) return { ...item }
      const { token: _token, ...rest } = saved
      return { ...item, ...rest, token: undefined }
    }),
  }
}

export function hasWizardProgress(
  draft: Pick<WizardDraft, 'step' | 'state'> & { completedThrough?: number } | null | undefined,
): boolean {
  if (!draft) return false
  if ((draft.completedThrough ?? 0) > 0) return true
  if (draft.step !== 'welcome') return true
  const state = draft.state
  return Boolean(
    state.projectId
      || state.projectName?.trim()
      || state.description?.trim()
      || state.requirementsText?.trim()
      || state.questions.length
      || state.groomQuestions.length,
  )
}

export function loadWizardDraft(email: string): WizardDraft | null {
  if (!email || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(WIZARD_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WizardDraft>
    if (!parsed?.email || parsed.email.toLowerCase() !== email.trim().toLowerCase()) return null
    const step = isWizardStep(parsed.step) ? parsed.step : 'welcome'
    return {
      email: parsed.email,
      step,
      completedThrough: typeof parsed.completedThrough === 'number' ? parsed.completedThrough : 0,
      state: restoreWizardState(parsed.state),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      freshStart: Boolean(parsed.freshStart),
    }
  } catch {
    return null
  }
}

export function saveWizardDraft(email: string, draft: Omit<WizardDraft, 'email'>): void {
  if (!email || typeof localStorage === 'undefined') return
  const payload: WizardDraft = {
    email: email.trim().toLowerCase(),
    step: draft.step,
    completedThrough: draft.completedThrough,
    state: serializeWizardState(draft.state),
    updatedAt: draft.updatedAt,
    freshStart: Boolean(draft.freshStart),
  }
  localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(payload))
}

export function loadSessionStep(): WizardStep | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const value = sessionStorage.getItem(WIZARD_SESSION_STEP_KEY)
    return isWizardStep(value) ? value : null
  } catch {
    return null
  }
}

export function saveSessionStep(step: WizardStep): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(WIZARD_SESSION_STEP_KEY, step)
}

export function clearSessionStep(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(WIZARD_SESSION_STEP_KEY)
}

export function parkDraftForNextLogin(email: string | null | undefined): void {
  clearSessionStep()
  if (!email) return
  const draft = loadWizardDraft(email)
  if (!draft) return
  saveWizardDraft(email, {
    ...draft,
    step: 'welcome',
    updatedAt: Date.now(),
  })
}

export function clearWizardDraft(email?: string): void {
  if (typeof localStorage === 'undefined') return
  if (!email) {
    localStorage.removeItem(WIZARD_DRAFT_KEY)
    return
  }
  const current = loadWizardDraft(email)
  if (current) localStorage.removeItem(WIZARD_DRAFT_KEY)
}

export function stepLabel(step: WizardStep): string {
  return WIZARD_STEPS.find((item) => item.id === step)?.label || step
}

export function parseRemoteUpdatedAt(value: string | null | undefined): number {
  if (!value) return 0
  const millis = Date.parse(value)
  if (!Number.isNaN(millis)) return millis
  const local = Date.parse(value.replace(' ', 'T'))
  return Number.isNaN(local) ? 0 : local
}

export function draftFromRemote(email: string, remote: RemoteProject): WizardDraft {
  const state = restoreWizardState(remote.wizardState)
  if (remote.id != null) state.projectId = String(remote.id)
  if (remote.projectName) state.projectName = remote.projectName
  if (remote.description) state.description = remote.description
  if (remote.projectType === 'new' || remote.projectType === 'existing') {
    state.projectType = remote.projectType
  }
  const remoteStakeholders = remote.stakeholders
  if ((!state.stakeholderAssignments.some((row) => row.personName.trim() || row.personEmail.trim()))
      && remoteStakeholders?.length) {
    state.stakeholderAssignments = state.stakeholderAssignments.map((row) => {
      const match = remoteStakeholders.find((item) => item.roleCode === row.roleId)
      return match
        ? { ...row, personName: match.name, personEmail: match.email }
        : row
    })
  }
  const step = isWizardStep(remote.wizardStep)
    ? remote.wizardStep
    : state.projectId
      ? 'project-stakeholders'
      : 'welcome'
  return {
    email: email.trim().toLowerCase(),
    step,
    completedThrough: remote.wizardCompletedThrough ?? 0,
    state,
    updatedAt: parseRemoteUpdatedAt(remote.wizardUpdatedAt),
  }
}

export function canOfferResume(draft: Pick<WizardDraft, 'step' | 'state' | 'completedThrough'> & { freshStart?: boolean } | null | undefined): boolean {
  if (!draft) return false
  const named = Boolean(draft.state.projectId || draft.state.projectName?.trim())
  if (draft.freshStart) return named
  return named || draft.completedThrough > 0 || hasWizardProgress(draft)
}

export function resumeTarget(draft: Pick<WizardDraft, 'step' | 'completedThrough' | 'state'>): WizardStep {
  if (draft.step !== 'welcome') return draft.step
  if (draft.completedThrough > 0) {
    return STEP_ORDER[Math.min(draft.completedThrough, STEP_ORDER.length - 1)]
  }
  return hasWizardProgress(draft) ? 'project-stakeholders' : 'welcome'
}

export function initialDraft(email: string | null): WizardDraft {
  if (!email) {
    return {
      email: '',
      step: 'welcome',
      completedThrough: 0,
      state: defaultWizardState,
      updatedAt: 0,
    }
  }
  const local = loadWizardDraft(email)
  if (local?.freshStart || (local && hasWizardProgress(local))) return local
  return {
    email: email.trim().toLowerCase(),
    step: 'welcome',
    completedThrough: 0,
    state: defaultWizardState,
    updatedAt: 0,
  }
}
