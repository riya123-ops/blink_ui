import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { CheckCircle2, ExternalLink, Layers, Loader2, RefreshCw, Sparkles, Ticket, X } from 'lucide-react'
import {
  connectIntegration,
  createJiraIssues,
  exchangeJiraOAuth,
  fetchJiraOAuthUrl,
  fetchJiraProjects,
  planProductScope,
  saveIntegrationBinding,
  type JiraProjectItem,
} from '../api/blink'
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
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthNotice, setOauthNotice] = useState<string | null>(null)
  const [projects, setProjects] = useState<JiraProjectItem[]>([])
  const [discoveringProjects, setDiscoveringProjects] = useState(false)
  const [isCustomProjectKey, setIsCustomProjectKey] = useState(false)
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const oauthRedirectUriRef = useRef<string | undefined>(undefined)
  const [planningScope, setPlanningScope] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [creatingIssues, setCreatingIssues] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const plannedOnce = useRef(false)

  const active = state.integrations.find((item) => item.id === activeId) ?? null
  const jira = state.integrations.find((item) => item.id === 'jira')
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

  // Listen for Atlassian OAuth popup callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
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
            const res = await exchangeJiraOAuth(code, oauthRedirectUriRef.current, state.projectId)
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
            setActiveId(null)
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
  }, [patchItem, state.projectId])

  const connectedCount = useMemo(
    () => state.integrations.filter((item) => item.connected).length,
    [state.integrations],
  )

  const openConnect = (item: IntegrationItem) => {
    setError(null)
    setOauthNotice(null)
    setForm(formFromItem(item, jira))
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
  }

  const disconnect = (id: string) => {
    patchItem(id, {
      connected: false,
      account: undefined,
      detail: undefined,
      token: undefined,
      cloudId: undefined,
      authType: undefined,
      projectKey: undefined,
      projectName: undefined,
      availableProjects: undefined,
    })
    setActiveId(null)
  }

  const handleStartOAuth = async () => {
    setError(null)
    setOauthNotice(null)
    if (!state.projectId) {
      setError('Save the project on Project & Stakeholders first so Blink can store this connection.')
      return
    }
    setOauthLoading(true)
    try {
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

  const handleConnect = async () => {
    if (!active) return
    if (!state.projectId) {
      setError('Save the project on Project & Stakeholders first so Blink can store this connection.')
      return
    }
    if ((active.id === 'jira' || active.id === 'confluence') && (!form.baseUrl.trim() || !form.email.trim())) {
      setError('Cloud site URL and Atlassian email are required.')
      return
    }
    if (active.id === 'bitbucket' && (!form.workspace.trim() || !form.username.trim())) {
      setError('Workspace and username are required.')
      return
    }
    if (active.connected && !form.token.trim() && (form.projectKey.trim() || form.spaceKey.trim())) {
      setSaving(true)
      setError(null)
      try {
        const result = await saveIntegrationBinding({
          projectId: state.projectId,
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
      } catch (err) {
        setError(err instanceof Error ? err.message : `Could not save ${active.label} selection.`)
      } finally {
        setSaving(false)
      }
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      provider: active.id,
      projectId: state.projectId,
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
      const projKey = form.projectKey.trim() || result.projectKey
      const projName = selectedProjectName || result.projectName
      const finalProjects = result.projects && result.projects.length > 0 ? result.projects : projects
      patchItem(active.id, {
        connected: true,
        account: result.account,
        detail: result.detail,
        token: undefined,
        baseUrl: payload.baseUrl || result.baseUrl,
        organization: payload.organization,
        workspace: payload.workspace,
        email: payload.email,
        username: payload.username,
        projectKey: projKey,
        projectName: projName,
        cloudId: result.cloudId,
        authType: (result.authType as 'oauth' | 'token') || 'token',
        spaceKey: payload.spaceKey,
        availableProjects: finalProjects,
      })
      setActiveId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not connect ${active.label}.`)
    } finally {
      setSaving(false)
    }
  }

  const requirementText = (state.groomDraft || state.requirementsText || '').trim()
  const scopeSource = requirementText || state.description.trim()
  const epics = state.productScope?.epics || []
  const stories = state.productScope?.stories || []
  const createdBySource = useMemo(() => {
    const map = new Map<string, NonNullable<WizardState['jiraCreatedIssues']>[number]>()
    for (const item of state.jiraCreatedIssues || []) {
      if (item.sourceId) map.set(item.sourceId, item)
    }
    return map
  }, [state.jiraCreatedIssues])

  const runProductScope = useCallback(async () => {
    if (!scopeSource) {
      setScopeError('Add a project description on Project & Stakeholders so Blink can propose epics and stories.')
      return
    }
    setPlanningScope(true)
    setScopeError(null)
    try {
      const scopeRes = await planProductScope(state.projectId, {
        projectName: state.projectName,
        requirementText: scopeSource,
        actor: 'operator',
      })
      if (scopeRes?.status === 'ok' && scopeRes.productScope) {
        onUpdate({
          productScope: scopeRes.productScope,
          scopeDigest: scopeRes.proposalDigest,
          nextSdlcCommand: scopeRes.nextCommand || '/confirm-product-scope',
        })
      } else {
        setScopeError(scopeRes?.message || 'Product scope planning did not return epics yet.')
      }
    } catch (err) {
      setScopeError(err instanceof Error ? err.message : 'Could not plan product scope.')
    } finally {
      setPlanningScope(false)
    }
  }, [onUpdate, scopeSource, state.projectId, state.projectName])

  useEffect(() => {
    if (plannedOnce.current) return
    if (!scopeSource) return
    plannedOnce.current = true
    if (!state.productScope?.epics?.length) {
      void runProductScope()
    }
  }, [scopeSource, runProductScope, state.productScope?.epics?.length])

  const handleCreateInJira = async () => {
    if (!jira?.connected) {
      setCreateError('Connect Jira first, then create the epics and stories.')
      return
    }
    if (!state.projectId) {
      setCreateError('Save the project on Project & Stakeholders first so Blink can use the stored Jira connection.')
      return
    }
    if (!jira.projectKey) {
      setCreateError('Choose a Jira project in Connect Jira before creating issues.')
      openConnect(jira)
      return
    }
    if (epics.length === 0 && stories.length === 0) {
      setCreateError('Plan product scope first so there is something to create.')
      return
    }
    setCreatingIssues(true)
    setCreateError(null)
    try {
      const result = await createJiraIssues({
        projectId: state.projectId,
        projectKey: jira.projectKey,
        epics: epics.map((epic) => ({
          id: epic.id,
          title: epic.title,
          objective: epic.objective,
          storyIds: epic.storyIds,
        })),
        stories: stories.map((story) => ({
          id: story.id,
          epicId:
            story.epicId
            || epics.find((epic) => epic.storyIds?.includes(story.id))?.id,
          title: story.title,
          objective: story.objective,
          asA: story.asA,
          iWant: story.iWant,
          soThat: story.soThat,
          acceptanceCriteria: story.acceptanceCriteria,
        })),
      })
      onUpdate({ jiraCreatedIssues: result.issues || [] })
      if (result.status === 'error') {
        setCreateError(result.message || 'Jira did not create the issues.')
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create Jira issues.')
    } finally {
      setCreatingIssues(false)
    }
  }

  const createdOk = (state.jiraCreatedIssues || []).filter((item) => item.status === 'created').length
  const jiraReady = Boolean(jira?.connected && jira.projectKey)
  const canCreate = jiraReady && (epics.length > 0 || stories.length > 0) && !creatingIssues && !planningScope

  return (
    <div className="screen screen-ref">
      <div className="screen-header">
        <h2>Integrations</h2>
        <p>
          Connect your toolchain, then review the backlog Blink proposed from the project details. Create those epics
          and stories in Jira when you are ready.
        </p>
      </div>

      {error && !active && <p className="connect-error integrations-page-error">{error}</p>}

      <div className="integrations-layout">
        <section className="card ref-card integrations-connect-panel">
          <div className="integrations-panel-head">
            <h3>Connected tools</h3>
            <span className="integrations-count">{connectedCount} of 4</span>
          </div>
          <ol className="connect-howto">
            <li>Connect Jira with one-click Atlassian OAuth (or an API token).</li>
            <li>Pick the Jira project that should receive epics and stories.</li>
            <li>Credentials are stored encrypted on the Blink server. They are never written into the workspace kit.</li>
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
                    {item.connected && item.account
                      ? `${item.account}${item.projectKey ? ` • ${item.projectKey}` : ''}`
                      : item.category}
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
        </section>

        <section className="card ref-card jira-scope-panel">
          <div className="jira-scope-head">
            <div>
              <p className="jira-scope-kicker">Product scope agent</p>
              <h3>Epics & stories for Jira</h3>
              <p>
                Blink classifies the project details and proposes epics and stories from that source. It does not invent
                extra tickets. Nothing is created until you click the button.
              </p>
            </div>
            <button
              type="button"
              className="mini-btn"
              disabled={planningScope || !scopeSource}
              onClick={() => void runProductScope()}
            >
              {planningScope ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
              {planningScope ? 'Planning…' : 'Run planner'}
            </button>
          </div>

          <div className="jira-scope-metrics">
            <span className="jira-chip epic">{epics.length} epic{epics.length === 1 ? '' : 's'}</span>
            <span className="jira-chip story">{stories.length} stor{stories.length === 1 ? 'y' : 'ies'}</span>
            {jiraReady ? (
              <span className="jira-chip project">Target {jira?.projectKey}</span>
            ) : (
              <span className="jira-chip muted">Jira project not selected</span>
            )}
          </div>

          {planningScope && (
            <div className="jira-scope-empty">
              <Loader2 size={22} className="spin" />
              <p>Planning product scope from your project details…</p>
            </div>
          )}

          {!planningScope && !scopeSource && (
            <div className="jira-scope-empty">
              <Layers size={22} />
              <p>Add a project description on Project & Stakeholders. This panel will propose the Jira backlog from those details.</p>
            </div>
          )}

          {!planningScope && scopeSource && epics.length === 0 && (
            <div className="jira-scope-empty">
              <Layers size={22} />
              <p>{scopeError || 'No epics yet. Run the product scope planner to generate them.'}</p>
            </div>
          )}

          {scopeError && epics.length > 0 && <p className="connect-error">{scopeError}</p>}

          {epics.length > 0 && (
            <div className="jira-epic-list">
              {epics.map((epic) => {
                const childStories = stories.filter((story) => story.epicId === epic.id || epic.storyIds?.includes(story.id))
                const epicCreated = createdBySource.get(epic.id)
                return (
                  <article key={epic.id} className="jira-epic-card">
                    <header>
                      <span className="jira-type epic">Epic</span>
                      <strong>{epic.title}</strong>
                      {epicCreated?.jiraKey ? (
                        <a className="jira-key-link" href={epicCreated.jiraUrl || '#'} target="_blank" rel="noreferrer">
                          {epicCreated.jiraKey} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <code>{epic.id}</code>
                      )}
                    </header>
                    {epic.objective && <p>{epic.objective}</p>}
                    {childStories.length > 0 && (
                      <ul>
                        {childStories.map((story) => {
                          const storyCreated = createdBySource.get(story.id)
                          return (
                            <li key={story.id}>
                              <span className="jira-type story">Story</span>
                              <span className="jira-story-title">{story.title}</span>
                              {storyCreated?.jiraKey ? (
                                <a className="jira-key-link" href={storyCreated.jiraUrl || '#'} target="_blank" rel="noreferrer">
                                  {storyCreated.jiraKey}
                                </a>
                              ) : (
                                <code>{story.id}</code>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {createError && <p className="connect-error">{createError}</p>}

          <div className="jira-scope-actions">
            <button type="button" className="jira-create-btn" disabled={!canCreate} onClick={() => void handleCreateInJira()}>
              {creatingIssues ? <Loader2 size={16} className="spin" /> : <Ticket size={16} />}
              {creatingIssues
                ? 'Creating in Jira…'
                : `Create ${epics.length + stories.length || ''} item${epics.length + stories.length === 1 ? '' : 's'} in Jira`}
            </button>
            {createdOk > 0 && (
              <span className="jira-created-note">
                <CheckCircle2 size={14} /> {createdOk} created in {jira?.projectKey}
              </span>
            )}
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
                  <span className="int-icon">{active.icon}</span> Connect {active.label}
                </h3>
                <p>{active.category}</p>
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

            {/* Jira 1-Click OAuth Option */}
            {active.id === 'jira' && !active.connected && (
              <div className="jira-oauth-card">
                <div className="jira-oauth-header">
                  <span className="jira-badge">Recommended</span>
                  <strong>1-Click Atlassian OAuth (3LO)</strong>
                </div>
                <p className="jira-oauth-desc">
                  Connect directly with your Atlassian account in one click. No tokens or URLs needed.
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
                  placeholder={active.connected ? 'Enter a new token to reconnect' : 'Paste token'}
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
                {saving ? 'Verifying…' : active.connected && !form.token.trim() ? 'Save' : 'Connect'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
