import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import {
  deleteAllS3Workspaces,
  deleteS3Workspace,
  fetchS3Workspaces,
  type S3WorkspaceListDto,
  type S3WorkspaceProjectDto,
} from '../api/blink'
import { AUTH_SESSION_KEY, clearAuthSession, loadAuthSession } from '../auth/session'
import { useDeveloperMode } from './DeveloperModeContext'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function authErrorMessage(raw: string): string {
  const text = raw.trim().toLowerCase()
  if (text.includes('sign in') || text.includes('unauthorized') || text.includes('401')) {
    return 'Session expired (local API restarts clear OTP sessions). Sign in again in the main Blink window, then click Refresh.'
  }
  return raw
}

export function S3WorkspacesPanel() {
  const { has } = useDeveloperMode()
  const [data, setData] = useState<S3WorkspaceListDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyFolder, setBusyFolder] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!loadAuthSession()?.token) {
      setError('Sign in to Blink in the main window, then click Refresh here.')
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      setData(await fetchS3Workspaces())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not list S3 workspaces.'
      if (/sign in|unauthorized|401/i.test(message)) {
        clearAuthSession()
      }
      setError(authErrorMessage(message))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!has('manageS3Workspaces')) return
    void refresh()
  }, [has, refresh])

  // Main window login writes localStorage; pick it up without reopening the popup.
  useEffect(() => {
    if (!has('manageS3Workspaces')) return
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_KEY && event.newValue) {
        void refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [has, refresh])

  if (!has('manageS3Workspaces')) return null

  const workspaces = data?.workspaces ?? []

  const onDeleteOne = async (row: S3WorkspaceProjectDto) => {
    if (!window.confirm(`Delete S3 folder “${row.folder}” and all of its objects?`)) return
    setBusyFolder(row.folder)
    setError(null)
    setNotice(null)
    try {
      const result = await deleteS3Workspace(row.folder)
      setNotice(`Deleted ${result.deletedObjects} objects in ${row.folder}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusyFolder(null)
    }
  }

  const onDeleteAll = async () => {
    if (workspaces.length === 0) return
    if (
      !window.confirm(
        `Delete all ${workspaces.length} Blink S3 workspace folder(s)? This cannot be undone.`,
      )
    ) {
      return
    }
    setBusyFolder('*')
    setError(null)
    setNotice(null)
    try {
      const result = await deleteAllS3Workspaces()
      setNotice(`Deleted ${result.deletedFolders} folders (${result.deletedObjects} objects).`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete all failed.')
    } finally {
      setBusyFolder(null)
    }
  }

  return (
    <section className="dev-popup-s3">
      <div className="dev-popup-s3-head">
        <div>
          <h3>AWS S3 workspaces</h3>
          <p>
            {data?.enabled
              ? `Bucket ${data.bucket ?? '—'} · Blink-owned only (marker required)`
              : data
                ? 'S3 is not configured on the API'
                : 'Only folders Blink created (`.blink-workspace.json` / kit marker)'}
          </p>
        </div>
        <div className="dev-popup-s3-actions">
          <button type="button" className="dev-mode-text-btn" onClick={() => void refresh()} disabled={loading || busyFolder !== null}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button
            type="button"
            className="dev-s3-danger"
            onClick={() => void onDeleteAll()}
            disabled={loading || busyFolder !== null || workspaces.length === 0}
          >
            <Trash2 size={13} />
            Delete all
          </button>
        </div>
      </div>

      {error && <p className="dev-s3-msg is-error">{error}</p>}
      {notice && <p className="dev-s3-msg is-ok">{notice}</p>}
      {loading && !data && <p className="dev-s3-msg">Loading…</p>}

      {!loading && data?.enabled && workspaces.length === 0 && (
        <p className="dev-s3-msg">No Blink workspace folders in this bucket.</p>
      )}

      {workspaces.length > 0 && (
        <ul className="dev-s3-list">
          {workspaces.map((row) => (
            <li key={row.folder}>
              <div>
                <strong>{row.folder}</strong>
                <em>
                  {row.projectId != null ? `id ${row.projectId}` : 'no project id'}
                  {row.kitComplete ? ' · kit ready' : ' · provisioning / partial'}
                  {row.objectCount > 0 ? ` · ${row.objectCount} objects · ${formatBytes(row.totalBytes)}` : ''}
                </em>
              </div>
              <button
                type="button"
                className="dev-s3-danger"
                disabled={busyFolder !== null}
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
