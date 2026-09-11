import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, Layers, Loader2, RefreshCw, Ticket } from 'lucide-react'
import type { WizardState } from '../wizard/types'
import {
  createJiraIssuesFromState,
  isJiraReady,
  jiraConnection,
  planScopeFromWording,
} from '../wizard/jiraTickets'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
  sourceText: string
}

export function JiraScopePanel({ state, onUpdate, sourceText }: Props) {
  const [planningScope, setPlanningScope] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [creatingIssues, setCreatingIssues] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const jira = jiraConnection(state)
  const epics = state.productScope?.epics || []
  const stories = state.productScope?.stories || []
  const jiraReady = isJiraReady(state)
  const createdOk = (state.jiraCreatedIssues || []).filter((item) => item.status === 'created').length
  const wording = sourceText.trim()

  const createdBySource = useMemo(() => {
    const map = new Map<string, NonNullable<WizardState['jiraCreatedIssues']>[number]>()
    for (const item of state.jiraCreatedIssues || []) {
      if (item.sourceId) map.set(item.sourceId, item)
    }
    return map
  }, [state.jiraCreatedIssues])

  const runProductScope = useCallback(async () => {
    if (!wording) {
      setScopeError('Clear the requirement wording first so Blink can propose epics and stories.')
      return
    }
    setPlanningScope(true)
    setScopeError(null)
    try {
      const patch = await planScopeFromWording(state, wording)
      onUpdate(patch)
    } catch (err) {
      setScopeError(err instanceof Error ? err.message : 'Could not plan product scope.')
    } finally {
      setPlanningScope(false)
    }
  }, [onUpdate, state, wording])

  const handleCreateInJira = useCallback(async () => {
    if (!isJiraReady(state)) {
      setCreateError('Connect Atlassian and choose a Jira project on Integrations first.')
      return
    }
    if (epics.length === 0 && stories.length === 0) {
      setCreateError('Plan product scope first so there is something to create.')
      return
    }
    setCreatingIssues(true)
    setCreateError(null)
    try {
      const result = await createJiraIssuesFromState(state)
      onUpdate({ jiraCreatedIssues: result.issues })
      if (result.status === 'error') {
        setCreateError(result.message || 'Jira did not create the issues.')
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create Jira issues.')
    } finally {
      setCreatingIssues(false)
    }
  }, [epics.length, onUpdate, state, stories.length])

  const canCreate = jiraReady && (epics.length > 0 || stories.length > 0) && !creatingIssues && !planningScope
  const itemCount = epics.length + stories.length

  return (
    <section className="card ref-card jira-scope-panel">
      <div className="jira-scope-head">
        <div>
          <p className="jira-scope-kicker">Product scope</p>
          <h3>Epics & stories for Jira</h3>
          <p>
            Blink proposes these tickets from your cleared requirement. If Jira is connected, they are created in that
            project after you save the wording.
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
      </div>

      {planningScope && (
        <div className="jira-scope-empty">
          <Loader2 size={22} className="spin" />
          <p>Planning product scope from your cleared requirement…</p>
        </div>
      )}

      {!planningScope && !wording && (
        <div className="jira-scope-empty">
          <Layers size={22} />
          <p>Save the requirement wording first. This panel then proposes the Jira backlog from that text.</p>
        </div>
      )}

      {!planningScope && wording && epics.length === 0 && (
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
      {!jiraReady && (
        <p className="field-hint">Connect Atlassian and pick a Jira project on Integrations to create these tickets.</p>
      )}

      <div className="jira-scope-actions">
        <button type="button" className="jira-create-btn" disabled={!canCreate} onClick={() => void handleCreateInJira()}>
          {creatingIssues ? <Loader2 size={16} className="spin" /> : <Ticket size={16} />}
          {creatingIssues
            ? 'Creating in Jira…'
            : `Create ${itemCount || ''} item${itemCount === 1 ? '' : 's'} in Jira`}
        </button>
        {createdOk > 0 && (
          <span className="jira-created-note">
            <CheckCircle2 size={14} /> {createdOk} created in {jira?.projectKey}
          </span>
        )}
      </div>
    </section>
  )
}
