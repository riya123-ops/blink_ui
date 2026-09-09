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
  type WorkspaceEntry,
} from './defaults'
import { assignmentsFromRoles, STAKEHOLDER_ROLES } from './stakeholders'

export type WizardStep =
  | 'welcome'
  | 'project-stakeholders'
  | 'integrations'
  | 'requirements'
  | 'stakeholder-questions'
  | 'stakeholder-responses'
  | 'project-shape'
  | 'repositories'
  | 'technology-per-repo'
  | 'ide-and-tools'
  | 'platform-delivery'
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

export interface GroomOption {
  id: string
  label: string
  description?: string
}

export interface GroomQuestion {
  id: string
  text: string
  options: GroomOption[]
  allowOther: boolean
  allowMultiple?: boolean
  priority: 'need_clarification' | 'important' | 'suggestion'
}

export interface GroomAnswer {
  questionId: string
  optionId: string
  optionLabel?: string
  otherText?: string
}

export interface EpicSummary {
  id: string
  title: string
  objective?: string
  storyIds?: string[]
}

export interface StorySummary {
  id: string
  epicId?: string
  title: string
  objective?: string
  asA?: string
  iWant?: string
  soThat?: string
  acceptanceCriteria?: string[]
}

export interface ProductScopeData {
  productId?: string
  proposalDigest?: string
  classification?: any
  epicIds?: string[]
  storyIds?: string[]
  epics?: EpicSummary[]
  stories?: StorySummary[]
  markdown?: string
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
  sodWarnings: string[]
  questions: StakeholderQuestion[]
  responses: QuestionResponse[]
  questionsSent: boolean
  requirementsAnalyzed: boolean
  topology: string
  repositoryModel: string
  architectureStyle: string
  repositories: RepoDefinition[]
  repositoriesTouched: boolean
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
  downloadStructure: WorkspaceEntry[]
  nextSdlcCommand: string | null
  filesGenerated: number
  generationTimeSec: number
  groomStatus: string | null
  groomMessage: string
  groomQuestions: GroomQuestion[]
  groomAnswers: GroomAnswer[]
  groomDraft: string
  groomOriginal: string
  groomConfirmed: boolean
  setupStatus: string | null
  setupValidated: boolean
  setupIdentitySource: string | null
  setupOverlayCount: number
  setupContextReady: boolean
  setupDeliveryReady: boolean
  productScope?: ProductScopeData | null
  scopeDigest?: string | null
}

function defaultStakeholderAssignments(): StakeholderAssignment[] {
  return assignmentsFromRoles(STAKEHOLDER_ROLES)
}

const javaDbTypes = defaultDatabaseTypes()
const javaDbSelected = { ...javaDbTypes, postgresql: true }
const javaLibs = defaultLibrariesForLanguage('java')
const defaultRepos = defaultRepositories('')

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
  sodWarnings: [],
  questions: [],
  responses: [],
  questionsSent: false,
  requirementsAnalyzed: false,
  topology: 'full-stack',
  repositoryModel: 'multi-repo',
  architectureStyle: 'microservices',
  repositories: defaultRepos,
  repositoriesTouched: false,
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
  downloadStructure: [],
  nextSdlcCommand: null,
  filesGenerated: 0,
  generationTimeSec: 0,
  groomStatus: null,
  groomMessage: '',
  groomQuestions: [],
  groomAnswers: [],
  groomDraft: '',
  groomOriginal: '',
  groomConfirmed: false,
  setupStatus: null,
  setupValidated: false,
  setupIdentitySource: null,
  setupOverlayCount: 0,
  setupContextReady: false,
  setupDeliveryReady: false,
  productScope: null,
  scopeDigest: null,
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
    { id: 'overlay', label: 'Canonical AI-SDLC workspace setup created' },
    { id: 'intake', label: 'Canonical requirement intake stored' },
    { id: 'governance', label: 'Governance and setup records generated' },
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
  if (state.repositoriesTouched) return state
  const repos = defaultRepositories(state.projectName)
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
  if (state.groomConfirmed || state.requirementsAnalyzed) score += 15
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

export function clearGroomingPatch(): Partial<WizardState> {
  return {
    groomStatus: null,
    groomMessage: '',
    groomQuestions: [],
    groomAnswers: [],
    groomDraft: '',
    groomOriginal: '',
    groomConfirmed: false,
    requirementsAnalyzed: false,
    questions: [],
    responses: [],
    questionsSent: false,
  }
}

export type { ProjectType, BuildTool, BackendLanguage, BackendFramework, ConfigFormat, WorkspaceEntry }
