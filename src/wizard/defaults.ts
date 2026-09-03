export interface RepoDefinition {
  id: string
  name: string
  purpose: string
  description: string
  owner: string
  dependencies: string
  htmlUrl?: string
  createStatus?: 'created' | 'exists' | 'failed'
  createMessage?: string
}

export interface WorkspaceEntry {
  name: string
  kind: 'file' | 'directory'
}

export function workspaceRootName(projectName: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  const base = slug || 'project'
  return base.endsWith('_workspace') ? base : `${base}_workspace`
}

const SHARED_DOWNLOAD_FOLDERS = ['.cursor', 'automation_sdlc'] as const

export const EXCLUDED_DOWNLOAD_FOLDERS = ['blink_demo', 'blink_backend', 'blink-backend'] as const

export function isExcludedDownloadFolder(name: string): boolean {
  const normalized = name.trim().replace(/\\/g, '/').split('/').filter(Boolean)
  return normalized.some((part) => (EXCLUDED_DOWNLOAD_FOLDERS as readonly string[]).includes(part))
}

export function sanitizeDownloadStructure(entries: WorkspaceEntry[] = []): WorkspaceEntry[] {
  return entries.filter((entry) => !isExcludedDownloadFolder(entry.name))
}

export function buildDownloadStructure(repositories: { name: string }[] = []): WorkspaceEntry[] {
  const reserved = new Set<string>([
    'requirement.md',
    ...SHARED_DOWNLOAD_FOLDERS,
    ...EXCLUDED_DOWNLOAD_FOLDERS,
  ])
  const repos = repositories
    .map((repo) => githubRepoSlug(repo.name))
    .filter((name) => name && !reserved.has(name))
    .filter((name, index, all) => all.indexOf(name) === index)
    .map((name) => ({ name, kind: 'directory' as const }))
  return sanitizeDownloadStructure([
    { name: 'requirement.md', kind: 'file' },
    { name: 'automation_sdlc', kind: 'directory' },
    { name: '.cursor', kind: 'directory' },
    ...repos,
  ])
}

export const NEXT_SDLC_COMMAND = '/setup-new-workspace'

export interface RepoTechnology {
  repoId: string
  language: string
  framework: string
  database: string
  buildTool: string
  status: 'confirmed' | 'recommendation' | 'tbd'
}

export interface IntegrationItem {
  id: string
  label: string
  category: string
  icon: string
  connected: boolean
  account?: string
  detail?: string
  baseUrl?: string
  organization?: string
  workspace?: string
  email?: string
  username?: string
  projectKey?: string
  spaceKey?: string
  token?: string
}

export const TOPOLOGY_OPTIONS = [
  { id: 'single-app', label: 'Single App', icon: '📱' },
  { id: 'frontend-only', label: 'Frontend Only', icon: '🖥️' },
  { id: 'full-stack', label: 'Full Stack', icon: '⚡' },
  { id: 'data-platform', label: 'Data Platform', icon: '📊' },
  { id: 'microservices', label: 'Microservices', icon: '🔗' },
  { id: 'ai-ml', label: 'AI / ML', icon: '🤖' },
]

export const REPO_MODEL_OPTIONS = [
  { id: 'single-repo', label: 'Single Repo' },
  { id: 'monorepo', label: 'Monorepo' },
  { id: 'multi-repo', label: 'Multi-Repo' },
]

export const ARCHITECTURE_OPTIONS = [
  { id: 'layered', label: 'Layered' },
  { id: 'microservices', label: 'Microservices' },
  { id: 'modular-monolith', label: 'Modular Monolith' },
  { id: 'event-driven', label: 'Event Driven' },
]

export const IDE_TOOL_OPTIONS = [
  {
    id: 'cursor',
    label: 'Cursor',
    description: 'AI-native IDE with agent and slash commands',
    enabled: true,
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'Anthropic CLI coding agent in the terminal',
    enabled: false,
  },
  {
    id: 'vscode-claude',
    label: 'VS Code + Claude',
    description: 'Visual Studio Code with the Claude extension',
    enabled: false,
  },
  {
    id: 'vscode-copilot',
    label: 'VS Code + Copilot',
    description: 'Visual Studio Code with GitHub Copilot',
    enabled: false,
  },
]

