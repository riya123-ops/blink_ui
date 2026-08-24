import {
  defaultDatabaseDrivers,
  defaultDatabaseTypes,
} from '../databaseTypes'
import {
  defaultFrontendAddons,
  defaultFrontendStack,
} from '../frontendTechnologies'
import { defaultLibrariesForLanguage } from '../languageLibraries'
import type {
  BackendFramework,
  BackendLanguage,
  BuildTool,
  ConfigFormat,
  ProjectType,
  SetupForm,
} from '../types'
import {
  DEFAULT_INTEGRATIONS,
  defaultRepoTechnologies,
  defaultRepositories,
  type IntegrationItem,
  type RepoDefinition,
  type RepoTechnology,
} from './defaults'
import { assignmentsFromRoles, STAKEHOLDER_ROLES } from './stakeholders'

export type WizardStep =
  | 'welcome'
  | 'project-stakeholders'
  | 'requirements'
  | 'stakeholder-questions'
  | 'stakeholder-responses'
  | 'project-shape'
  | 'repositories'
  | 'technology-per-repo'
  | 'ide-and-tools'
  | 'platform-delivery'
  | 'integrations'
  | 'review-resolve'
  | 'project-preview'
  | 'generation'

export interface StakeholderAssignment {
  id: string
  roleId: string
  personName: string
  personEmail: string
}

export interface StakeholderQuestion {
  id: string
  question: string
  assignedRoleId: string
  mandatory: boolean
  sent: boolean
  deliveryStatus: 'pending' | 'sent' | 'failed'
  sentAt: string | null
  deliveryMessage: string
}

export interface QuestionResponse {
  questionId: string
  status: 'pending' | 'answered' | 'failed' | 'cancelled'
  response: string
  receivedAt: string | null
}

export interface GenerationStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
}

export interface WizardState extends SetupForm {
  applicationType: string
  javaVersion: string
  packaging: 'jar' | 'war'
  orm: string
  apiStyle: string
  securityOption: string
  testingFramework: string
  requirementsText: string
  requirementFileName: string | null
  requirementFile: File | null
  projectId: string | null
  stakeholdersCatalogLoaded: boolean
  existingSourceMode: 'none' | 'zip' | 'git' | 'connect'
  gitRepositoryUrl: string
  sourceZipName: string | null
  skipSourceWarning: boolean
  stakeholderAssignments: StakeholderAssignment[]
  questions: StakeholderQuestion[]
  responses: QuestionResponse[]
  questionsSent: boolean
  requirementsAnalyzed: boolean
  topology: string
  repositoryModel: string
  architectureStyle: string
  repositories: RepoDefinition[]
  repoTechnologies: RepoTechnology[]
  ideTool: string
  cloudProvider: string
  environments: Record<string, boolean>
  containerization: string
  iac: string
  cicd: string
  secretsManagement: string
  deploymentModel: string
  blueGreenDeploy: boolean
  canaryDeploy: boolean
  integrations: IntegrationItem[]
  generationSteps: GenerationStep[]
  generationComplete: boolean
  downloadFilename: string | null
  filesGenerated: number
  generationTimeSec: number
}

function defaultStakeholderAssignments(): StakeholderAssignment[] {
  return assignmentsFromRoles(STAKEHOLDER_ROLES)
}

const javaDbTypes = defaultDatabaseTypes()
const javaDbSelected = { ...javaDbTypes, postgresql: true }
const javaLibs = defaultLibrariesForLanguage('java')
const defaultRepos = defaultRepositories('blink-app')

