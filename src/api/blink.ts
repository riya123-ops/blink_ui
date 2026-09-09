import { sanitizeDownloadStructure } from '../wizard/defaults'
import type { ProductScopeData } from '../wizard/types'
import { stripExcludedZipFolders } from './stripZipFolders'

export interface StakeholderRoleDto {
  roleCode: string
  roleName: string
  description?: string
  required: boolean
  displayOrder?: number
  defaultName?: string
  defaultEmail?: string
}

export interface StakeholderPayload {
  roleCode: string
  name: string
  email: string
}

export interface ProjectPayload {
  projectType: 'new' | 'existing'
  projectName: string
  description: string
  stakeholders: StakeholderPayload[]
}

export interface StakeholderDto {
  id: number
  roleCode: string
  roleName: string
  name: string
  email: string
}

export interface ProjectDto {
  id: number
  projectName: string
  projectCode: string
  description?: string
  status: string
  projectType: 'new' | 'existing'
  stakeholders: StakeholderDto[]
  workspaceKey?: string | null
  workspaceUrl?: string | null
  workspaceStatus?: 'preparing' | 'ready' | 'failed' | null
  sodWarnings?: string[]
  nextCommand?: string
}

export interface ConfigureStakeholdersResponse {
  status: string
  message: string
  nextCommand: string
  sodWarnings: string[]
  errors: string[]
  rolesConfigured: number
}

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text) as { message?: string }
    return parsed.message || text || `Request failed (${response.status})`
  } catch {
    return text || `Request failed (${response.status})`
  }
}

/** API base. In `npm run dev`, `.env.development` can point at Render or `/api` (Vite proxy). */
const DEFAULT_API_URL = 'https://blink-backend-af7x.onrender.com/api'

export function apiUrl(path: string): string {
  let base = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '')
  if (/^https?:\/\//.test(base) && !base.endsWith('/api')) {
    base = `${base}/api`
  }
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function isLocalApi(): boolean {
  const base = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '')
  return base.startsWith('/') || /localhost|127\.0\.0\.1/.test(base)
}

function normalizeGroomQuestions(value: unknown): GroomQuestionDto[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const options = Array.isArray(row.options)
      ? row.options.flatMap((opt, optIndex) => {
          if (!opt || typeof opt !== 'object') return []
          const option = opt as Record<string, unknown>
          const label = String(option.label || '').trim()
          const id = String(option.id || '').trim()
          const description = option.description ? String(option.description).trim() : undefined
          if (!label || !id) return []
          return [{ id: id || `opt-${optIndex + 1}`, label, ...(description ? { description } : {}) }]
        })
      : []
    const text = String(row.text || '').trim()
    const id = String(row.id || '').trim()
    if (!id || !text || options.length < 2) return []
    const priorityRaw = String(row.priority || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    const priority =
      priorityRaw === 'important' || priorityRaw === 'suggestion'
        ? priorityRaw
        : row.priority
          ? ('need_clarification' as const)
          : undefined
    return [
      {
        id: id || `q-${index + 1}`,
        text,
        options,
        allowOther: row.allowOther !== false,
        allowMultiple: Boolean(row.allowMultiple),
        ...(priority ? { priority } : {}),
      },
    ]
  })
}

export async function fetchStakeholderRoles(): Promise<StakeholderRoleDto[]> {
  const url = apiUrl('/stakeholder-roles')
  console.info(`[blink] GET ${url}`)
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<StakeholderRoleDto[]>
}

export async function fetchWorkspaceStatus(projectName: string, projectId?: string | null): Promise<{
  workspaceKey?: string | null
  status?: 'preparing' | 'ready' | 'failed' | null
  filesCopied: number
  filesTotal: number
  percent: number
  exists: boolean
}> {
  const params = new URLSearchParams({ projectName })
  if (projectId) params.set('projectId', projectId)
  const url = apiUrl(`/projects/workspace-status?${params.toString()}`)
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{
    workspaceKey?: string | null
    status?: 'preparing' | 'ready' | 'failed' | null
    filesCopied: number
    filesTotal: number
    percent: number
    exists: boolean
  }>
}

export async function fetchProject(id: string): Promise<ProjectDto> {
  const url = apiUrl(`/projects/${id}`)
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<ProjectDto>
}

