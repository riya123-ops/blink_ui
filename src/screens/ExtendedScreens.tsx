import { useEffect, useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, ChevronLeft, Code2, Copy, ExternalLink, File, Folder, Monitor, Plus, Sparkles, Terminal, Trash2, XCircle } from 'lucide-react'
import {
  ARCHITECTURE_OPTIONS,
  GENERATION_CHECKLIST,
  IDE_TOOL_OPTIONS,
  NEXT_SDLC_COMMAND,
  PROVENANCE_LOG,
  REPO_MODEL_OPTIONS,
  TOPOLOGY_OPTIONS,
  defaultRepositories,
  defaultRepoTechnologies,
  githubRepoSlug,
  workspaceRootName,
  buildDownloadStructure,
  sanitizeDownloadStructure,
} from '../wizard/defaults'
import { computeReadiness, type WizardState, type WizardStep } from '../wizard/types'
import { buildReviewIssues } from '../wizard/reviewIssues'

interface ScreenProps {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

export function ProjectShapeScreen({ state, onUpdate }: ScreenProps) {
  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Project Shape</h2>
        <p>Define topology, repository model, and architecture style. You will name repositories on the next step.</p>
      </div>

      <section className="card">
        <h3 className="card-title">Application Topology</h3>
        <div className="topology-grid">
          {TOPOLOGY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`topology-card ${state.topology === opt.id ? 'active' : ''}`}
              onClick={() => onUpdate({ topology: opt.id })}
            >
              <span className="topo-icon">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="setup-grid-2">
        <section className="card">
          <h3 className="card-title">Repository Model</h3>
          <div className="option-row">
            {REPO_MODEL_OPTIONS.map((opt) => (
              <label className="radio-option" key={opt.id}>
                <input
                  type="radio"
                  name="repoModel"
                  checked={state.repositoryModel === opt.id}
                  onChange={() => onUpdate({ repositoryModel: opt.id })}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </section>
        <section className="card">
          <h3 className="card-title">Architecture Style</h3>
          <div className="option-row">
            {ARCHITECTURE_OPTIONS.map((opt) => (
              <label className="radio-option" key={opt.id}>
                <input
                  type="radio"
                  name="arch"
                  checked={state.architectureStyle === opt.id}
                  onChange={() => onUpdate({ architectureStyle: opt.id })}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="summary-cards">
        <div className="summary-card"><strong>Topology</strong><span>{TOPOLOGY_OPTIONS.find((t) => t.id === state.topology)?.label}</span></div>
        <div className="summary-card"><strong>Repos</strong><span>Named next</span></div>
        <div className="summary-card"><strong>Architecture</strong><span>{ARCHITECTURE_OPTIONS.find((a) => a.id === state.architectureStyle)?.label}</span></div>
      </div>
    </div>
  )
}

export function RepositoriesScreen({
  state,
  onUpdate,
  creating,
}: ScreenProps & {
  creating?: boolean
}) {
  useEffect(() => {
    if (state.repositoriesTouched) return
    const repos = defaultRepositories(state.projectName)
    onUpdate({ repositories: repos, repoTechnologies: defaultRepoTechnologies(repos) })
  }, [state.projectName, state.repositoriesTouched, onUpdate])

  const markTouched = (repositories: WizardState['repositories']) => {
    const keptIds = new Set(repositories.map((repo) => repo.id))
    const existingTech = state.repoTechnologies.filter((tech) => keptIds.has(tech.repoId))
    const missing = repositories.filter((repo) => !existingTech.some((tech) => tech.repoId === repo.id))
    onUpdate({
      repositories,
      repositoriesTouched: true,
      repoTechnologies: [...existingTech, ...defaultRepoTechnologies(missing)],
    })
  }

  const updateRepo = (id: string, field: string, value: string) => {
    markTouched(state.repositories.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const addRepo = () => {
    const id = `repo-${Date.now()}`
    const slug = githubRepoSlug(state.projectName)
    markTouched([
      ...state.repositories,
      { id, name: `${slug}-service`, purpose: 'Service', description: '', owner: '', dependencies: '' },
    ])
  }

  const github = state.integrations.find((item) => item.id === 'github')
  const githubReady = Boolean(github?.connected)

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Repositories</h2>
        <p>
          Names follow <strong>{state.projectName || 'your project'}</strong> and the shape you just chose. Edit or delete
          any you do not need.{' '}
          {githubReady
            ? 'Save & Continue will create them on GitHub.'
            : 'Connect GitHub on Integrations to create them on Save & Continue.'}
        </p>
      </div>
      <section className="card ref-card">
        <div className="card-title-row">
          <h3 className="card-title muted-title">Repo / Component</h3>
          <button type="button" className="text-btn" onClick={addRepo}><Plus size={14} /> Add Repository</button>
        </div>
        <div className="table-wrap">
          <table className="data-table ref-table repo-table">
            <thead>
              <tr>
                <th>Repo / Component</th>
                <th>Purpose / Role</th>
                <th>Description</th>
                <th>Owner</th>
                <th>Dependencies</th>
                <th>GitHub</th>
                <th className="col-action">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.repositories.map((repo) => (
                <tr key={repo.id}>
                  <td><input className="table-input mono" value={repo.name} onChange={(e) => updateRepo(repo.id, 'name', e.target.value)} /></td>
                  <td><input className="table-input" value={repo.purpose} onChange={(e) => updateRepo(repo.id, 'purpose', e.target.value)} /></td>
                  <td><input className="table-input wide" value={repo.description} onChange={(e) => updateRepo(repo.id, 'description', e.target.value)} /></td>
                  <td><input className="table-input" value={repo.owner} onChange={(e) => updateRepo(repo.id, 'owner', e.target.value)} /></td>
                  <td><input className="table-input" value={repo.dependencies} onChange={(e) => updateRepo(repo.id, 'dependencies', e.target.value)} /></td>
                  <td>
                    {repo.htmlUrl ? (
                      <a className="repo-link" href={repo.htmlUrl} target="_blank" rel="noreferrer">
                        {repo.createStatus === 'exists' ? 'Exists' : 'Created'}
                      </a>
                    ) : repo.createStatus === 'failed' ? (
                      <span className="repo-status failed">{repo.createMessage || 'Failed'}</span>
                    ) : creating ? (
                      <span className="muted">Creating…</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="col-action">
                    <button
                      type="button"
                      className="icon-btn"
                      title="Delete"
                      onClick={() => markTouched(state.repositories.filter((r) => r.id !== repo.id))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="github-create-bar">
          <p>
            {githubReady
              ? `GitHub connected as ${github?.account ?? 'your account'}${github?.organization ? ` / ${github.organization}` : ''}.`
              : 'GitHub is not connected. Repos stay local until you connect it on Integrations.'}
          </p>
        </div>
      </section>
    </div>
  )
}

export function TechnologyPerRepoScreen({ state, onUpdate }: ScreenProps) {
  const updateTech = (repoId: string, field: string, value: string) => {
    onUpdate({
      repoTechnologies: state.repoTechnologies.map((t) =>
        t.repoId === repoId ? { ...t, [field]: value } : t,
      ),
    })
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Technology (Per Repository)</h2>
        <p>Configure language, framework, and database for each repository.</p>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Language</th>
                <th>Framework / Tech</th>
                <th>Database</th>
                <th>Build / Testing</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.repoTechnologies.map((tech) => {
                const repo = state.repositories.find((r) => r.id === tech.repoId)
                return (
                  <tr key={tech.repoId}>
                    <td><strong>{repo?.name}</strong></td>
                    <td><input value={tech.language} onChange={(e) => updateTech(tech.repoId, 'language', e.target.value)} /></td>
                    <td><input value={tech.framework} onChange={(e) => updateTech(tech.repoId, 'framework', e.target.value)} /></td>
                    <td><input value={tech.database} onChange={(e) => updateTech(tech.repoId, 'database', e.target.value)} /></td>
                    <td><input value={tech.buildTool} onChange={(e) => updateTech(tech.repoId, 'buildTool', e.target.value)} /></td>
                    <td>
                      <select value={tech.status} onChange={(e) => updateTech(tech.repoId, 'status', e.target.value)}>
                        <option value="confirmed">Confirmed</option>
                        <option value="recommendation">Recommendation</option>
                        <option value="tbd">TBD</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const IDE_ICONS = {
  cursor: Sparkles,
  'claude-code': Terminal,
  'vscode-claude': Code2,
  'vscode-copilot': Bot,
} as const

export function IdeAndToolsScreen({ state, onUpdate }: ScreenProps) {
  return (
    <div className="screen">
      <div className="screen-header">
        <h2>IDE and Tools</h2>
        <p>Choose the IDE and AI coding assistant for this project.</p>
      </div>
      <section className="card">
        <h3 className="card-title">Development Environment</h3>
        <div className="ide-grid">
          {IDE_TOOL_OPTIONS.map((opt) => {
            const Icon = IDE_ICONS[opt.id as keyof typeof IDE_ICONS] ?? Monitor
            const selected = state.ideTool === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                className={`ide-card ${selected ? 'active' : ''} ${opt.enabled ? '' : 'disabled'}`}
                disabled={!opt.enabled}
                onClick={() => opt.enabled && onUpdate({ ideTool: opt.id })}
              >
                <span className="ide-icon">
                  <Icon size={22} />
                </span>
                <strong>{opt.label}</strong>
                <span className="ide-desc">{opt.description}</span>
                {!opt.enabled && <span className="ide-soon">Coming soon</span>}
              </button>
            )
          })}
        </div>
      </section>
      <div className="summary-cards">
        <div className="summary-card">
          <strong>Selected</strong>
          <span>{IDE_TOOL_OPTIONS.find((o) => o.id === state.ideTool)?.label ?? 'None'}</span>
        </div>
      </div>
    </div>
  )
}

export function PlatformDeliveryScreen({ state, onUpdate }: ScreenProps) {
  const envs = ['dev', 'qa', 'staging', 'prod'] as const

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Platform &amp; Delivery</h2>
        <p>Configure runtime and delivery context.</p>
      </div>
      <section className="card ref-card platform-panel">
        <div className="platform-row">
          <div className="field-group">
            <label>Cloud / Provider</label>
            <div className="select-with-add">
              <select value={state.cloudProvider} onChange={(e) => onUpdate({ cloudProvider: e.target.value })}>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">GCP</option>
              </select>
              <button type="button" className="add-chip-btn">+ Add</button>
            </div>
          </div>
          <div className="field-group">
            <label>Containerization</label>
            <select value={state.containerization} onChange={(e) => onUpdate({ containerization: e.target.value })}>
              <option value="docker">Docker</option>
              <option value="podman">Podman</option>
            </select>
          </div>
          <div className="field-group">
            <label>CI/CD</label>
            <select value={state.cicd} onChange={(e) => onUpdate({ cicd: e.target.value })}>
              <option value="github-actions">GitHub Actions</option>
              <option value="gitlab-ci">GitLab CI</option>
              <option value="jenkins">Jenkins</option>
            </select>
          </div>
        </div>

        <div className="platform-row">
          <div className="field-group">
            <label>Deployment Model</label>
            <select value={state.deploymentModel} onChange={(e) => onUpdate({ deploymentModel: e.target.value })}>
              <option value="kubernetes-eks">Kubernetes (EKS)</option>
              <option value="ecs">AWS ECS</option>
            </select>
          </div>
          <div className="field-group">
            <label>Infrastructure as Code</label>
            <select value={state.iac} onChange={(e) => onUpdate({ iac: e.target.value })}>
              <option value="terraform">Terraform</option>
              <option value="cloudformation">CloudFormation</option>
            </select>
          </div>
          <div className="field-group">
            <label>Secrets Management</label>
            <select value={state.secretsManagement} onChange={(e) => onUpdate({ secretsManagement: e.target.value })}>
              <option value="aws-secrets-manager">AWS Secrets Manager</option>
              <option value="vault">HashiCorp Vault</option>
            </select>
          </div>
        </div>

        <div className="field-group">
          <label>Environments</label>
          <div className="env-chips">
            {envs.map((env) => (
              <button
                key={env}
                type="button"
                className={`env-chip ${state.environments[env] ? 'active' : ''}`}
                onClick={() => onUpdate({ environments: { ...state.environments, [env]: !state.environments[env] } })}
              >
                {env.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label>Delivery Preferences</label>
          <div className="pref-checks">
            <label className="checkbox-option">
              <input type="checkbox" checked={state.blueGreenDeploy} onChange={(e) => onUpdate({ blueGreenDeploy: e.target.checked })} />
              Blue/Green Deployment
            </label>
            <label className="checkbox-option">
              <input type="checkbox" checked={state.canaryDeploy} onChange={(e) => onUpdate({ canaryDeploy: e.target.checked })} />
              Canary Releases
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}

export function ReviewResolveScreen({
  state,
  onNavigate,
}: {
  state: WizardState
  onNavigate: (step: WizardStep) => void
}) {
  const readiness = computeReadiness(state)
  const tbdCount = state.repoTechnologies.filter((t) => t.status === 'tbd').length
  const issues = buildReviewIssues(state)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleView = (issueId: string) => {
    setExpandedId((prev) => (prev === issueId ? null : issueId))
  }

  const handleResolve = (step: WizardStep) => {
    onNavigate(step)
  }

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Review &amp; Resolve</h2>
        <p>Review decisions and resolve outstanding items.</p>
      </div>

      <div className="review-status-bar">
        <div className="stat-card confirmed"><strong>52</strong><span>Confirmed</span></div>
        <div className="stat-card recommended"><strong>18</strong><span>Recommended</span></div>
        <div className="stat-card tbd"><strong>{tbdCount || issues.find((i) => i.id === 'tbd')?.details.length || 0}</strong><span>TBD</span></div>
        <div className="stat-card missing"><strong>{issues.find((i) => i.id === 'missing')?.details.length ?? 0}</strong><span>Missing</span></div>
      </div>

      <div className="review-body">
        <section className="card ref-card review-gauge-card">
          <div className="gauge-ring large" style={{ '--pct': readiness } as React.CSSProperties}>
            <span>{readiness}%</span>
          </div>
          <h3>Project Readiness</h3>
          <p>Almost there! Resolve remaining items to generate your project.</p>
        </section>

        <section className="card ref-card review-warnings-card">
          <h3 className="card-title">Items to Resolve</h3>
          <ul className="resolve-list">
            {issues.map((issue) => (
              <li key={issue.id} className={`resolve-item ${issue.type}${expandedId === issue.id ? ' expanded' : ''}`}>
                <div className="resolve-row">
                  {issue.type === 'error' && <XCircle size={16} />}
                  {issue.type === 'warn' && <AlertTriangle size={16} />}
                  {issue.type === 'info' && <AlertTriangle size={16} />}
                  <span>{issue.label}</span>
                  <button
                    type="button"
                    className="view-link"
                    onClick={() => handleView(issue.id)}
                    aria-expanded={expandedId === issue.id}
                  >
                    {expandedId === issue.id ? 'Hide' : 'View'}
                  </button>
                </div>
                {expandedId === issue.id && (
                  <div className="resolve-detail">
                    <ul>
                      {issue.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="resolve-go-btn"
                      onClick={() => handleResolve(issue.targetStep)}
                    >
                      Go resolve →
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card ref-card provenance-card">
        <h3 className="card-title">Latest Updates</h3>
        <ul className="provenance-list">
          {PROVENANCE_LOG.map((entry, i) => (
            <li key={i}>
              <strong>{entry.who}</strong> — {entry.what}
              <span>{entry.when}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function ProjectPreviewScreen({ state, onGenerate, loading }: { state: WizardState; onGenerate: () => void; loading: boolean }) {
  const [tab, setTab] = useState<'overview' | 'repos' | 'stack'>('overview')

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Generated Project Preview</h2>
        <p>Review what BLINK will generate before starting.</p>
      </div>
      <div className="tab-row">
        {(['overview', 'repos', 'stack'] as const).map((t) => (
          <button key={t} type="button" className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <section className="card">
        {tab === 'overview' && (
          <div>
            <p><strong>{state.projectName || 'Untitled'}</strong> — {state.description || 'No description'}</p>
            <p>Stack: Java Spring Boot + React + TypeScript + Vite</p>
            <p>IDE: {IDE_TOOL_OPTIONS.find((o) => o.id === state.ideTool)?.label ?? 'Cursor'}</p>
            <p>Model: {state.repositoryModel} · {state.architectureStyle}</p>
          </div>
        )}
        {tab === 'repos' && (
          <ul>{state.repositories.map((r) => <li key={r.id}>{r.name} — {r.purpose}</li>)}</ul>
        )}
        {tab === 'stack' && (
          <ul>{state.repoTechnologies.map((t) => {
            const repo = state.repositories.find((r) => r.id === t.repoId)
            return <li key={t.repoId}>{repo?.name}: {t.language}, {t.framework}</li>
          })}</ul>
        )}
      </section>
      <div className="row-actions">
        <button type="button" className="primary-btn large" disabled={loading} onClick={onGenerate}>
          Generate Project →
        </button>
      </div>
    </div>
  )
}

export function GenerationDownloadScreen({
  state,
  loading,
  onBack,
  exporting,
  onExportGithub,
}: {
  state: WizardState
  loading: boolean
  onBack?: () => void
  exporting?: boolean
  onExportGithub?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [copiedMcp, setCopiedMcp] = useState(false)

  if (!state.generationComplete && loading) {
    const steps = state.generationSteps
    const total = Math.max(steps.length, 1)
    const done = steps.filter((step) => step.status === 'done').length
    const running = steps.find((step) => step.status === 'running')
    const percent = running
      ? Math.min(99, Math.round((done / total) * 100) + Math.round(50 / total))
      : Math.round((done / total) * 100)

    return (
      <div className="screen screen-ref gen-loading">
        <h2>Generating your project…</h2>
        <p>{running?.label || 'Scaffolding repositories, configs, and SDLC structure.'}</p>
        <div className="gen-progress">
          <div className="gen-progress-copy">
            <span>{running?.label || 'Working…'}</span>
            <strong>{percent}%</strong>
          </div>
          <div
            className="gen-progress-bar"
            role="progressbar"
            aria-label="Generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span className="gen-progress-bar-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <ul className="gen-progress-list">
          {steps.map((s) => (
            <li key={s.id} className={s.status}>{s.label}</li>
          ))}
        </ul>
      </div>
    )
  }

  if (!state.generationComplete) {
    return (
      <div className="screen screen-ref">
        <div className="screen-header"><h2>Generation / Download</h2></div>
        <section className="card ref-card"><p>Click Download Project to generate and download the workspace.</p></section>
      </div>
    )
  }

  const timeStr = state.generationTimeSec
    ? `${String(Math.floor(state.generationTimeSec / 60)).padStart(2, '0')}:${String(state.generationTimeSec % 60).padStart(2, '0')} min`
    : '00:00 min'
  const structure = sanitizeDownloadStructure(
    state.downloadStructure.length
      ? state.downloadStructure
      : buildDownloadStructure(
          state.repositoriesTouched ? state.repositories : defaultRepositories(state.projectName),
        ),
  )
  const nextCommand = state.nextSdlcCommand || NEXT_SDLC_COMMAND
  const github = state.integrations.find((item) => item.id === 'github')
  const githubReady = Boolean(github?.connected)
  const fileCount = state.filesGenerated > 0 ? state.filesGenerated : structure.length
  const rootName =
    state.downloadFilename?.replace(/\.zip$/i, '') || workspaceRootName(state.projectName)

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(nextCommand)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const mcpSetupCommand =
    'Copy-Item automation_sdlc\\env.mcp.example automation_sdlc\\.env.mcp'

  const copyMcpSetup = async () => {
    try {
      await navigator.clipboard.writeText(mcpSetupCommand)
      setCopiedMcp(true)
      window.setTimeout(() => setCopiedMcp(false), 1600)
    } catch {
      setCopiedMcp(false)
    }
  }

  return (
    <div className="screen screen-ref success-screen success-screen-full">
      <div className="confetti-wrap full" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="confetti"
            style={{ '--c': ['#5850EC', '#F472B6', '#FBBF24', '#34D399', '#60A5FA'][i % 5], '--i': i } as React.CSSProperties}
          />
        ))}
      </div>

      <section className="card ref-card success-card-full">
        <div className="success-grid">
          <div className="success-hero-col">
            <div className="success-badge lg">
              <CheckCircle2 size={48} strokeWidth={2.5} />
            </div>
            <h2>Your project is ready!</h2>
            <p className="success-sub">Blink has successfully generated your project.</p>

            <div className="gen-stats ref inline-stats">
              <div className="stat-block">
                <strong>{fileCount.toLocaleString()}</strong>
                <span>Files Generated</span>
              </div>
              <div className="stat-block">
                <strong>{timeStr}</strong>
                <span>Time Taken</span>
              </div>
            </div>

            <div className="next-command-box">
              <h4>Next SDLC command</h4>
              <p>Unzip the bundle, open it in Cursor, then run:</p>
              <div className="next-command-row">
                <code>{nextCommand}</code>
                <button type="button" className="ghost-btn" onClick={() => void copyCommand()}>
                  <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="next-command-box">
              <h4>MCP config in the zip</h4>
              <p>
                After unzip, open <code>{rootName}</code> in Cursor, copy the env example, add tokens, then reload MCP
                (default <code>mcp.json</code> is already Windows-ready):
              </p>
              <div className="next-command-row">
                <code>{mcpSetupCommand}</code>
                <button type="button" className="ghost-btn" onClick={() => void copyMcpSetup()}>
                  <Copy size={14} /> {copiedMcp ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {(state.setupStatus || state.setupOverlayCount > 0) && (
              <div className="next-command-box overlay-summary-box">
                <h4>Workspace overlay</h4>
                {state.setupOverlayCount > 0 ? (
                  <p>
                    Canonical setup added {state.setupOverlayCount} file{state.setupOverlayCount === 1 ? '' : 's'} under{' '}
                    <code>.cursor/ai-sdlc</code>
                    {state.setupIdentitySource
                      ? ` from ${state.setupIdentitySource === 'requirement' ? 'your requirement' : 'the project description'}.`
                      : '.'}
                  </p>
                ) : (
                  <p>Canonical workspace setup was not completed, so no download was created.</p>
                )}
                {state.setupOverlayCount > 0 && (
                  <p className="muted">
                    Context readiness: {state.setupContextReady ? 'ready' : 'needs follow-up'} · Delivery readiness:{' '}
                    {state.setupDeliveryReady ? 'ready' : 'topology confirmation required'}
                  </p>
                )}
              </div>
            )}

            <div className="success-actions row">
              <button
                type="button"
                className="secondary-btn outline-purple"
                disabled={!githubReady || exporting}
                onClick={() => onExportGithub?.()}
              >
                <ExternalLink size={16} /> {exporting ? 'Creating repos…' : 'Export to GitHub'}
              </button>
              {!githubReady && (
                <span className="muted">Connect GitHub on Integrations to create repositories.</span>
              )}
            </div>

            {onBack && (
              <button type="button" className="back-dashboard" onClick={onBack}>
                <ChevronLeft size={14} /> Back to Dashboard
              </button>
            )}
          </div>

          <div className="success-summary-col">
            <div className="summary-box full">
              <h4>Generation Summary</h4>
              <ul className="checklist ref">
                {GENERATION_CHECKLIST.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} className="check-green" />
                    <span className="check-label">{item}</span>
                    <span className="done-tag">Completed</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="output-preview-box">
              <h4>Generated Downloaded Structure</h4>
              <div className="download-structure">
                <div className="download-structure-root">{rootName}</div>
                <ul className="download-structure-list">
                  {structure.map((entry) => (
                    <li key={`${entry.kind}-${entry.name}`} className={entry.kind}>
                      {entry.kind === 'file' ? <File size={16} /> : <Folder size={16} />}
                      <span>{entry.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

