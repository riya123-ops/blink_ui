import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, ExternalLink, Layers, Loader2, RefreshCw, Ticket, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { deleteJiraIssues } from '../api/blink'
import type { JiraCreatedIssue, WizardState } from '../wizard/types'
import {
  beginJiraCreate,
  createdTicketsOnScreen,
  createJiraIssuesFromState,
  dropJiraCreatedIssues,
  endJiraCreate,
  idsForEpicRemoval,
  isJiraReady,
  jiraConnection,
  jiraKeysCreatedOnScreen,
  markTicketsPipelineBusy,
  mergeJiraCreatedIssues,
  pendingJiraTicketCount,
  planScopeFromWording,
  removePlannedTickets,
} from '../wizard/jiraTickets'
import { shouldAutoStartTickets, type JiraPublishState } from '../wizard/thinking'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  sourceText: string
  jiraPublish?: JiraPublishState | null
}

type PendingDelete =
  | { kind: 'item'; itemKind: 'epic' | 'story'; sourceId: string }
  | { kind: 'all' }

function deleteDialogCopy(
  pending: PendingDelete,
  createdBySource: Map<string, JiraCreatedIssue>,
  ticketCount: number,
): { title: string; copy: string; confirmLabel: string } {
  if (pending.kind === 'all') {
    return {
      title: 'Delete tickets?',
      copy: `Delete ${ticketCount} ticket${ticketCount === 1 ? '' : 's'} created on this screen from Jira? Other Jira issues are not deleted.`,
      confirmLabel: 'Delete',
    }
  }
  const created = createdBySource.get(pending.sourceId)
  const inJira = created?.status === 'created' && created.jiraKey
  if (pending.itemKind === 'epic') {
    if (inJira) {
      return {
        title: 'Delete epic?',
        copy: `Delete ${created.jiraKey} and its stories from this screen in Jira? Other Jira issues are not deleted.`,
        confirmLabel: 'Delete',
      }
    }
    return {
      title: 'Remove epic?',
      copy: 'Remove this epic and its stories from the plan? They will not be created in Jira.',
      confirmLabel: 'Remove',
    }
  }
  if (inJira) {
    return {
      title: 'Delete story?',
      copy: `Delete ${created.jiraKey} from Jira? Other Jira issues are not deleted.`,
      confirmLabel: 'Delete',
    }
  }
  return {
    title: 'Remove story?',
    copy: 'Remove this story from the plan? It will not be created in Jira.',
    confirmLabel: 'Remove',
  }
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
          {pendingCount} draft ticket{pendingCount === 1 ? '' : 's'} ready. Connect Atlassian, pick a Jira project,
          then click Create in Jira.
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [expandedEpicIds, setExpandedEpicIds] = useState<string[]>([])

  const planInFlight = useRef(false)

  const jira = jiraConnection(state)
  const epics = state.productScope?.epics || []
  const stories = state.productScope?.stories || []
  const jiraReady = isJiraReady(state)
  const createdOnScreen = createdTicketsOnScreen(state)
  const createdOk = createdOnScreen.length
  const pendingCount = pendingJiraTicketCount(state)
  const wording = sourceText.trim()
  const autoPlan = shouldAutoStartTickets({
    hasWording: Boolean(wording),
    epicCount: epics.length,
    failed: Boolean(scopeError),
  })
  const ticketsBusy = planningScope || creatingIssues || autoPlan || Boolean(jiraPublish?.active)
  const deleteBusy = deletingId !== null

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

  const applyLocalRemoval = useCallback(
    (sourceIds: string[], opts?: { keepOrphanStories?: boolean }) => {
      const nextScope = removePlannedTickets(state.productScope, sourceIds, opts)
      onUpdate({
        productScope: nextScope,
        jiraCreatedIssues: dropJiraCreatedIssues(state.jiraCreatedIssues, sourceIds),
      })
    },
    [onUpdate, state.jiraCreatedIssues, state.productScope],
  )

  const runDeleteItem = useCallback(
    async (kind: 'epic' | 'story', sourceId: string) => {
      const sourceIds = kind === 'epic' ? idsForEpicRemoval(state.productScope, sourceId) : [sourceId]
      const createdKeys = sourceIds
        .map((id) => createdBySource.get(id))
        .filter((item) => item?.status === 'created' && item.jiraKey)
        .map((item) => item!.jiraKey as string)
      const label = kind === 'epic' ? 'epic' : 'story'
      setDeletingId(sourceId)
      setCreateError(null)
      try {
        if (createdKeys.length > 0 && state.projectId) {
          const result = await deleteJiraIssues({ projectId: state.projectId, issueKeys: createdKeys })
          if ((result.deleted || 0) === 0 && (result.errors || []).length > 0) {
            throw new Error(result.errors.join(' '))
          }
          if ((result.errors || []).length > 0) {
            setCreateError(result.errors.join(' '))
          }
        }
        applyLocalRemoval(sourceIds)
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : `Could not delete the ${label}.`)
      } finally {
        setDeletingId(null)
      }
    },
    [applyLocalRemoval, createdBySource, state.productScope, state.projectId],
  )

  const runDeleteAllInJira = useCallback(async () => {
    const linked = createdTicketsOnScreen(state)
    const issueKeys = jiraKeysCreatedOnScreen(state)
    if (linked.length === 0 || issueKeys.length === 0 || !state.projectId) return
    setDeletingId('*')
    setCreateError(null)
    try {
      const result = await deleteJiraIssues({
        projectId: state.projectId,
        issueKeys,
      })
      if ((result.deleted || 0) === 0 && (result.errors || []).length > 0) {
        throw new Error(result.errors.join(' '))
      }
      applyLocalRemoval(
        linked.map((item) => item.sourceId).filter((id): id is string => Boolean(id)),
        { keepOrphanStories: true },
      )
      if ((result.errors || []).length > 0) {
        setCreateError(result.errors.join(' '))
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not delete Jira tickets.')
    } finally {
      setDeletingId(null)
    }
  }, [applyLocalRemoval, state])

  const confirmPendingDelete = useCallback(() => {
    const pending = pendingDelete
    setPendingDelete(null)
    if (!pending) return
    if (pending.kind === 'all') {
      void runDeleteAllInJira()
      return
    }
    void runDeleteItem(pending.itemKind, pending.sourceId)
  }, [pendingDelete, runDeleteAllInJira, runDeleteItem])

  const toggleEpic = useCallback((epicId: string) => {
    setExpandedEpicIds((ids) => (ids.includes(epicId) ? ids.filter((id) => id !== epicId) : [...ids, epicId]))
  }, [])

  useEffect(() => {
    if (jiraReady && createError && /connect atlassian/i.test(createError)) {
      setCreateError(null)
    }
  }, [createError, jiraReady])

  useEffect(() => {
    if (!autoPlan || planningScope || planInFlight.current) return
    void runProductScope()
  }, [autoPlan, planningScope, runProductScope])

  const canCreate = jiraReady && pendingCount > 0 && !creatingIssues && !planningScope && !jiraPublish?.active && !deleteBusy
  const itemCount = epics.length + stories.length
  const alreadyCreated = createdOk > 0
  const pendingCopy = pendingDelete
    ? deleteDialogCopy(pendingDelete, createdBySource, createdOk)
    : null

  return (
    <>
    <section className="card ref-card jira-scope-panel">
      <div className="jira-scope-head">
        <div className="req-section-head">
          <h3>Epics for Jira</h3>
          <p>Open an epic to review its stories, then create in Jira when you are ready.</p>
        </div>
        <button
          type="button"
          className="text-btn"
          disabled={planningScope || !wording || deleteBusy}
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
            const canExpand = childStories.length > 0 || Boolean(epic.objective)
            const open = canExpand && expandedEpicIds.includes(epic.id)
            const storyLabel = `${childStories.length} ${childStories.length === 1 ? 'story' : 'stories'}`
            return (
              <article
                key={epic.id}
                className={`jira-epic-card${epicCreated?.status === 'created' ? ' is-linked' : ''}${open ? ' is-open' : ''}`}
              >
                <header className="jira-row">
                  {canExpand ? (
                    <button
                      type="button"
                      className="jira-epic-toggle"
                      aria-expanded={open}
                      aria-label={open ? `Hide stories for ${epic.title}` : `Show stories for ${epic.title}`}
                      onClick={() => toggleEpic(epic.id)}
                    >
                      <ChevronRight size={16} className={open ? 'chevron open' : 'chevron'} aria-hidden />
                      <span className="jira-type epic">Epic</span>
                      <strong className="jira-row-title">{epic.title}</strong>
                      {childStories.length > 0 ? <span className="jira-story-count">{storyLabel}</span> : null}
                    </button>
                  ) : (
                    <div className="jira-epic-toggle is-static">
                      <span className="jira-type epic">Epic</span>
                      <strong className="jira-row-title">{epic.title}</strong>
                    </div>
                  )}
                  <TicketBadge created={epicCreated} baseUrl={jira?.baseUrl} />
                  <button
                    type="button"
                    className="jira-delete-btn"
                    disabled={ticketsBusy || deleteBusy}
                    title={epicCreated?.jiraKey ? `Delete ${epicCreated.jiraKey} from Jira` : 'Remove this epic from the plan'}
                    aria-label={epicCreated?.jiraKey ? `Delete epic ${epicCreated.jiraKey}` : `Remove epic ${epic.title}`}
                    onClick={() => setPendingDelete({ kind: 'item', itemKind: 'epic', sourceId: epic.id })}
                  >
                    {deletingId === epic.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                  </button>
                </header>
                {open && epic.objective ? <p>{epic.objective}</p> : null}
                {open && childStories.length > 0 && (
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
                          <button
                            type="button"
                            className="jira-delete-btn"
                            disabled={ticketsBusy || deleteBusy}
                            title={storyCreated?.jiraKey ? `Delete ${storyCreated.jiraKey} from Jira` : 'Remove this story from the plan'}
                            aria-label={storyCreated?.jiraKey ? `Delete story ${storyCreated.jiraKey}` : `Remove story ${story.title}`}
                            onClick={() => setPendingDelete({ kind: 'item', itemKind: 'story', sourceId: story.id })}
                          >
                            {deletingId === story.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                          </button>
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

      {alreadyCreated || (epics.length > 0 && !ticketsBusy) ? (
        <div className="card-footer-actions">
          {createdOk > 0 && (
            <button
              type="button"
              className="danger-btn"
              title="Delete only the tickets created on this screen"
              disabled={deleteBusy || creatingIssues || Boolean(jiraPublish?.active)}
              onClick={() => setPendingDelete({ kind: 'all' })}
            >
              {deletingId === '*' ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              Delete all in Jira
            </button>
          )}
          {createdOk > 0 && (
            <span className="quiet-hint">
              <CheckCircle2 size={14} /> {createdOk} from this screen in {jira?.projectKey}
            </span>
          )}
          <span className="action-spacer" />
          <button type="button" className="primary-btn" disabled={!canCreate} onClick={() => void handleCreateInJira()}>
            {creatingIssues || jiraPublish?.active ? <Loader2 size={16} className="spin" /> : <Ticket size={16} />}
            {creatingIssues || jiraPublish?.active
              ? 'Creating in Jira…'
              : alreadyCreated
                ? pendingCount > 0
                  ? `Create remaining ${pendingCount}`
                  : `All ${itemCount || ''} item${itemCount === 1 ? '' : 's'} are in Jira`
                : `Create ${itemCount || ''} item${itemCount === 1 ? '' : 's'} in Jira`}
          </button>
        </div>
      ) : null}
    </section>
    {pendingCopy && (
      <ConfirmDialog
        title={pendingCopy.title}
        copy={pendingCopy.copy}
        confirmLabel={pendingCopy.confirmLabel}
        titleId="jira-delete-title"
        copyId="jira-delete-copy"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
      />
    )}
    </>
  )
}