export async function saveProject(payload: ProjectPayload, projectId?: string | null): Promise<ProjectDto> {
  const url = projectId ? apiUrl(`/projects/${projectId}`) : apiUrl('/projects')
  const method = projectId ? 'PUT' : 'POST'
  console.info(`[blink] ${method} ${url}`, payload)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 90_000)
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(await readError(response))
    return response.json() as Promise<ProjectDto>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Could not save the project. Try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export async function configureStakeholders(
  projectId: string,
  stakeholders?: StakeholderPayload[]
): Promise<ConfigureStakeholdersResponse> {
  const url = apiUrl(`/projects/${projectId}/configure-stakeholders`)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stakeholders || []),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<ConfigureStakeholdersResponse>
}

export interface IntegrationConnectPayload {
  provider: string
  baseUrl?: string
  token?: string
  username?: string
  email?: string
  organization?: string
  workspace?: string
  projectKey?: string
  spaceKey?: string
}

export interface IntegrationConnectResult {
  connected: boolean
  provider: string
  account: string
  detail: string
}

export class ApiRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function connectIntegration(payload: IntegrationConnectPayload): Promise<IntegrationConnectResult> {
  const url = apiUrl('/integrations/connect')
  console.info(`[blink] POST ${url}`, { provider: payload.provider })
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new ApiRequestError(await readError(response), response.status)
  return response.json() as Promise<IntegrationConnectResult>
}

export interface CreateRepositoriesPayload {
  provider: string
  token: string
  username?: string
  organization?: string
  workspace?: string
  repositories: { name: string; description?: string }[]
}

export interface CreatedRepository {
  name: string
  status: 'created' | 'exists' | 'failed' | string
  htmlUrl: string | null
  message: string
}

export interface CreateRepositoriesResult {
  provider: string
  repositories: CreatedRepository[]
}

export async function createRepositories(payload: CreateRepositoriesPayload): Promise<CreateRepositoriesResult> {
  const url = apiUrl('/integrations/repositories')
  console.info(`[blink] POST ${url}`, { provider: payload.provider, count: payload.repositories.length })
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new ApiRequestError(await readError(response), response.status)
  return response.json() as Promise<CreateRepositoriesResult>
}

export interface WorkspaceEntryDto {
  name: string
  kind: 'file' | 'directory'
}

export interface DownloadResult {
  blob: Blob
  filename: string
  structure: WorkspaceEntryDto[]
  fileCount: number
  nextCommand: string
  setupStatus: string
  setupValidated: boolean
  identitySource: string
  overlayCount: number
  contextReady: boolean
  deliveryReady: boolean
  folderStatus: string
}

function parseStructureHeader(header: string | null): WorkspaceEntryDto[] {
  if (!header) return []
  return header.split(',').flatMap((part) => {
    const trimmed = part.trim()
    const splitAt = trimmed.lastIndexOf(':')
    if (splitAt <= 0) return []
    const name = trimmed.slice(0, splitAt)
    const kind = trimmed.slice(splitAt + 1)
    if (kind !== 'file' && kind !== 'directory') return []
    return [{ name, kind }]
  })
}

