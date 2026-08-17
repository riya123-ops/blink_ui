export interface RepoDefinition {
  id: string
  name: string
  purpose: string
  description: string
  owner: string
  dependencies: string
}

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
  { id: 'github', label: 'GitHub', category: 'Git Provider', icon: '🐙', connected: true },
  { id: 'jira', label: 'Jira', category: 'Issue Tracker', icon: '📋', connected: true },
  { id: 'github-actions', label: 'GitHub Actions', category: 'CI/CD', icon: '⚙️', connected: true },
  { id: 'ecr', label: 'AWS ECR', category: 'Artifact Registry', icon: '📦', connected: true },
  { id: 'prometheus', label: 'Prometheus + Grafana', category: 'Observability', icon: '📈', connected: true },
  { id: 'elk', label: 'ELK Stack', category: 'Logging', icon: '📝', connected: true },
  { id: 'teams', label: 'Microsoft Teams', category: 'Communication', icon: '💬', connected: true },
  { id: 'slack', label: 'Slack', category: 'ChatOps', icon: '🔔', connected: true },
  { id: 'sonarqube', label: 'SonarQube', category: 'Code Quality', icon: '🔍', connected: true },
]

export function defaultRepositories(artifact: string): RepoDefinition[] {
  const slug = artifact || 'blink-app'
  return [
    {
      id: 'repo-customer',
      name: 'customer-service',
      purpose: 'Service',
      description: 'Customer domain service — CRUD, profiles, preferences',
      owner: 'Atul Sharma',
      dependencies: 'auth-service, PostgreSQL',
    },
    {
      id: 'repo-auth',
      name: 'auth-service',
      purpose: 'Service',
      description: 'Authentication & authorization (OAuth2/JWT)',
      owner: 'James Chen',
      dependencies: 'PostgreSQL, Redis',
    },
    {
      id: 'repo-gateway',
      name: 'api-gateway',
      purpose: 'Edge',
      description: 'API gateway — routing, rate limiting, auth passthrough',
      owner: 'Atul Sharma',
      dependencies: 'auth-service, customer-service',
    },
    {
      id: 'repo-web',
      name: `${slug}-web`,
      purpose: 'Frontend',
      description: 'React + TypeScript + Vite SPA',
      owner: 'Priya Mehta',
      dependencies: 'api-gateway',
    },
    {
      id: 'repo-api',
      name: `${slug}-api`,
      purpose: 'Backend API',
      description: 'Spring Boot core REST API (Java 21)',
      owner: 'Atul Sharma',
      dependencies: 'PostgreSQL',
    },
  ]
}

export function defaultRepoTechnologies(repos: RepoDefinition[]): RepoTechnology[] {
  return repos.map((repo) => {
    const name = repo.name.toLowerCase()
    const isWeb = repo.purpose === 'Frontend' || name.includes('web')
    const isMobile = name.includes('mobile')
    if (isWeb) {
      return {
        repoId: repo.id,
        language: 'TypeScript',
        framework: 'React 19 + Vite',
        database: '—',
        buildTool: 'npm / Vite',
        status: 'confirmed',
      }
    }
    if (isMobile) {
      return {
        repoId: repo.id,
        language: 'Kotlin',
        framework: 'Android / Compose',
        database: '—',
        buildTool: 'Gradle',
        status: 'recommendation',
      }
    }
    return {
      repoId: repo.id,
      language: 'Java 21',
      framework: 'Spring Boot 3.4',
      database: 'PostgreSQL',
      buildTool: 'Gradle',
      status: 'confirmed',
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
