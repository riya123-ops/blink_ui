import {
  DEFAULT_DEVELOPER_MODE,
  DEVELOPER_CAPABILITIES,
  type DeveloperCapabilityId,
  type DeveloperModeState,
} from './catalog'

export const DEVELOPER_MODE_STORAGE_KEY = 'blink.developerMode.v1'
const CHANNEL_NAME = 'blink.developerMode'

function mergeCapabilities(
  stored: Partial<Record<string, boolean>> | undefined,
): Record<DeveloperCapabilityId, boolean> {
  const next = { ...DEFAULT_DEVELOPER_MODE.capabilities }
  for (const id of Object.keys(DEVELOPER_CAPABILITIES) as DeveloperCapabilityId[]) {
    if (typeof stored?.[id] === 'boolean') {
      next[id] = stored[id]
    }
  }
  return next
}

function channel(): BroadcastChannel | null {
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

export function loadDeveloperMode(): DeveloperModeState {
  try {
    const raw = localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY)
    if (!raw) return DEFAULT_DEVELOPER_MODE
    const parsed = JSON.parse(raw) as Partial<DeveloperModeState>
    return {
      enabled: Boolean(parsed.enabled),
      capabilities: mergeCapabilities(parsed.capabilities),
    }
  } catch {
    return DEFAULT_DEVELOPER_MODE
  }
}

export function saveDeveloperMode(state: DeveloperModeState): void {
  localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, JSON.stringify(state))
  const bus = channel()
  bus?.postMessage(state)
  bus?.close()
}

export function subscribeDeveloperMode(onChange: (state: DeveloperModeState) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEVELOPER_MODE_STORAGE_KEY) onChange(loadDeveloperMode())
  }
  window.addEventListener('storage', onStorage)
  const bus = channel()
  if (bus) {
    bus.onmessage = (event: MessageEvent<DeveloperModeState>) => {
      if (event.data && typeof event.data.enabled === 'boolean') onChange(event.data)
    }
  }
  return () => {
    window.removeEventListener('storage', onStorage)
    bus?.close()
  }
}

export function sameDeveloperMode(a: DeveloperModeState, b: DeveloperModeState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
