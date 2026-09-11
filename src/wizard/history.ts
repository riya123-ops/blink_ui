import { canNavigateToStep, STEP_ORDER, stepIndex } from './steps.ts'
import { isWizardStep } from './resume.ts'
import type { WizardStep } from './types.ts'

export const WIZARD_HISTORY_KEY = 'blinkWizard'

export interface WizardHistoryState {
  blinkWizard: true
  step: WizardStep
}

export function stepFromLocation(): WizardStep | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('step')
  return isWizardStep(value) ? value : null
}

export function urlForStep(step: WizardStep): string {
  const url = new URL(window.location.href)
  if (step === 'welcome') {
    url.searchParams.delete('step')
  } else {
    url.searchParams.set('step', step)
  }
  return `${url.pathname}${url.search}${url.hash}`
}

export function writeStepUrl(step: WizardStep, mode: 'push' | 'replace'): void {
  if (typeof history === 'undefined') return
  const data: WizardHistoryState = { blinkWizard: true, step }
  const url = urlForStep(step)
  if (mode === 'replace') {
    history.replaceState(data, '', url)
  } else {
    history.pushState(data, '', url)
  }
}

export function isWizardHistoryState(value: unknown): value is WizardHistoryState {
  return Boolean(
    value
      && typeof value === 'object'
      && (value as WizardHistoryState).blinkWizard === true
      && isWizardStep((value as WizardHistoryState).step),
  )
}

export function allowedStep(
  requested: WizardStep | null,
  current: WizardStep,
  completedThrough: number,
  groomingUnlocked: boolean,
  unrestricted: boolean,
): WizardStep {
  if (!requested) return current
  if (requested === current) return current
  if (canNavigateToStep(requested, current, completedThrough, groomingUnlocked, unrestricted)) {
    return requested
  }
  if (stepIndex(requested) <= Math.max(completedThrough, stepIndex(current))) {
    return requested
  }
  return current
}

export function seedWizardHistory(current: WizardStep, force = false): void {
  if (typeof history === 'undefined') return
  if (!force && isWizardHistoryState(history.state) && history.state.step === current) {
    writeStepUrl(current, 'replace')
    return
  }
  const idx = Math.max(0, stepIndex(current))
  writeStepUrl(STEP_ORDER[0], 'replace')
  for (let i = 1; i <= idx; i += 1) {
    writeStepUrl(STEP_ORDER[i], 'push')
  }
}
