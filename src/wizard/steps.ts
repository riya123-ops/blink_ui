import type { LucideIcon } from 'lucide-react'
import {
  CheckSquare,
  Cloud,
  Cpu,
  Download,
  Eye,
  FileText,
  GitBranch,
  HelpCircle,
  Home,
  Layers,
  Link2,
  MessageSquare,
  Monitor,
  Users,
} from 'lucide-react'
import type { WizardStep } from './types'

export interface StepDefinition {
  id: WizardStep
  label: string
  icon: LucideIcon
  iconColor: string
}

export const WIZARD_STEPS: StepDefinition[] = [
  { id: 'welcome', label: 'Welcome', icon: Home, iconColor: '#0066cc' },
  { id: 'project-stakeholders', label: 'Project & Stakeholders', icon: Users, iconColor: '#4f46e5' },
  { id: 'integrations', label: 'Integrations', icon: Link2, iconColor: '#0ea5e9' },
  { id: 'requirements', label: 'Requirements', icon: FileText, iconColor: '#0369a1' },
  { id: 'stakeholder-questions', label: 'Stakeholder Questions', icon: HelpCircle, iconColor: '#d97706' },
  { id: 'stakeholder-responses', label: 'Stakeholder Responses', icon: MessageSquare, iconColor: '#0f9d4a' },
  { id: 'project-shape', label: 'Project Shape', icon: Layers, iconColor: '#7c3aed' },
  { id: 'repositories', label: 'Repositories', icon: GitBranch, iconColor: '#ea580c' },
  { id: 'technology-per-repo', label: 'Technology (Per Repository)', icon: Cpu, iconColor: '#c026d3' },
  { id: 'ide-and-tools', label: 'IDE and Tools', icon: Monitor, iconColor: '#6366f1' },
  { id: 'platform-delivery', label: 'Platform & Delivery', icon: Cloud, iconColor: '#0284c7' },
  { id: 'review-resolve', label: 'Review & Resolve', icon: CheckSquare, iconColor: '#16a34a' },
  { id: 'project-preview', label: 'Generated Project Preview', icon: Eye, iconColor: '#7e22ce' },
  { id: 'generation', label: 'Generation / Download', icon: Download, iconColor: '#087a38' },
]

export const STEP_ORDER = WIZARD_STEPS.map((s) => s.id)

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex((s) => s.id === step)
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
