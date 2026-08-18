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
  number: number
}

export const WIZARD_STEPS: StepDefinition[] = [
  { id: 'welcome', label: 'Welcome', icon: Home, number: 1 },
  { id: 'project-stakeholders', label: 'Project & Stakeholders', icon: Users, number: 2 },
  { id: 'requirements', label: 'Requirements', icon: FileText, number: 3 },
  { id: 'stakeholder-questions', label: 'Stakeholder Questions', icon: HelpCircle, number: 4 },
  { id: 'stakeholder-responses', label: 'Stakeholder Responses', icon: MessageSquare, number: 5 },
  { id: 'project-shape', label: 'Project Shape', icon: Layers, number: 6 },
  { id: 'repositories', label: 'Repositories', icon: GitBranch, number: 7 },
  { id: 'technology-per-repo', label: 'Technology (Per Repository)', icon: Cpu, number: 8 },
  { id: 'ide-and-tools', label: 'IDE and Tools', icon: Monitor, number: 9 },
  { id: 'platform-delivery', label: 'Platform & Delivery', icon: Cloud, number: 10 },
  { id: 'integrations', label: 'Integrations', icon: Link2, number: 11 },
  { id: 'review-resolve', label: 'Review & Resolve', icon: CheckSquare, number: 12 },
  { id: 'project-preview', label: 'Generated Project Preview', icon: Eye, number: 13 },
  { id: 'generation', label: 'Generation / Download', icon: Download, number: 14 },
]

export const STEP_ORDER = WIZARD_STEPS.map((s) => s.id)

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex((s) => s.id === step)
}

export function canNavigateToStep(target: WizardStep, current: WizardStep, _completedThrough: number): boolean {
  if (current === 'welcome') return target === 'welcome'
  return stepIndex(target) >= 0
}
