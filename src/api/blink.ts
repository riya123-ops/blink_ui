import { sanitizeDownloadStructure } from '../wizard/defaults'
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

export async function fetchStakeholderRoles(): Promise<StakeholderRoleDto[]> {
  const url = apiUrl('/stakeholder-roles')
  console.info(`[blink] GET ${url}`)
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<StakeholderRoleDto[]>
}

export async function saveProject(payload: ProjectPayload, projectId?: string | null): Promise<ProjectDto> {
  const url = projectId ? apiUrl(`/projects/${projectId}`) : apiUrl('/projects')
  const method = projectId ? 'PUT' : 'POST'
  console.info(`[blink] ${method} ${url}`, payload)
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<ProjectDto>
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
  const response = await fetch(apiUrl(`/projects/${options.projectId}/download`), {
    method: 'POST',
    body: form,
  })
  if (!response.ok) throw new Error(await readError(response))
  const original = await response.blob()
  const stripped = await stripExcludedZipFolders(original)
  const filename =
    response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'project-workspace.zip'
  const structure = sanitizeDownloadStructure(
    parseStructureHeader(response.headers.get('X-Blink-Workspace-Structure')),
  )
  const headerCount = Number(response.headers.get('X-Blink-File-Count') ?? '0')
  const fileCount = Number.isFinite(headerCount) ? Math.max(0, headerCount - stripped.removed) : 0
  return {
    blob: stripped.blob,
    filename,
    structure,
    fileCount,
    nextCommand: response.headers.get('X-Blink-Next-Command')?.trim() || '/setup-new-workspace',
  }
}
