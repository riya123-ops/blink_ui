import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Layers, Loader2, RefreshCw, Ticket } from 'lucide-react'
import type { JiraCreatedIssue, WizardState } from '../wizard/types'
import {
  beginJiraCreate,
  createJiraIssuesFromState,
  endJiraCreate,
  isJiraReady,
  jiraConnection,
  markTicketsPipelineBusy,
  mergeJiraCreatedIssues,
  pendingJiraTicketCount,
  planScopeFromWording,
} from '../wizard/jiraTickets'
import { shouldAutoCreateJira, shouldAutoStartTickets, type JiraPublishState } from '../wizard/thinking'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  sourceText: string
  jiraPublish?: JiraPublishState | null
}

function jiraBrowseUrl(
  item: { jiraUrl?: string | null; url?: string | null; jiraKey?: string | null },
  baseUrl?: string | null,
): string | null {
  const direct = item.jiraUrl || item.url
  if (direct) return direct
  if (item.jiraKey && baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}/browse/${item.jiraKey}`
  }
  return null
}

function TicketBadge({
  created,
  baseUrl,
}: {
  created?: JiraCreatedIssue
  baseUrl?: string | null
}) {
  if (!created) return null

  if (created.status === 'creating') {
    return <span className="jira-ticket-badge jira-ticket-badge--pending">Creating…</span>
  }

  if (created.status === 'created' && created.jiraKey) {
    const href = jiraBrowseUrl(created, baseUrl)
    if (!href) {
      return <span className="jira-ticket-badge jira-ticket-badge--plain">{created.jiraKey}</span>
    }
    return (
      <a
        className="jira-ticket-badge"
        href={href}
        target="_blank"
        rel="noreferrer"
        title={`Open ${created.jiraKey} in Jira`}
        onClick={(e) => e.stopPropagation()}
      >
        <span>{created.jiraKey}</span>
        <ExternalLink size={11} aria-hidden />
      </a>
    )
  }

  if (created.status === 'failed') {
    return (
      <span className="jira-ticket-badge jira-ticket-badge--failed" title={created.message || 'Create failed'}>
        Failed
      </span>
    )
  }

  return null
}

export function JiraPublishStatus({
  publish,
  jiraReady,
  pendingCount,
  projectKey,
}: {
  publish?: JiraPublishState | null
  jiraReady: boolean
  pendingCount: number
  projectKey?: string
}) {
  if (publish?.active) {
    return (
      <div className="jira-publish-status is-active" role="status">
        <Loader2 size={14} className="spin" />
        <span>
          Creating in Jira — {publish.linked} of {publish.total} linked
          {projectKey ? ` in ${projectKey}` : ''}
        </span>
      </div>
    )
  }
  if (!jiraReady && pendingCount > 0) {
    return (
      <div className="jira-publish-status" role="status">
        <span>
          {pendingCount} draft ticket{pendingCount === 1 ? '' : 's'} ready. Connect Atlassian and pick a Jira project —
          Blink will create them and show progress here.
        </span>
      </div>
    )
  }
  if (publish?.message && !publish.active) {
    return (
      <div className={`jira-publish-status${publish.failed ? ' is-error' : ' is-done'}`} role="status">
        {publish.failed ? null : <CheckCircle2 size={14} />}
        <span>{publish.message}</span>
      </div>
    )
  }
  return null
}

export function JiraScopePanel({ state, onUpdate, sourceText, jiraPublish = null }: Props) {
  const [planningScope, setPlanningScope] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [creatingIssues, setCreatingIssues] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const planInFlight = useRef(false)

  const jira = jiraConnection(state)
  const epics = state.productScope?.epics || []
  const stories = state.productScope?.stories || []
  const jiraReady = isJiraReady(state)
  const createdOk = (state.jiraCreatedIssues || []).filter((item) => item.status === 'created').length
  const pendingCount = pendingJiraTicketCount(state)
  const wording = sourceText.trim()
  const autoPlan = shouldAutoStartTickets({
    hasWording: Boolean(wording),
    epicCount: epics.length,
    failed: Boolean(scopeError),
  })
  const autoCreate = shouldAutoCreateJira({
    jiraReady,
    pendingCount,
    failed: Boolean(createError),
    failedMessage: createError,
  })
  const ticketsBusy = planningScope || creatingIssues || autoPlan || Boolean(jiraPublish?.active)

  const createdBySource = useMemo(() => {
    const map = new Map<string, JiraCreatedIssue>()
    for (const item of state.jiraCreatedIssues || []) {
      if (item.sourceId) map.set(item.sourceId, item)
    }
    return map
  }, [state.jiraCreatedIssues])

  const runProductScope = useCallback(async () => {
    if (planInFlight.current) return
    if (!wording) {
      setScopeError('Clear the requirement wording first so Blink can propose epics and stories.')
      return
    }
    planInFlight.current = true
    setPlanningScope(true)
    setScopeError(null)
    markTicketsPipelineBusy(true)
    try {
      const patch = await planScopeFromWording(state, wording)
      onUpdate(patch)
    } catch (err) {
      setScopeError(err instanceof Error ? err.message : 'Could not plan product scope.')
    } finally {
      planInFlight.current = false
      setPlanningScope(false)
      if (!isJiraReady(state)) markTicketsPipelineBusy(false)
    }
  }, [onUpdate, state, wording])

  const handleCreateInJira = useCallback(async () => {
    if (!beginJiraCreate()) return
    if (!isJiraReady(state)) {
      endJiraCreate()
      setCreateError('Connect Atlassian and choose a Jira project on Integrations first.')
      return
    }
    if (epics.length === 0 && stories.length === 0) {
      endJiraCreate()
      setCreateError('Plan product scope first so there is something to create.')
      return
    }
    setCreatingIssues(true)
    setCreateError(null)
    const placeholders = [...epics, ...stories]
      .filter((item) => item.id && createdBySource.get(item.id)?.status !== 'created')
      .map((item) => ({ sourceId: item.id, status: 'creating' }))
    if (placeholders.length) {
      onUpdate({ jiraCreatedIssues: mergeJiraCreatedIssues(state.jiraCreatedIssues, placeholders) })
    }
    try {
      const result = await createJiraIssuesFromState(state, {
        pendingOnly: true,
        onStart: () => undefined,
        onItem: (issue) => {
          onUpdate({
            jiraCreatedIssues: mergeJiraCreatedIssues(state.jiraCreatedIssues, [issue, ...placeholders]),
          })
        },
      })
      onUpdate({ jiraCreatedIssues: mergeJiraCreatedIssues(state.jiraCreatedIssues, result.issues) })
      if (result.status === 'error') {
        setCreateError(result.message || 'Jira did not create the issues.')
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create Jira issues.')
    } finally {
      setCreatingIssues(false)
      endJiraCreate()
    }
  }, [createdBySource, epics, onUpdate, state, stories])

  useEffect(() => {
    if (jiraReady && createError && /connect atlassian/i.test(createError)) {
      setCreateError(null)
    }
  }, [createError, jiraReady])

  useEffect(() => {
    if (!autoPlan || planningScope || planInFlight.current) return
    void runProductScope()
  }, [autoPlan, planningScope, runProductScope])

  useEffect(() => {
    if (!autoCreate || creatingIssues || planningScope || jiraPublish?.active) return
    void handleCreateInJira()
  }, [autoCreate, creatingIssues, planningScope, jiraPublish?.active, handleCreateInJira])

  const canCreate = jiraReady && pendingCount > 0 && !creatingIssues && !planningScope && !jiraPublish?.active
  const itemCount = epics.length + stories.length
  const alreadyCreated = createdOk > 0

  return (
    <section className="card ref-card jira-scope-panel">
      <div className="jira-scope-head">
        <div>
          <p className="jira-scope-kicker">Product scope</p>
          <h3>Epics & stories for Jira</h3>
          <p>
            Blink proposes these tickets from your cleared requirement and starts as soon as you open Tickets. If you
            connect Atlassian later, create progress is shown here and on Integrations.
          </p>
        </div>
        <button
          type="button"
          className="mini-btn"
          disabled={planningScope || !wording}
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
        {pendingCount > 0 ? (
          <span className="jira-chip muted">{pendingCount} not in Jira yet</span>
        ) : null}
      </div>

      {planningScope || autoPlan ? <p className="muted">Planning epics and stories…</p> : null}

      <JiraPublishStatus
        publish={
          jiraPublish ||
          (creatingIssues
            ? {
                active: true,
                total: Math.max(pendingCount, createdOk),
                linked: createdOk,
                failed: 0,
                message: `Creating ${pendingCount} ticket(s) in Jira…`,
              }
            : null)
        }
        jiraReady={jiraReady}
        pendingCount={pendingCount}
        projectKey={jira?.projectKey}
      />

      {!ticketsBusy && !wording && (
        <div className="jira-scope-empty">
          <Layers size={22} />
          <p>Save the requirement wording first. This panel then proposes the Jira backlog from that text.</p>
        </div>
      )}

      {!ticketsBusy && wording && epics.length === 0 && (
        <div className="jira-scope-empty">
          <Layers size={22} />
          <p>{scopeError || 'No epics yet. Retry the planner if this stays empty.'}</p>
        </div>
      )}

      {scopeError && epics.length > 0 && <p className="connect-error">{scopeError}</p>}

      {epics.length > 0 && (
        <div className="jira-epic-list">
          {epics.map((epic) => {
            const childStories = stories.filter((story) => story.epicId === epic.id || epic.storyIds?.includes(story.id))
            const epicCreated = createdBySource.get(epic.id)
            return (
              <article
                key={epic.id}
                className={`jira-epic-card${epicCreated?.status === 'created' ? ' is-linked' : ''}`}
              >
                <header className="jira-row">
                  <span className="jira-type epic">Epic</span>
                  <strong className="jira-row-title">{epic.title}</strong>
                  <TicketBadge created={epicCreated} baseUrl={jira?.baseUrl} />
                </header>
                {epic.objective && <p>{epic.objective}</p>}
                {childStories.length > 0 && (
                  <ul>
                    {childStories.map((story) => {
                      const storyCreated = createdBySource.get(story.id)
                      return (
                        <li
                          key={story.id}
                          className={`jira-row${storyCreated?.status === 'created' ? ' is-linked' : ''}`}
                        >
                          <span className="jira-type story">Story</span>
                          <span className="jira-row-title">{story.title}</span>
                          <TicketBadge created={storyCreated} baseUrl={jira?.baseUrl} />
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

      {!autoCreate && (alreadyCreated || (epics.length > 0 && !ticketsBusy)) ? (
        <div className="jira-scope-actions">
          <button type="button" className="jira-create-btn" disabled={!canCreate} onClick={() => void handleCreateInJira()}>
            {creatingIssues || jiraPublish?.active ? <Loader2 size={16} className="spin" /> : <Ticket size={16} />}
            {creatingIssues || jiraPublish?.active
              ? 'Creating in Jira…'
              : alreadyCreated
                ? pendingCount > 0
                  ? `Create remaining ${pendingCount}`
                  : `Recreate / sync ${itemCount || ''} item${itemCount === 1 ? '' : 's'}`
                : `Create ${itemCount || ''} item${itemCount === 1 ? '' : 's'} in Jira`}
          </button>
          {createdOk > 0 && (
            <span className="jira-created-note">
              <CheckCircle2 size={14} /> {createdOk} linked in {jira?.projectKey}
            </span>
          )}
        </div>
      ) : createdOk > 0 ? (
        <div className="jira-scope-actions">
          <span className="jira-created-note">
            <CheckCircle2 size={14} /> {createdOk} linked in {jira?.projectKey}
          </span>
        </div>
      ) : null}
    </section>
  )
}
