import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { ExternalLink, RefreshCw, Sparkles, X } from 'lucide-react'
import {
  connectIntegration,
  exchangeGithubOAuth,
  exchangeJiraOAuth,
  fetchGithubOAuthUrl,
  fetchGithubOrgs,
  fetchJiraOAuthUrl,
  fetchJiraProjects,
  saveIntegrationBinding,
  type GithubOrgItem,
  type JiraProjectItem,
} from '../api/blink'
import type { IntegrationItem } from '../wizard/defaults'
import type { WizardState } from '../wizard/types'
import { IntegrationLogo } from './IntegrationLogo'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  onEnsureProject?: () => Promise<{ id: string; created: boolean }>
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
      'Prefer Connect with GitHub. Use a personal access token below if the popup or OAuth app is unavailable.',
      'Create a classic PAT with repo and read:org, or a fine-grained token that can create repositories.',
      'After you download the zip, copy automation_sdlc/.env.mcp.example to .env.mcp and set GITHUB_PERSONAL_ACCESS_TOKEN for Cursor MCP.',
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

const DISPLAY_CARDS = [
  {
    id: 'github',
    openId: 'github' as const,
    label: 'GitHub',
    purpose: 'Source control and new repositories',
  },
  {
    id: 'atlassian',
    openId: 'jira' as const,
    label: 'Atlassian',
    purpose: 'Jira for issues · Confluence for documentation',
  },
  {
    id: 'bitbucket',
    openId: 'bitbucket' as const,
    label: 'Bitbucket',
    purpose: 'Git hosting in an Atlassian workspace',
  },
]

