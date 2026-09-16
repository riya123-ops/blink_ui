import type { SavedIntegrationDto } from '../api/blink'
import { DEFAULT_INTEGRATIONS, type IntegrationItem } from './defaults'

/** Merge server-saved connections into wizard integration cards (no tokens). */
export function mergeSavedIntegrations(
  current: IntegrationItem[],
  saved: SavedIntegrationDto[],
): IntegrationItem[] {
  const byId = new Map(saved.map((row) => [row.provider, row]))
  const base = DEFAULT_INTEGRATIONS.map((item) => {
    const existing = current.find((c) => c.id === item.id)
    return existing ? { ...item, ...existing } : { ...item }
  })
  return base.map((item) => {
    const row = byId.get(item.id)
    if (!row?.connected) return item
    return {
      ...item,
      connected: true,
      account: row.account || item.account,
      detail: row.detail || item.detail || (row.account ? `Connected as ${row.account}` : item.detail),
      baseUrl: row.baseUrl || item.baseUrl,
      email: row.email || item.email,
      username: row.username || item.username,
      organization: row.organization || item.organization,
      workspace: row.workspace || item.workspace,
      projectKey: row.projectKey || item.projectKey,
      projectName: row.projectName || item.projectName,
      spaceKey: row.spaceKey || item.spaceKey,
      cloudId: row.cloudId || item.cloudId,
      authType: row.authType || item.authType,
      token: undefined,
    }
  })
}
