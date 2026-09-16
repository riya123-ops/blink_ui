import type { LucideIcon } from 'lucide-react'
import {
  CheckSquare,
  ClipboardList,
  Cloud,
  Cpu,
  Eye,
  FileText,
  GitBranch,
  HelpCircle,
  Home,
  Layers,
  Link2,
  MessageSquare,
  Monitor,
  Rocket,
  Users,
} from 'lucide-react'
import type { WizardState, WizardStep } from './types'

export interface StepDefinition {
  id: WizardStep
  label: string
  icon: LucideIcon
  iconColor: string
}

export interface PhaseDefinition {
  id: string
  label: string
  stepIds: WizardStep[]
}

export const WIZARD_STEPS: StepDefinition[] = [
  { id: 'welcome', label: 'Welcome', icon: Home, iconColor: '#0066cc' },
  { id: 'project-stakeholders', label: 'Project & Stakeholders', icon: Users, iconColor: '#4f46e5' },
  { id: 'integrations', label: 'Integrations', icon: Link2, iconColor: '#0ea5e9' },
  { id: 'requirements', label: 'Requirements', icon: FileText, iconColor: '#0369a1' },
  { id: 'stakeholder-questions', label: 'Stakeholder Questions', icon: HelpCircle, iconColor: '#d97706' },
  { id: 'stakeholder-responses', label: 'Stakeholder Responses', icon: MessageSquare, iconColor: '#0f9d4a' },
  { id: 'sdlc-planning', label: 'SDLC Planning', icon: ClipboardList, iconColor: '#0d9488' },
  { id: 'project-shape', label: 'Project Shape', icon: Layers, iconColor: '#7c3aed' },
  { id: 'repositories', label: 'Repositories', icon: GitBranch, iconColor: '#ea580c' },
  { id: 'technology-per-repo', label: 'Technology (Per Repository)', icon: Cpu, iconColor: '#c026d3' },
  { id: 'ide-and-tools', label: 'IDE and Tools', icon: Monitor, iconColor: '#6366f1' },
  { id: 'platform-delivery', label: 'Platform & Delivery', icon: Cloud, iconColor: '#0284c7' },
  { id: 'review-resolve', label: 'Review & Resolve', icon: CheckSquare, iconColor: '#16a34a' },
  { id: 'project-preview', label: 'Generated Project Preview', icon: Eye, iconColor: '#7e22ce' },
  { id: 'generation', label: 'Ship', icon: Rocket, iconColor: '#087a38' },
]

export const WIZARD_PHASES: PhaseDefinition[] = [
  {
    id: 'setup',
    label: 'Project setup',
    stepIds: ['welcome', 'project-stakeholders', 'integrations'],
  },
  {
    id: 'clarify',
    label: 'Clarify & align',
    stepIds: ['requirements', 'stakeholder-questions', 'stakeholder-responses', 'sdlc-planning'],
  },
  {
    id: 'shape',
    label: 'Shape delivery',
    stepIds: ['project-shape', 'repositories', 'technology-per-repo', 'ide-and-tools', 'platform-delivery'],
  },
  {
    id: 'ship',
    label: 'Ship',
    stepIds: ['review-resolve', 'project-preview', 'generation'],
  },
]

export const STEP_ORDER = WIZARD_STEPS.map((s) => s.id)

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex((s) => s.id === step)
}

export function phaseForStep(step: WizardStep): PhaseDefinition {
  return WIZARD_PHASES.find((phase) => phase.stepIds.includes(step)) || WIZARD_PHASES[0]
}

/** Single progress line: "Project setup · 2 of 3" — replaces global STEP X OF 14. */
export function phaseProgressLabel(step: WizardStep): string {
  const phase = phaseForStep(step)
  const indexInPhase = phase.stepIds.indexOf(step) + 1
  return `${phase.label} · ${indexInPhase} of ${phase.stepIds.length}`
}

export function canNavigateToStep(
  target: WizardStep,
  current: WizardStep,
  completedThrough: number,
  groomingUnlocked = true,
  unrestricted = false,
): boolean {
  if (unrestricted) return stepIndex(target) >= 0
  if (current === 'welcome') return target === 'welcome'
  const targetIdx = stepIndex(target)
  const currentIdx = stepIndex(current)
  if (targetIdx < 0) return false
  const reqIdx = stepIndex('requirements')
  if (targetIdx > reqIdx && !groomingUnlocked) return false
  return targetIdx <= Math.max(completedThrough, currentIdx)
}

export type StepAttention = 'idle' | 'active' | 'done' | 'attention' | 'skipped'

/** High-level step chrome: done / needs attention / active. */
export function stepAttention(
  stepId: WizardStep,
  current: WizardStep,
  completedThrough: number,
  generationComplete: boolean,
  state: Pick<WizardState, 'questions' | 'responses' | 'groomConfirmed'>,
): StepAttention {
  const idx = stepIndex(stepId)
  const generationIdx = stepIndex('generation')
  const skipped = generationComplete && idx > completedThrough && idx < generationIdx
  if (skipped) return 'skipped'
  if (stepId === current) return 'active'
  if (idx <= completedThrough || (generationComplete && stepId === 'generation')) {
    if (stepId === 'stakeholder-questions') {
      const pending = state.questions.filter((q) => {
        const emailed = q.sent
        const jiraDone =
          (q.jiraCommentStatus === 'posted' || q.jiraCommentStatus === 'replied') && Boolean(q.jiraCommentId)
        const answered = state.responses.find((r) => r.questionId === q.id)?.status === 'answered'
        return !(emailed || jiraDone || answered)
      })
      if (pending.length > 0) return 'attention'
    }
    if (stepId === 'stakeholder-responses') {
      const pending = state.questions
        .filter((q) => q.mandatory)
        .filter((q) => {
          const response = state.responses.find((r) => r.questionId === q.id)
          const text = response?.response?.trim() || q.jiraReplyBody?.trim()
          return !(response?.status === 'answered' && text)
        })
      if (pending.length > 0) return 'attention'
    }
    return 'done'
  }
  return 'idle'
}

export function primaryContinueLabel(
  step: WizardStep,
  state: Pick<WizardState, 'questions' | 'groomConfirmed' | 'repositories' | 'responses'>,
  busy: { saving?: boolean; creatingRepos?: boolean },
): string {
  if (busy.creatingRepos) return 'Creating on GitHub…'
  if (busy.saving) return 'Saving…'
  switch (step) {
    case 'project-stakeholders':
      return 'Continue'
    case 'integrations':
      return 'Continue'
    case 'requirements':
      return state.groomConfirmed ? 'Continue' : 'Save & Continue'
    case 'stakeholder-questions':
      return state.questions.length === 0 ? 'Continue — nothing left' : 'Continue when outbound is done'
    case 'stakeholder-responses': {
      const pending = state.questions
        .filter((q) => q.mandatory)
        .filter((q) => {
          const response = state.responses.find((r) => r.questionId === q.id)
          const text = response?.response?.trim() || q.jiraReplyBody?.trim()
          return !(response?.status === 'answered' && text)
        })
      return pending.length > 0 ? 'Continue when mandatory answered' : 'Continue'
    }
    case 'repositories':
      return state.repositories.some((r) => r.name.trim() && r.createStatus !== 'created' && r.createStatus !== 'exists')
        ? 'Create repos & Continue'
        : 'Continue'
    case 'review-resolve':
      return 'Continue to preview'
    case 'project-shape':
    case 'technology-per-repo':
    case 'ide-and-tools':
    case 'platform-delivery':
      return 'Continue'
    default:
      return 'Save & Continue'
  }
}
