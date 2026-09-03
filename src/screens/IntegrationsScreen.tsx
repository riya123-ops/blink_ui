import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, X } from 'lucide-react'
import { ApiRequestError, connectIntegration } from '../api/blink'
import type { IntegrationItem } from '../wizard/defaults'
import type { WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

interface ConnectForm {
  token: string
  username: string
  email: string
  organization: string
  workspace: string
  baseUrl: string
  projectKey: string
  spaceKey: string
}

const EMPTY_FORM: ConnectForm = {
  token: '',
  username: '',
  email: '',
  organization: '',
  workspace: '',
  baseUrl: '',
  projectKey: '',
  spaceKey: '',
}

const GUIDES: Record<
  string,
  { tokenLabel: string; tokenUrl: string; steps: string[] }
> = {
  github: {
    tokenLabel: 'Personal access token',
    tokenUrl: 'https://github.com/settings/tokens/new?scopes=repo,read:org&description=BLINK',
    steps: [
      'Open GitHub → Settings → Developer settings → Personal access tokens.',
      'Create a classic token with repo and read:org scopes.',
      'Paste the token below. Organization is optional.',
    ],
  },
  jira: {
    tokenLabel: 'Atlassian API token',
    tokenUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    steps: [
      'Create an API token from your Atlassian account.',
      'Enter your Cloud site, for example https://your-team.atlassian.net.',
      'Use the same email you sign in to Jira with.',
    ],
  },
  confluence: {
    tokenLabel: 'Atlassian API token',
    tokenUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    steps: [
      'Create an API token from your Atlassian account (same token as Jira).',
      'Enter your Cloud site, for example https://your-team.atlassian.net.',
      'Space key is optional if you only want to verify the account.',
    ],
  },
  bitbucket: {
    tokenLabel: 'App password',
    tokenUrl: 'https://bitbucket.org/account/settings/app-passwords/',
    steps: [
      'Open Bitbucket → Personal settings → App passwords.',
      'Create a password with Account: Read, Workspaces: Read, and Repositories: Read.',
      'Enter your Bitbucket username and workspace slug.',
    ],
  },
}

function formFromItem(item: IntegrationItem, jira?: IntegrationItem): ConnectForm {
  const fromJira = item.id === 'confluence' && jira?.connected
  return {
    ...EMPTY_FORM,
    baseUrl: item.baseUrl || (fromJira ? jira?.baseUrl ?? '' : item.id === 'github' ? 'https://github.com' : ''),
    email: item.email || (fromJira ? jira?.email ?? '' : ''),
    organization: item.organization ?? '',
    workspace: item.workspace ?? '',
    username: item.username ?? '',
    projectKey: item.projectKey ?? '',
    spaceKey: item.spaceKey ?? '',
  }
}

export function IntegrationsScreen({ state, onUpdate }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [form, setForm] = useState<ConnectForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const active = state.integrations.find((item) => item.id === activeId) ?? null
  const jira = state.integrations.find((item) => item.id === 'jira')
  const guide = active ? GUIDES[active.id] : null

  useEffect(() => {
    if (!activeId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setActiveId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId, saving])

  const connectedCount = useMemo(
    () => state.integrations.filter((item) => item.connected).length,
    [state.integrations],
  )

  const openConnect = (item: IntegrationItem) => {
    setError(null)
    setForm(formFromItem(item, jira))
    setActiveId(item.id)
  }

  const patchItem = (id: string, updates: Partial<IntegrationItem>) => {
    onUpdate({
      integrations: state.integrations.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    })
  }

  const disconnect = (id: string) => {
    patchItem(id, {
      connected: false,
      account: undefined,
      detail: undefined,
      token: undefined,
    })
    setActiveId(null)
  }

  const handleConnect = async () => {
    if (!active) return
    if ((active.id === 'jira' || active.id === 'confluence') && (!form.baseUrl.trim() || !form.email.trim())) {
      setError('Cloud site URL and Atlassian email are required.')
      return
    }
    if (active.id === 'bitbucket' && (!form.workspace.trim() || !form.username.trim())) {
      setError('Workspace and username are required.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      provider: active.id,
      token: form.token.trim(),
      username: form.username.trim() || undefined,
      email: form.email.trim() || undefined,
      organization: form.organization.trim() || undefined,
      workspace: form.workspace.trim() || undefined,
      baseUrl: form.baseUrl.trim() || undefined,
      projectKey: form.projectKey.trim() || undefined,
      spaceKey: form.spaceKey.trim() || undefined,
    }
    try {
      const result = await connectIntegration(payload)
      patchItem(active.id, {
        connected: true,
        account: result.account,
        detail: result.detail,
        token: payload.token,
        baseUrl: payload.baseUrl,
        organization: payload.organization,
        workspace: payload.workspace,
        email: payload.email,
        username: payload.username,
        projectKey: payload.projectKey,
        spaceKey: payload.spaceKey,
      })
      setActiveId(null)
    } catch (err) {
      const status = err instanceof ApiRequestError ? err.status : 0
      const message = err instanceof Error ? err.message : ''
      const unreachable =
        status === 0 ||
        status === 404 ||
        status === 405 ||
        status === 502 ||
        status === 503 ||
        /no static resource/i.test(message)
      if (unreachable && payload.token) {
        const account = payload.email || payload.username || payload.organization || payload.workspace || active.label
        patchItem(active.id, {
          connected: true,
          account,
          detail: `Saved ${active.label} locally. Start blink-backend on port 8090 to live-verify tokens.`,
          token: payload.token,
          baseUrl: payload.baseUrl,
          organization: payload.organization,
          workspace: payload.workspace,
          email: payload.email,
          username: payload.username,
          projectKey: payload.projectKey,
          spaceKey: payload.spaceKey,
        })
        setActiveId(null)
        return
      }
      setError(err instanceof Error ? err.message : `Could not connect ${active.label}.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Integrations</h2>
        <p>Connect GitHub, Jira, Confluence, and Bitbucket with an API token. {connectedCount} of 4 connected. GitHub is used on Repositories, after Project Shape, to create them.</p>
      </div>
      <section className="card ref-card">
        <ol className="connect-howto">
          <li>Click <strong>Connect</strong> on a tool.</li>
          <li>Open the token link in the dialog and create a token or app password.</li>
          <li>Paste it here and click <strong>Connect</strong>. Tokens are not written into the generated project.</li>
        </ol>
        <div className="integration-grid ref">
          {state.integrations.map((item) => (
            <article
              key={item.id}
              className={`integration-card ref ${item.connected ? 'connected' : ''}`}
              onClick={() => openConnect(item)}
            >
              <span className="int-icon">{item.icon}</span>
              <div className="int-body">
                <strong>{item.label}</strong>
                <span className="int-category">
                  {item.connected && item.account ? item.account : item.category}
                </span>
              </div>
              {item.connected ? (
                <div className="int-card-actions">
                  <span className="connected-label">✓ Connected</span>
                  <button
                  type="button"
                  className="text-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    openConnect(item)
                  }}
                >
                    Manage
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="primary-btn int-connect-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    openConnect(item)
                  }}
                >
                  Connect
                </button>
              )}
            </article>
          ))}
        </div>
        <div className="info-note">
          <AlertTriangle size={14} />
          <span>
            Credentials stay in this browser session only and are <strong>not</strong> included in the downloadable project.
          </span>
        </div>
      </section>

      {active && guide && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!saving) setActiveId(null)
          }}
        >
          <div
            className="connect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="connect-modal-header">
              <div>
                <h3 id="connect-title">
                  <span className="int-icon">{active.icon}</span> Connect {active.label}
                </h3>
                <p>{active.category}</p>
              </div>
              <button type="button" className="icon-btn" aria-label="Close" disabled={saving} onClick={() => setActiveId(null)}>
                <X size={16} />
              </button>
            </header>

            <ol className="connect-steps">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a className="token-link" href={guide.tokenUrl} target="_blank" rel="noreferrer">
              Create {guide.tokenLabel.toLowerCase()} <ExternalLink size={14} />
            </a>

            {active.id === 'confluence' && jira?.connected && (
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    baseUrl: jira.baseUrl || prev.baseUrl,
                    email: jira.email || prev.email,
                  }))
                }
              >
                Use Jira site and email
              </button>
            )}

            <div className="connect-fields">
              {active.id === 'github' && (
                <div className="field-group">
                  <label htmlFor="int-org">Organization (optional)</label>
                  <input
                    id="int-org"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="your-org"
                  />
                </div>
              )}
              {(active.id === 'jira' || active.id === 'confluence') && (
                <>
                  <div className="field-group">
                    <label htmlFor="int-site">Cloud site URL</label>
                    <input
                      id="int-site"
                      value={form.baseUrl}
                      onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                      placeholder="https://your-team.atlassian.net"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="int-email">Atlassian email</label>
                    <input
                      id="int-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@company.com"
                    />
                  </div>
                  {active.id === 'jira' && (
                    <div className="field-group">
                      <label htmlFor="int-project">Project key (optional)</label>
                      <input
                        id="int-project"
                        value={form.projectKey}
                        onChange={(e) => setForm({ ...form, projectKey: e.target.value })}
                        placeholder="PROJ"
                      />
                    </div>
                  )}
                  {active.id === 'confluence' && (
                    <div className="field-group">
                      <label htmlFor="int-space">Space key (optional)</label>
                      <input
                        id="int-space"
                        value={form.spaceKey}
                        onChange={(e) => setForm({ ...form, spaceKey: e.target.value })}
                        placeholder="ENG"
                      />
                    </div>
                  )}
                </>
              )}
              {active.id === 'bitbucket' && (
                <>
                  <div className="field-group">
                    <label htmlFor="int-workspace">Workspace</label>
                    <input
                      id="int-workspace"
                      value={form.workspace}
                      onChange={(e) => setForm({ ...form, workspace: e.target.value })}
                      placeholder="your-workspace"
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="int-user">Username</label>
                    <input
                      id="int-user"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="bitbucket-username"
                    />
                  </div>
                </>
              )}
              <div className="field-group">
                <label htmlFor="int-token">{guide.tokenLabel}</label>
                <input
                  id="int-token"
                  type="password"
                  autoComplete="off"
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                  placeholder={active.connected ? 'Enter a token to reconnect' : 'Paste token'}
                />
              </div>
            </div>

            {error && <p className="connect-error">{error}</p>}

            <footer className="connect-modal-actions">
              {active.connected && (
                <button type="button" className="secondary-btn" disabled={saving} onClick={() => disconnect(active.id)}>
                  Disconnect
                </button>
              )}
              <div className="action-spacer" />
              <button type="button" className="secondary-btn" disabled={saving} onClick={() => setActiveId(null)}>
                Cancel
              </button>
              <button type="button" className="primary-btn" disabled={saving || !form.token.trim()} onClick={() => void handleConnect()}>
                {saving ? 'Verifying…' : 'Connect'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
