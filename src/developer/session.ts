export const DEVELOPER_SESSION_KEY = 'blink.developerSession.v1'
const CHANNEL_NAME = 'blink.developerSession'

export interface DeveloperSessionSnapshot {
  step: string
  projectId: string | null
  groomingUnlocked: boolean
  updatedAt: number
}

function channel(): BroadcastChannel | null {
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

export function loadDeveloperSession(): DeveloperSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(DEVELOPER_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DeveloperSessionSnapshot
  } catch {
    return null
  }
}

export function publishDeveloperSession(
  snapshot: Omit<DeveloperSessionSnapshot, 'updatedAt'>,
): void {
  const next: DeveloperSessionSnapshot = { ...snapshot, updatedAt: Date.now() }
  localStorage.setItem(DEVELOPER_SESSION_KEY, JSON.stringify(next))
  const bus = channel()
  bus?.postMessage(next)
  bus?.close()
}

export function subscribeDeveloperSession(
  onChange: (snapshot: DeveloperSessionSnapshot | null) => void,
): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEVELOPER_SESSION_KEY) onChange(loadDeveloperSession())
  }
  window.addEventListener('storage', onStorage)
  const bus = channel()
  if (bus) {
    bus.onmessage = (event: MessageEvent<DeveloperSessionSnapshot>) => {
      if (event.data && typeof event.data === 'object') onChange(event.data)
    }
  }
  return () => {
    window.removeEventListener('storage', onStorage)
    bus?.close()
  }
}
