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

/** Render API. Override with VITE_API_URL=/api to use the local Vite proxy. */
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
  const response = await fetch(apiUrl('/stakeholder-roles'))
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

export async function downloadWorkspace(options: {
  projectId: string
  file: File | null
  requirementsText: string
}): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData()
  if (options.file) form.append('file', options.file)
  if (options.requirementsText.trim()) form.append('requirementsText', options.requirementsText)
  const response = await fetch(apiUrl(`/projects/${options.projectId}/download`), {
    method: 'POST',
    body: form,
  })
  if (!response.ok) throw new Error(await readError(response))
  const blob = await response.blob()
  const filename =
    response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'blink-workspace.zip'
  return { blob, filename }
}
