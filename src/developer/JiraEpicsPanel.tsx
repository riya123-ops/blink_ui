import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import {
  deleteAllBlinkJiraIssues,
  deleteBlinkJiraIssue,
  fetchBlinkJiraIssues,
  type BlinkJiraIssueDto,
  type BlinkJiraIssueListDto,
} from '../api/blink'
import { AUTH_SESSION_KEY, clearAuthSession, loadAuthSession } from '../auth/session'
import { useDeveloperMode } from './DeveloperModeContext'
import { loadDeveloperSession, subscribeDeveloperSession } from './session'

function authErrorMessage(raw: string): string {
  const text = raw.trim().toLowerCase()
  if (text.includes('sign in') || text.includes('unauthorized') || text.includes('401')) {
    return 'Session expired (local API restarts clear OTP sessions). Sign in again in the main Blink window, then click Refresh.'
  }
  return raw
}

export function JiraEpicsPanel() {
  const { has } = useDeveloperMode()
  const [projectId, setProjectId] = useState<string | null>(() => loadDeveloperSession()?.projectId ?? null)
  const [data, setData] = useState<BlinkJiraIssueListDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => subscribeDeveloperSession((snapshot) => setProjectId(snapshot?.projectId ?? null)), [])

  const refresh = useCallback(async () => {
    if (!loadAuthSession()?.token) {
      setError('Sign in to Blink in the main window, then click Refresh here.')
      setData(null)
      return
    }
    if (!projectId) {
      setError('Open a Blink project in the main window so this panel knows which Jira binding to use.')
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      setData(await fetchBlinkJiraIssues(projectId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not list Blink Jira issues.'
      if (/sign in|unauthorized|401/i.test(message)) {
        clearAuthSession()
      }
      setError(authErrorMessage(message))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (!has('resetJiraEpics')) return
    void refresh()
  }, [has, refresh])

  useEffect(() => {
    if (!has('resetJiraEpics')) return
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_KEY && event.newValue) void refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [has, refresh])

  if (!has('resetJiraEpics')) return null

  const issues = data?.issues ?? []
  const epics = issues.filter((row) => row.sourceKind === 'epic')
  const stories = issues.filter((row) => row.sourceKind === 'story')

  const onDeleteOne = async (row: BlinkJiraIssueDto) => {
    if (!projectId) return
    if (
      !window.confirm(
        `Delete Blink-marked ${row.sourceKind} ${row.key}? Non-Blink issues in Jira are never deleted.`,
      )
    ) {
      return
    }
    setBusyKey(row.key)
    setError(null)
    setNotice(null)
    try {
      const result = await deleteBlinkJiraIssue(projectId, row.key)
      setNotice(`Deleted ${result.deleted} issue(s)${result.skipped ? `, skipped ${result.skipped}` : ''}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusyKey(null)
    }
  }

  const onDeleteAll = async () => {
    if (!projectId || issues.length === 0) return
    if (
      !window.confirm(
        `Reset Blink Jira issues in ${data?.jiraProjectKey ?? 'this project'}?\n\n` +
          `This deletes ${epics.length} epic(s) and ${stories.length} story/stories with Blink Source markers only.\n` +
          `Other Jira work is left untouched.`,
      )
    ) {
      return
    }
    setBusyKey('*')
    setError(null)
    setNotice(null)
    try {
      const result = await deleteAllBlinkJiraIssues(projectId)
      const skipNote = result.skipped
        ? ` Skipped ${result.skipped}: ${result.skippedKeys.slice(0, 3).join(', ')}${result.skippedKeys.length > 3 ? '…' : ''}.`
        : ''
      const errNote = result.errors.length ? ` Errors: ${result.errors.slice(0, 2).join('; ')}` : ''
      setNotice(`Deleted ${result.deleted} Blink-marked issue(s).${skipNote}${errNote}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="dev-popup-s3">
      <div className="dev-popup-s3-head">
        <div>
          <h3>Reset Jira (Blink only)</h3>
          <p>
            {data?.connected
              ? `${data.jiraProjectKey ?? '—'} · ${epics.length} epic(s), ${stories.length} story/stories`
              : data
                ? data.message ?? 'Jira is not connected for this Blink project'
                : 'Deletes issues with Source epic: / Source story: markers only'}
          </p>
        </div>
        <div className="dev-popup-s3-actions">
          <button
            type="button"
            className="dev-mode-text-btn"
            onClick={() => void refresh()}
            disabled={loading || busyKey !== null}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <button
            type="button"
            className="dev-s3-danger"
            onClick={() => void onDeleteAll()}
            disabled={loading || busyKey !== null || issues.length === 0}
          >
            <Trash2 size={13} />
            Delete all Blink
          </button>
        </div>
      </div>

      {error && <p className="dev-s3-msg is-error">{error}</p>}
      {notice && <p className="dev-s3-msg is-ok">{notice}</p>}
      {loading && !data && <p className="dev-s3-msg">Loading…</p>}

      {!loading && data?.connected && issues.length === 0 && (
        <p className="dev-s3-msg">{data.message ?? 'No Blink-marked issues found.'}</p>
      )}

      {issues.length > 0 && (
        <ul className="dev-s3-list">
          {issues.map((row) => (
            <li key={row.key}>
              <div>
                <strong>{row.key}</strong>
                <em>
                  {row.sourceKind} · {row.sourceId}
                  {row.summary ? ` · ${row.summary}` : ''}
                </em>
              </div>
              <button
                type="button"
                className="dev-s3-danger"
                disabled={busyKey !== null}
                onClick={() => void onDeleteOne(row)}
              >
                <Trash2 size={13} />
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