export const defaultWizardState: WizardState = {
  projectType: 'new',
  buildTool: 'gradle-groovy',
  backendLanguage: 'java',
  springBootVersion: '3.4.1',
  frontendStack: { ...defaultFrontendStack(), react: true, typescript: true, vite: true },
  frontendLibraries: defaultFrontendAddons(),
  backendFramework: 'java-spring',
  backendLibraries: javaLibs,
  databaseTypes: javaDbSelected,
  databaseDrivers: defaultDatabaseDrivers('java', javaDbSelected),
  projectName: '',
  artifactName: 'blink-app',
  version: '0.1.0',
  description: '',
  configFormat: 'yaml',
  packageNamespace: '',
  pythonPackageName: '',
  baEmail: '',
  poEmail: '',
  securityEmail: '',
  applicationType: 'web-application',
  javaVersion: '21',
  packaging: 'jar',
  orm: 'spring-data-jpa',
  apiStyle: 'rest',
  securityOption: 'spring-security',
  testingFramework: 'junit-mockito',
  requirementsText: '',
  requirementFileName: null,
  requirementFile: null,
  projectId: null,
  stakeholdersCatalogLoaded: false,
  existingSourceMode: 'none',
  gitRepositoryUrl: '',
  sourceZipName: null,
  skipSourceWarning: false,
  stakeholderAssignments: defaultStakeholderAssignments(),
  questions: [],
  responses: [],
  questionsSent: false,
  requirementsAnalyzed: false,
  topology: 'full-stack',
  repositoryModel: 'multi-repo',
  architectureStyle: 'microservices',
  repositories: defaultRepos,
  repoTechnologies: defaultRepoTechnologies(defaultRepos),
  ideTool: 'cursor',
  cloudProvider: 'aws',
  environments: { dev: true, qa: true, staging: true, prod: true },
  containerization: 'docker',
  iac: 'terraform',
  cicd: 'github-actions',
  secretsManagement: 'aws-secrets-manager',
  deploymentModel: 'kubernetes-eks',
  blueGreenDeploy: true,
  canaryDeploy: false,
  integrations: DEFAULT_INTEGRATIONS.map((i) => ({ ...i })),
  generationSteps: [],
  generationComplete: false,
  downloadFilename: null,
  filesGenerated: 0,
  generationTimeSec: 0,
}

function ideCommandsLabel(ideTool: string): string {
  switch (ideTool) {
    case 'claude-code':
      return 'Claude Code commands installed'
    case 'vscode-claude':
      return 'VS Code + Claude configuration installed'
    case 'vscode-copilot':
      return 'VS Code + Copilot configuration installed'
    default:
      return 'Cursor slash commands installed'
  }
}

export function generationStepDefs(ideTool = 'cursor') {
  return [
    { id: 'overlay', label: 'AI-SDLC workspace overlay created' },
    { id: 'backend', label: 'Spring Boot backend scaffolded' },
    { id: 'frontend', label: 'React + TypeScript + Vite frontend scaffolded' },
    { id: 'framework', label: 'Automation SDLC framework installed' },
    { id: 'commands', label: ideCommandsLabel(ideTool) },
    { id: 'package', label: 'Project packaged for download' },
  ]
}

export const GENERATION_STEP_DEFS = generationStepDefs('cursor')

export function wizardToSetupForm(state: WizardState): SetupForm {
  const ba = state.stakeholderAssignments.find((a) => a.roleId === 'business_analyst' || a.roleId === 'ba')
  const po = state.stakeholderAssignments.find((a) => a.roleId === 'product_owner' || a.roleId === 'po')
  const sc = state.stakeholderAssignments.find((a) => a.roleId === 'security_champion' || a.roleId === 'sc')

  return {
    ...state,
    backendLanguage: 'java' as BackendLanguage,
    backendFramework: 'java-spring' as BackendFramework,
    baEmail: ba?.personEmail ?? state.baEmail,
    poEmail: po?.personEmail ?? state.poEmail,
    securityEmail: sc?.personEmail ?? state.securityEmail,
  }
}

export function syncEmailsFromStakeholders(state: WizardState): WizardState {
  const next = { ...state }
  for (const a of state.stakeholderAssignments) {
    if (a.roleId === 'ba' || a.roleId === 'business_analyst') next.baEmail = a.personEmail
    if (a.roleId === 'po' || a.roleId === 'product_owner') next.poEmail = a.personEmail
    if (a.roleId === 'sc' || a.roleId === 'security_champion') next.securityEmail = a.personEmail
  }
  return next
}

export function syncRepositoriesFromArtifact(state: WizardState): WizardState {
  const slug = state.artifactName || 'blink-app'
  const repos = defaultRepositories(slug)
  return {
    ...state,
    repositories: repos,
    repoTechnologies: defaultRepoTechnologies(repos),
  }
}

export function computeReadiness(state: WizardState): number {
  let score = 0
  if (state.projectName) score += 10
  if (state.stakeholderAssignments.length >= 2) score += 10
  if (state.requirementsAnalyzed) score += 15
  if (state.questionsSent) score += 15
  const mandatoryAnswered = state.questions
    .filter((q) => q.mandatory)
    .every((q) => state.responses.find((r) => r.questionId === q.id)?.status === 'answered')
  if (mandatoryAnswered && state.questions.length > 0) score += 15
  if (state.repositories.length >= 2) score += 10
  if (state.repoTechnologies.every((t) => t.status === 'confirmed')) score += 10
  if (state.ideTool) score += 5
  if (state.cloudProvider && state.cicd) score += 10
  if (state.integrations.some((i) => i.connected)) score += 5
  return Math.min(score, 100)
}

export type { ProjectType, BuildTool, BackendLanguage, BackendFramework, ConfigFormat }