function purposeFor(id: string): string {
  if (id === 'github') return DISPLAY_CARDS[0].purpose
  if (id === 'bitbucket') return DISPLAY_CARDS[2].purpose
  return DISPLAY_CARDS[1].purpose
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

export function IntegrationsScreen({ state, onUpdate, onEnsureProject }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [form, setForm] = useState<ConnectForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthNotice, setOauthNotice] = useState<string | null>(null)
  const [projects, setProjects] = useState<JiraProjectItem[]>([])
  const [githubOrgs, setGithubOrgs] = useState<GithubOrgItem[]>([])
  const [discoveringProjects, setDiscoveringProjects] = useState(false)
  const [discoveringOrgs, setDiscoveringOrgs] = useState(false)
  const [isCustomProjectKey, setIsCustomProjectKey] = useState(false)
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const oauthRedirectUriRef = useRef<string | undefined>(undefined)
  const githubOrgRef = useRef('')
  const projectIdRef = useRef(state.projectId)

  useEffect(() => {
    projectIdRef.current = state.projectId
  }, [state.projectId])

  const requireStoredProject = useCallback(async (): Promise<string> => {
    if (projectIdRef.current) return projectIdRef.current
    if (!onEnsureProject) {
      throw new Error('Save the project on Project & Stakeholders first so Blink can store this connection.')
    }
    const result = await onEnsureProject()
    projectIdRef.current = result.id
    if (result.created) {
      setOauthNotice('Created a draft project so this connection can be stored. You can rename it on Project & Stakeholders.')
    }
    return result.id
  }, [onEnsureProject])

  const active = state.integrations.find((item) => item.id === activeId) ?? null
  const jira = state.integrations.find((item) => item.id === 'jira')
  const confluence = state.integrations.find((item) => item.id === 'confluence')
  const guide = active ? GUIDES[active.id] : null

  const patchItem = useCallback(
    (id: string, updates: Partial<IntegrationItem>) => {
      onUpdate({
        integrations: state.integrations.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      })
    },
    [onUpdate, state.integrations],
  )

  useEffect(() => {
    if (!activeId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving && !oauthLoading) setActiveId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId, saving, oauthLoading])

  // Listen for Atlassian / GitHub OAuth popup callbacks
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_OAUTH_RESPONSE') {
        const { code, error: oauthErr } = event.data
        if (oauthErr) {
          setError(`GitHub authorization failed: ${oauthErr}`)
          setOauthLoading(false)
          return
        }
        if (code) {
          setOauthLoading(true)
          setError(null)
          try {
            const res = await exchangeGithubOAuth(
              code,
              oauthRedirectUriRef.current,
              projectIdRef.current,
              githubOrgRef.current || undefined,
            )
            const orgs = res.organizations || []
            setGithubOrgs(orgs)
            setForm((prev) => ({ ...prev, organization: res.organization || githubOrgRef.current || '' }))
            patchItem('github', {
              connected: true,
              account: res.account,
              detail: res.detail,
              baseUrl: res.baseUrl || 'https://github.com',
              organization: res.organization || githubOrgRef.current || undefined,
              authType: 'oauth',
              token: undefined,
              availableOrganizations: orgs,
            })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete GitHub OAuth.')
          } finally {
            setOauthLoading(false)
          }
        }
        return
      }
      if (event.data?.type === 'JIRA_OAUTH_RESPONSE') {
        const { code, error: oauthErr } = event.data
        if (oauthErr) {
          setError(`Atlassian authorization failed: ${oauthErr}`)
          setOauthLoading(false)
          return
        }
        if (code) {
          setOauthLoading(true)
          setError(null)
          try {
            const res = await exchangeJiraOAuth(code, oauthRedirectUriRef.current, projectIdRef.current)
            patchItem('jira', {
              connected: true,
              account: res.account,
              detail: res.detail,
              baseUrl: res.baseUrl,
              cloudId: res.cloudId,
              authType: 'oauth',
              token: undefined,
              projectKey: res.projectKey,
              projectName: res.projectName,
              availableProjects: res.projects,
            })
            setForm((prev) => ({
              ...prev,
              projectKey: res.projectKey || prev.projectKey,
              baseUrl: res.baseUrl || prev.baseUrl,
            }))
            setProjects(res.projects || [])
            setSelectedProjectName(res.projectName || '')
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete Atlassian OAuth.')
          } finally {
            setOauthLoading(false)
          }
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [patchItem])

  const connectedCount = useMemo(() => {
    return DISPLAY_CARDS.filter((card) =>
      card.openId === 'jira'
        ? Boolean(jira?.connected || confluence?.connected)
        : Boolean(state.integrations.find((item) => item.id === card.openId)?.connected),
    ).length
  }, [state.integrations, jira?.connected, confluence?.connected])

  const openConnect = (item: IntegrationItem) => {
    setError(null)
    setOauthNotice(null)
    setForm({
      ...formFromItem(item, jira),
      ...(item.id === 'jira'
        ? {
            spaceKey: confluence?.spaceKey || '',
            baseUrl: item.baseUrl || confluence?.baseUrl || '',
            email: item.email || confluence?.email || '',
          }
        : {}),
    })
    setActiveId(item.id)

    if (item.id === 'jira') {
      const existingProjects = item.availableProjects || []
      setProjects(existingProjects)
      const hasMatch = existingProjects.some((p) => p.key === item.projectKey)
      setIsCustomProjectKey(!hasMatch && Boolean(item.projectKey))
      setSelectedProjectName(item.projectName || '')

      if (item.connected && existingProjects.length === 0) {
        void fetchJiraProjects({
          projectId: state.projectId,
          baseUrl: item.baseUrl,
          email: item.email,
          cloudId: item.cloudId,
        })
          .then((list) => {
            if (list.length > 0) {
              setProjects(list)
              patchItem('jira', { availableProjects: list })
            }
          })
          .catch(() => {
            // ignore initial silent auto-refresh
          })
      }
    }

    if (item.id === 'github') {
      const existingOrgs = item.availableOrganizations || []
      setGithubOrgs(existingOrgs)
      if (item.connected && existingOrgs.length === 0 && state.projectId) {
        void fetchGithubOrgs({ projectId: state.projectId })
          .then((list) => {
            if (list.length > 0) {
              setGithubOrgs(list)
              patchItem('github', { availableOrganizations: list })
            }
          })
          .catch(() => {
            // ignore initial silent auto-refresh
          })
      }
    }
  }

  const disconnect = (id: string) => {
    const ids = id === 'jira' || id === 'confluence' ? ['jira', 'confluence'] : [id]
    onUpdate({
      integrations: state.integrations.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              connected: false,
              account: undefined,
              detail: undefined,
              token: undefined,
              cloudId: undefined,
              authType: undefined,
              projectKey: undefined,
              projectName: undefined,
              availableProjects: undefined,
              organization: undefined,
              availableOrganizations: undefined,
              spaceKey: undefined,
            }
          : item,
      ),
    })
    setActiveId(null)
  }

  const handleStartOAuth = async () => {
    setError(null)
    setOauthNotice(null)
    setOauthLoading(true)
    try {
      await requireStoredProject()
      const urlRes = await fetchJiraOAuthUrl()
      oauthRedirectUriRef.current = urlRes.redirectUri
      if (!urlRes.configured || !urlRes.url) {
        setOauthNotice(
          urlRes.message ||
            'Atlassian OAuth Client ID is not configured on the server. You can connect using an API token below.'
        )
        setOauthLoading(false)
        return
      }
      const width = 600
      const height = 720
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2)
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2)
      const popup = window.open(
        urlRes.url,
        'atlassian_oauth',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      )
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer)
          setOauthLoading(false)
        }
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initialize Atlassian OAuth.')
      setOauthLoading(false)
    }
  }

  const handleStartGithubOAuth = async () => {
    setError(null)
    setOauthNotice(null)
    setOauthLoading(true)
    try {
      await requireStoredProject()
      githubOrgRef.current = form.organization.trim()
      const urlRes = await fetchGithubOAuthUrl()
      oauthRedirectUriRef.current = urlRes.redirectUri
      if (!urlRes.configured || !urlRes.url) {
        setOauthNotice(
          urlRes.message ||
            'GitHub OAuth is not configured on the server. Set BLINK_GITHUB_CLIENT_ID and BLINK_GITHUB_CLIENT_SECRET.',
        )
        setOauthLoading(false)
        return
      }
      const width = 600
      const height = 720
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2)
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2)
      const popup = window.open(
        urlRes.url,
        'github_oauth',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`,
      )
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer)
          setOauthLoading(false)
        }
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not initialize GitHub OAuth.')
      setOauthLoading(false)
    }
  }

  const handleDiscoverProjects = async () => {
    if (!active) return
    const payload = {
      projectId: state.projectId || undefined,
      cloudId: active.cloudId,
      baseUrl: form.baseUrl.trim() || active.baseUrl,
      email: form.email.trim() || active.email,
      token: form.token.trim() || undefined,
    }

    if (!state.projectId && !payload.cloudId && (!payload.baseUrl || !payload.email || !payload.token)) {
      setError('Enter Cloud site URL, email, and API token to discover projects.')
      return
    }

    setDiscoveringProjects(true)
    setError(null)
    try {
      const list = await fetchJiraProjects(payload)
      setProjects(list)
      patchItem(active.id, { availableProjects: list })
      if (list.length > 0 && !form.projectKey) {
        setForm((prev) => ({ ...prev, projectKey: list[0].key }))
        setSelectedProjectName(list[0].name)
        if (active.connected) {
          patchItem(active.id, { projectKey: list[0].key, projectName: list[0].name })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch Jira projects.')
    } finally {
      setDiscoveringProjects(false)
    }
  }

  const handleProjectSelect = (val: string) => {
    if (val === '__custom__') {
      setIsCustomProjectKey(true)
    } else {
      setIsCustomProjectKey(false)
      const matched = projects.find((p) => p.key === val)
      setForm((prev) => ({ ...prev, projectKey: val }))
      setSelectedProjectName(matched?.name || '')
      if (active?.connected) {
        patchItem(active.id, { projectKey: val, projectName: matched?.name })
        if (state.projectId) {
          void saveIntegrationBinding({
            projectId: state.projectId,
            provider: active.id,
            projectKey: val,
            projectName: matched?.name,
          }).catch(() => {
            // selection is still kept in the wizard; reconnect if the server missed it
          })
        }
      }
    }
  }

  const handleDiscoverOrgs = async () => {
    if (!active || active.id !== 'github') return
    setDiscoveringOrgs(true)
    setError(null)
    try {
      const projectId = await requireStoredProject()
      const list = await fetchGithubOrgs({ projectId })
      setGithubOrgs(list)
      patchItem('github', { availableOrganizations: list })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch GitHub organizations.')
    } finally {
      setDiscoveringOrgs(false)
    }
  }

  const handleOrgSelect = (val: string) => {
    setForm((prev) => ({ ...prev, organization: val }))
    githubOrgRef.current = val
    if (!active?.connected) {
      return
    }
    patchItem('github', {
      organization: val || undefined,
      detail: val ? `Connected as ${active.account} to ${val}` : `Connected as ${active.account}`,
    })
    if (state.projectId) {
      void saveIntegrationBinding({
        projectId: state.projectId,
        provider: 'github',
        organization: val,
      }).catch(() => {
        // selection is still kept in the wizard; reconnect if the server missed it
      })
    }
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
    if (active.id === 'github' && !form.token.trim()) {
      setError('Paste a GitHub personal access token, or use Connect with GitHub.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const projectId = await requireStoredProject()
      if (active.connected && !form.token.trim() && (form.projectKey.trim() || form.spaceKey.trim())) {
        const result = await saveIntegrationBinding({
          projectId,
          provider: active.id,
          projectKey: form.projectKey.trim() || undefined,
          projectName: selectedProjectName || undefined,
          spaceKey: form.spaceKey.trim() || undefined,
        })
        patchItem(active.id, {
          projectKey: form.projectKey.trim() || result.projectKey,
          projectName: selectedProjectName || result.projectName,
          spaceKey: form.spaceKey.trim() || undefined,
          token: undefined,
        })
        setActiveId(null)
        return
      }
      const payload = {
        provider: active.id,
        projectId,
        token: form.token.trim(),
        username: form.username.trim() || undefined,
        email: form.email.trim() || undefined,
        organization: form.organization.trim() || undefined,
        workspace: form.workspace.trim() || undefined,
        baseUrl: form.baseUrl.trim() || undefined,
        projectKey: form.projectKey.trim() || undefined,
        spaceKey: form.spaceKey.trim() || undefined,
      }
      const result = await connectIntegration(payload)
      const projKey = form.projectKey.trim() || result.projectKey
      const projName = selectedProjectName || result.projectName
      const finalProjects = result.projects && result.projects.length > 0 ? result.projects : projects
      const orgs = result.organizations || []
      if (active.id === 'github' && orgs.length > 0) {
        setGithubOrgs(orgs)
      }
      patchItem(active.id, {
        connected: true,
        account: result.account,
        detail: result.detail,
        token: undefined,
        baseUrl: payload.baseUrl || result.baseUrl,
        organization: result.organization || payload.organization,
        workspace: payload.workspace,
        email: payload.email,
        username: payload.username,
        projectKey: projKey,
        projectName: projName,
        cloudId: result.cloudId,
        authType: (result.authType as 'oauth' | 'token') || 'token',
        spaceKey: payload.spaceKey,
        availableProjects: finalProjects,
        availableOrganizations: active.id === 'github' ? orgs : undefined,
      })
      if (active.id === 'jira' && payload.token && (payload.baseUrl || result.baseUrl) && payload.email) {
        try {
          const wiki = await connectIntegration({
            provider: 'confluence',
            projectId,
            baseUrl: payload.baseUrl || result.baseUrl,
            email: payload.email,
            token: payload.token,
            spaceKey: payload.spaceKey,
          })
          patchItem('confluence', {
            connected: true,
            account: wiki.account,
            detail: wiki.detail,
            baseUrl: payload.baseUrl || result.baseUrl,
            email: payload.email,
            spaceKey: payload.spaceKey,
            authType: 'token',
          })
        } catch {
          // Jira can succeed without Confluence; user can retry with a space key and token.
        }
      }
      setForm((prev) => ({ ...prev, token: '', organization: result.organization || prev.organization }))
      if (active.id !== 'github' && active.id !== 'jira') {
        setActiveId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not connect ${active.label}.`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Integrations</h2>
        <p>
          Sign in to GitHub to create repositories. Connect Atlassian for Jira tickets and Confluence docs. Blink
          creates epics and stories after you clear the requirement wording on the next step.
        </p>
      </div>

      {error && !active && <p className="connect-error integrations-page-error">{error}</p>}

      <div className="integrations-layout">
        <section className="card ref-card integrations-connect-panel">
          <div className="integrations-panel-head">
            <h3>Connected tools</h3>
            <span className="integrations-count">{connectedCount} of {DISPLAY_CARDS.length}</span>
          </div>
          <ol className="connect-howto">
            <li>Connect GitHub by signing in, or with a personal access token if the popup fails.</li>
            <li>Connect Atlassian for Jira issues and Confluence documentation, then pick the Jira project for tickets.</li>
            <li>Tickets are created after you answer the requirement questions on the next step.</li>
            <li>
              After you download the zip, put GitHub/Jira tokens in <code>automation_sdlc/.env.mcp</code>. Blink never
              writes credentials into the workspace kit.
            </li>
          </ol>
          <div className="integration-grid ref">
            {DISPLAY_CARDS.map((card) => {
              const providers = card.openId === 'jira' ? [jira, confluence] : [state.integrations.find((item) => item.id === card.openId)]
              const primary = card.openId === 'jira' ? jira : state.integrations.find((item) => item.id === card.openId)
              const connected = providers.some((item) => item?.connected)
              const status =
                card.openId === 'jira'
                  ? [
                      jira?.connected && jira.account
                        ? `${jira.account}${jira.projectKey ? ` • ${jira.projectKey}` : ''}`
                        : null,
                      confluence?.connected ? 'Confluence' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : primary?.connected && primary.account
                    ? `${primary.account}${primary.organization ? ` • ${primary.organization}` : ''}`
                    : ''
              return (
                <article
                  key={card.id}
                  className={`integration-card ref ${connected ? 'connected' : ''}`}
                  onClick={() => primary && openConnect(primary)}
                >
                  <IntegrationLogo id={card.id} label={card.label} />
                  <div className="int-body">
                    <strong>{card.label}</strong>
                    <span className="int-purpose">{connected && status ? status : card.purpose}</span>
                  </div>
                  {connected ? (
                    <div className="int-card-actions">
                      <span className="connected-label">✓ Connected</span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (primary) openConnect(primary)
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
                        if (primary) openConnect(primary)
                      }}
                    >
                      Connect
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </div>

      {active && guide && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!saving && !oauthLoading) setActiveId(null)
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
                  <IntegrationLogo id={active.id} label={active.id === 'jira' || active.id === 'confluence' ? 'Atlassian' : active.label} />{' '}
                  Connect {active.id === 'jira' || active.id === 'confluence' ? 'Atlassian' : active.label}
                </h3>
                <p>{purposeFor(active.id)}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                disabled={saving || oauthLoading}
                onClick={() => setActiveId(null)}
              >
                <X size={16} />
              </button>
            </header>

            {/* GitHub 1-Click OAuth */}
            {active.id === 'github' && !active.connected && (
              <div className="jira-oauth-card github-oauth-card">
                <div className="jira-oauth-header">
                  <span className="jira-badge github-badge">Recommended</span>
                  <strong>Sign in with GitHub</strong>
                </div>
                <p className="jira-oauth-desc">
                  Sign in with your GitHub account. If the popup fails, connect with a personal access token below.
                </p>
                <button
                  type="button"
                  className="oauth-btn github"
                  disabled={saving || oauthLoading}
                  onClick={() => void handleStartGithubOAuth()}
                >
                  <Sparkles size={14} />
                  {oauthLoading ? 'Connecting to GitHub…' : 'Connect with GitHub'}
                </button>
                {oauthNotice && <p className="oauth-notice">{oauthNotice}</p>}
              </div>
            )}

            {/* Jira 1-Click OAuth Option */}
            {active.id === 'jira' && !active.connected && (
              <div className="jira-oauth-card">
                <div className="jira-oauth-header">
                  <span className="jira-badge">Recommended</span>
                  <strong>1-Click Atlassian OAuth (3LO)</strong>
                </div>
                <p className="jira-oauth-desc">
                  Authorize Jira for tickets and the same Atlassian site for Confluence documentation.
                </p>
                <button
                  type="button"
                  className="oauth-btn"
                  disabled={saving || oauthLoading}
                  onClick={() => void handleStartOAuth()}
                >
                  <Sparkles size={14} />
                  {oauthLoading ? 'Connecting to Atlassian…' : 'Connect with Atlassian'}
                </button>
                {oauthNotice && <p className="oauth-notice">{oauthNotice}</p>}
              </div>
            )}

            {active.id === 'jira' && !active.connected && (
              <div className="connect-divider">
                <span>or connect with API token</span>
              </div>
            )}

            {active.id === 'github' && !active.connected && (
              <div className="connect-divider">
                <span>or connect with a personal access token</span>
              </div>
            )}

            <ol className="connect-steps">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a className="token-link" href={guide.tokenUrl} target="_blank" rel="noreferrer">
              Create {guide.tokenLabel.toLowerCase()} <ExternalLink size={14} />
            </a>

            <div className="connect-fields">
              {active.id === 'github' && active.connected && (
                <div className="field-group">
                  <div className="field-label-row">
                    <label htmlFor="gh-org-select">GitHub destination</label>
                    <button
                      type="button"
                      className="mini-btn"
                      disabled={discoveringOrgs}
                      onClick={() => void handleDiscoverOrgs()}
                    >
                      <RefreshCw size={11} className={discoveringOrgs ? 'spin' : ''} />
                      {discoveringOrgs ? 'Loading…' : 'Find organizations'}
                    </button>
                  </div>
                  <select
                    id="gh-org-select"
                    value={form.organization}
                    onChange={(e) => handleOrgSelect(e.target.value)}
                  >
                    <option value="">Personal account{active.account ? ` (${active.account})` : ''}</option>
                    {githubOrgs
                      .filter((org) => !org.personal)
                      .map((org) => (
                        <option key={org.login} value={org.login}>
                          {org.name && org.name !== org.login ? `${org.name} (${org.login})` : org.login}
                        </option>
                      ))}
                  </select>
                  <span className="field-hint">
                    {form.organization
                      ? `New repositories will be created in ${form.organization}.`
                      : 'New repositories will be created under your personal account.'}
                  </span>
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
                      <div className="field-label-row">
                        <label htmlFor="int-project-select">Jira Project</label>
                        {(active.connected || (form.baseUrl && form.email)) && (
                          <button
                            type="button"
                            className="mini-btn"
                            disabled={discoveringProjects}
                            onClick={() => void handleDiscoverProjects()}
                          >
                            <RefreshCw size={11} className={discoveringProjects ? 'spin' : ''} />
                            {discoveringProjects ? 'Loading…' : 'Find projects'}
                          </button>
                        )}
                      </div>

                      {projects.length > 0 && !isCustomProjectKey ? (
                        <>
                          <select
                            id="int-project-select"
                            value={form.projectKey}
                            onChange={(e) => handleProjectSelect(e.target.value)}
                          >
                            <option value="">-- Choose Jira Project --</option>
                            {projects.map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.name} ({p.key})
                              </option>
                            ))}
                            <option value="__custom__">Custom / Enter manually…</option>
                          </select>
                          {selectedProjectName && (
                            <span className="field-hint">
                              Selected: <strong>{selectedProjectName}</strong> ({form.projectKey})
                            </span>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            id="int-project"
                            value={form.projectKey}
                            onChange={(e) => setForm({ ...form, projectKey: e.target.value.toUpperCase() })}
                            placeholder="e.g. FIT, PROJ, ENG"
                            style={{ flex: 1 }}
                          />
                          {projects.length > 0 && (
                            <button
                              type="button"
                              className="text-btn mini-btn"
                              onClick={() => setIsCustomProjectKey(false)}
                            >
                              Show list
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {active.id === 'jira' && (
                    <div className="field-group atlassian-confluence-block">
                      <label htmlFor="int-space">Confluence space key (optional)</label>
                      <input
                        id="int-space"
                        value={form.spaceKey}
                        onChange={(e) => setForm({ ...form, spaceKey: e.target.value })}
                        placeholder="ENG"
                      />
                      <span className="field-hint">
                        {confluence?.connected
                          ? `Confluence connected${confluence.spaceKey ? ` • ${confluence.spaceKey}` : ''}.`
                          : 'Same Atlassian site as Jira. Paste an API token below to connect Confluence.'}
                      </span>
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
                  placeholder={
                    active.id === 'github'
                      ? active.connected
                        ? 'Paste a new PAT to reconnect without OAuth'
                        : 'Paste classic or fine-grained PAT'
                      : active.connected
                        ? 'Enter a new token to reconnect'
                        : 'Paste token'
                  }
                />
              </div>
            </div>

            {error && <p className="connect-error">{error}</p>}

            <footer className="connect-modal-actions">
              {active.connected && (
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={saving || oauthLoading}
                  onClick={() => disconnect(active.id)}
                >
                  Disconnect
                </button>
              )}
              <div className="action-spacer" />
              <button
                type="button"
                className="secondary-btn"
                disabled={saving || oauthLoading}
                onClick={() => setActiveId(null)}
              >
                Cancel
              </button>
              {(active.id !== 'github' || form.token.trim()) && (
                <button
                  type="button"
                  className="primary-btn"
                  disabled={
                    saving ||
                    oauthLoading ||
                    (!form.token.trim() && !(active.connected && (form.projectKey.trim() || form.spaceKey.trim())))
                  }
                  onClick={() => void handleConnect()}
                >
                  {saving
                    ? 'Verifying…'
                    : active.connected && !form.token.trim()
                      ? 'Save'
                      : active.id === 'github'
                        ? 'Connect with token'
                        : 'Connect'}
                </button>
              )}
              {active.id === 'github' && active.connected && (
                <button
                  type="button"
                  className="oauth-btn github"
                  disabled={saving || oauthLoading}
                  onClick={() => void handleStartGithubOAuth()}
                >
                  {oauthLoading ? 'Reconnecting…' : 'Reconnect with GitHub'}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