export async function downloadWorkspace(options: {
  projectId: string
  file: File | null
  requirementsText: string
  repositories?: { name: string; purpose?: string; description?: string }[]
  setupContext?: Record<string, unknown>
  /** Connected integration ids for .cursor/mcp.json (github, jira, confluence). */
  mcpProviders?: string[]
  /** Non-secret site hints for automation_sdlc/.env.mcp.example (never tokens). */
  mcpSiteHints?: {
    jiraUrl?: string
    jiraEmail?: string
    confluenceUrl?: string
    confluenceEmail?: string
  }
}): Promise<DownloadResult> {
  const form = new FormData()
  if (options.file) form.append('file', options.file)
  if (options.requirementsText.trim()) form.append('requirementsText', options.requirementsText)
  if (options.repositories?.length) {
    for (const repo of options.repositories) {
      const name = repo.name.trim()
      if (!name) continue
      form.append('repoName', name)
      form.append('repoPurpose', repo.purpose ?? '')
      form.append('repoDescription', repo.description ?? '')
    }
  }
  if (options.setupContext) form.append('setupContext', JSON.stringify(options.setupContext))
  if (options.mcpProviders?.length) {
    for (const provider of options.mcpProviders) {
      const id = provider.trim().toLowerCase()
      if (id) form.append('mcpProvider', id)
    }
  }
  const hints = options.mcpSiteHints
  if (hints?.jiraUrl?.trim()) form.append('mcpJiraUrl', hints.jiraUrl.trim())
  if (hints?.jiraEmail?.trim()) form.append('mcpJiraEmail', hints.jiraEmail.trim())
  if (hints?.confluenceUrl?.trim()) form.append('mcpConfluenceUrl', hints.confluenceUrl.trim())
  if (hints?.confluenceEmail?.trim()) form.append('mcpConfluenceEmail', hints.confluenceEmail.trim())
  const url = apiUrl(`/projects/${options.projectId}/download`)
  console.info(`[blink] POST ${url}`)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 180_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(await readError(response))
    console.info(`[blink] download HTTP ${response.status} bytes=${response.headers.get('content-length') ?? '?'}`)
    const original = await response.blob()
    const stripped = await stripExcludedZipFolders(original)
    const filename =
      response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'project-workspace.zip'
    const structure = sanitizeDownloadStructure(
      parseStructureHeader(response.headers.get('X-Blink-Workspace-Structure')),
    )
    const headerCount = Number(response.headers.get('X-Blink-File-Count') ?? '0')
    const fileCount = Number.isFinite(headerCount) ? Math.max(0, headerCount - stripped.removed) : 0
    const overlayCount = Number(response.headers.get('X-Blink-Overlay-Count') ?? '0')
    return {
      blob: stripped.blob,
      filename,
      structure,
      fileCount,
      nextCommand: response.headers.get('X-Blink-Next-Command')?.trim() || '',
      setupStatus: response.headers.get('X-Blink-Setup-Status')?.trim() || '',
      setupValidated: response.headers.get('X-Blink-Setup-Validated')?.trim().toLowerCase() === 'true',
      identitySource: response.headers.get('X-Blink-Identity-Source')?.trim() || '',
      overlayCount: Number.isFinite(overlayCount) ? overlayCount : 0,
      contextReady: response.headers.get('X-Blink-Context-Ready') === 'true',
      deliveryReady: response.headers.get('X-Blink-Delivery-Ready') === 'true',
      folderStatus: response.headers.get('X-Blink-Folder-Status')?.trim() || '',
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Download took too long. Try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export interface GroomOptionDto {
  id: string
  label: string
  description?: string
}

export interface GroomQuestionDto {
  id: string
  text: string
  options: GroomOptionDto[]
  allowOther: boolean
  allowMultiple?: boolean
  priority?: 'need_clarification' | 'important' | 'suggestion'
}

export interface GroomClarifyResult {
  runId?: string
  command?: string
  status: string
  message: string
  questions: GroomQuestionDto[]
  requirementDraft: string
  originalRequirement: string
  errors?: string[]
}

export async function clarifyRequirement(options: {
  projectId?: string | null
  projectName?: string
  requirementText: string
  answers?: { questionId: string; optionId: string; optionLabel?: string; otherText?: string }[]
}): Promise<GroomClarifyResult> {
  const url = apiUrl('/grooming/clarify')
  const answers = options.answers?.filter(
    (item) => item.optionId !== 'other' || Boolean(item.otherText?.trim()),
  )
  const body = {
    projectId: options.projectId || undefined,
    projectName: options.projectName || undefined,
    requirementText: options.requirementText,
    answers: answers?.length ? answers : undefined,
  }
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 100_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          isLocalApi()
            ? 'Local Blink API does not have the grooming endpoint. Restart blink-backend on port 8090 with the latest code.'
            : (await readError(response)) || 'Grooming is not available on this API yet.',
        )
      }
      throw new Error(await readError(response))
    }
    const parsed = (await response.json()) as GroomClarifyResult
    return {
      ...parsed,
      questions: normalizeGroomQuestions(parsed.questions),
      requirementDraft: parsed.requirementDraft ?? '',
      originalRequirement: parsed.originalRequirement ?? options.requirementText,
      message: parsed.message ?? '',
      status: parsed.status ?? 'error',
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The grooming helper took too long. Try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export interface PlanProductScopeResponse {
  status: string
  message: string
  nextCommand: string
  proposalDigest?: string
  epicIds?: string[]
  storyIds?: string[]
  productScope?: ProductScopeData
  errors?: string[]
}

export async function planProductScope(
  projectId?: string | null,
  payload?: {
    projectName?: string
    requirementText: string
    actor?: string
  }
): Promise<PlanProductScopeResponse> {
  const path = projectId ? `/projects/${projectId}/plan-product-scope` : `/projects/plan-product-scope`
  const url = apiUrl(path)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: projectId || undefined,
      projectName: payload?.projectName,
      requirementText: payload?.requirementText,
      actor: payload?.actor || 'operator',
    }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<PlanProductScopeResponse>
}
