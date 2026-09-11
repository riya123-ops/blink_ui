import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_DEVELOPER_MODE,
  hasDeveloperCapability,
  type DeveloperCapabilityId,
  type DeveloperModeState,
} from './catalog'
import { loadDeveloperMode, saveDeveloperMode, sameDeveloperMode, subscribeDeveloperMode } from './storage'

interface DeveloperModeContextValue {
  state: DeveloperModeState
  setEnabled: (enabled: boolean) => void
  setCapability: (id: DeveloperCapabilityId, on: boolean) => void
  resetCapabilities: () => void
  has: (id: DeveloperCapabilityId) => boolean
}

const DeveloperModeContext = createContext<DeveloperModeContextValue | null>(null)

export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeveloperModeState>(loadDeveloperMode)

  useEffect(() => {
    saveDeveloperMode(state)
    document.documentElement.dataset.developerMode = state.enabled ? 'on' : 'off'
  }, [state])

  useEffect(() => {
    return subscribeDeveloperMode((next) => {
      setState((prev) => (sameDeveloperMode(prev, next) ? prev : next))
    })
  }, [])

  const setEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enabled }))
  }, [])

  const setCapability = useCallback((id: DeveloperCapabilityId, on: boolean) => {
    setState((prev) => ({
      ...prev,
      capabilities: { ...prev.capabilities, [id]: on },
    }))
  }, [])

  const resetCapabilities = useCallback(() => {
    setState((prev) => ({
      ...prev,
      capabilities: { ...DEFAULT_DEVELOPER_MODE.capabilities },
    }))
  }, [])

  const value = useMemo<DeveloperModeContextValue>(
    () => ({
      state,
      setEnabled,
      setCapability,
      resetCapabilities,
      has: (id) => hasDeveloperCapability(state, id),
    }),
    [state, setEnabled, setCapability, resetCapabilities],
  )

  return <DeveloperModeContext.Provider value={value}>{children}</DeveloperModeContext.Provider>
}

const INERT_CONTEXT: DeveloperModeContextValue = {
  state: DEFAULT_DEVELOPER_MODE,
  setEnabled: () => undefined,
  setCapability: () => undefined,
  resetCapabilities: () => undefined,
  has: () => false,
}

export function useDeveloperMode(): DeveloperModeContextValue {
  return useContext(DeveloperModeContext) ?? INERT_CONTEXT
}

export function useDeveloperCapability(id: DeveloperCapabilityId): boolean {
  return useDeveloperMode().has(id)
}