export function ideOverlayPath(ideTool: string): string {
  switch (ideTool) {
    case 'claude-code':
      return '.claude/'
    case 'vscode-claude':
    case 'vscode-copilot':
      return '.vscode/'
    default:
      return '.cursor/ai-sdlc/'
  }
}

export const DEFAULT_INTEGRATIONS: IntegrationItem[] = [
  { id: 'github', label: 'GitHub', category: 'Code management', icon: '🐙', connected: false },
  { id: 'jira', label: 'Jira', category: 'Issue Tracker', icon: '📋', connected: false },
  { id: 'confluence', label: 'Confluence', category: 'Documentation', icon: '📘', connected: false },
  { id: 'bitbucket', label: 'Bitbucket', category: 'Git Provider', icon: '🪣', connected: false },
]

export function githubRepoSlug(projectName: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'project'
}

const REPO_VARIANTS = [
  {
    id: 'repo-backend',
    suffix: 'backend',
    purpose: 'Backend',
    description: 'Application API and business services',
  },
  {
    id: 'repo-frontend',
    suffix: 'frontend',
    purpose: 'Frontend',
    description: 'Web UI',
  },
  {
    id: 'repo-db',
    suffix: 'db',
    purpose: 'Database',
    description: 'Schema, migrations, and data scripts',
  },
  {
    id: 'repo-infra',
    suffix: 'infra',
    purpose: 'Infrastructure',
    description: 'Provisioning, environments, and delivery',
  },
] as const

export function defaultRepositories(projectName: string): RepoDefinition[] {
  const slug = githubRepoSlug(projectName)
  return REPO_VARIANTS.map((variant) => ({
    id: variant.id,
    name: `${slug}-${variant.suffix}`,
    purpose: variant.purpose,
    description: variant.description,
    owner: '',
    dependencies: '',
  }))
}

export function defaultRepoTechnologies(repos: RepoDefinition[]): RepoTechnology[] {
  return repos.map((repo) => {
    const name = repo.name.toLowerCase()
    const purpose = repo.purpose.toLowerCase()
    if (purpose === 'frontend' || name.endsWith('-frontend') || name.includes('web')) {
      return {
        repoId: repo.id,
        language: 'TypeScript',
        framework: 'React 19 + Vite',
        database: '—',
        buildTool: 'npm / Vite',
        status: 'confirmed' as const,
      }
    }
    if (purpose === 'database' || name.endsWith('-db')) {
      return {
        repoId: repo.id,
        language: 'SQL',
        framework: 'PostgreSQL',
        database: 'PostgreSQL',
        buildTool: 'Flyway / Liquibase',
        status: 'confirmed' as const,
      }
    }
    if (purpose === 'infrastructure' || name.endsWith('-infra')) {
      return {
        repoId: repo.id,
        language: 'HCL',
        framework: 'Terraform',
        database: '—',
        buildTool: 'Terraform',
        status: 'confirmed' as const,
      }
    }
    return {
      repoId: repo.id,
      language: 'Java 21',
      framework: 'Spring Boot 3.4',
      database: 'PostgreSQL',
      buildTool: 'Gradle',
      status: 'confirmed' as const,
    }
  })
}

export const GENERATION_CHECKLIST = [
  'All decisions resolved',
  'Repositories created',
  'Configurations generated',
  'SDLC structure generated',
  'Files packaged',
]

export const REVIEW_WARNINGS = [
  { id: 'missing', type: 'error', label: '3 Missing decisions', action: 'View' },
  { id: 'tbd', type: 'warn', label: '7 TBD items', action: 'View' },
  { id: 'arch', type: 'info', label: '2 Architecture warnings', action: 'View' },
]

export const PROVENANCE_LOG = [
  { who: 'Atul Sharma', what: 'Confirmed Spring Boot 3.4 for backend services', when: '2 hours ago' },
  { who: 'Priya Mehta', what: 'Updated React + Vite frontend stack', when: '1 hour ago' },
  { who: 'James Chen', what: 'Set OAuth2/JWT security requirements', when: '45 min ago' },
]
