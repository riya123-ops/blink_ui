/**
 * Lightweight Node checks for wizard resume helpers.
 * Run: node --experimental-strip-types src/wizard/resume.check.ts
 */
import assert from 'node:assert/strict'
import {
  isWizardStep,
  parseRemoteUpdatedAt,
  restoreWizardState,
  serializeWizardState,
} from './resume.ts'
import { defaultWizardState } from './types.ts'

const saved = serializeWizardState({
  ...defaultWizardState,
  projectId: '42',
  projectName: 'Fitoyo',
  requirementFile: {} as File,
  integrations: [
    { ...defaultWizardState.integrations[0], id: 'github', connected: true, token: 'secret' },
  ],
})

assert.equal(saved.requirementFile, null)
assert.equal(saved.integrations.find((item) => item.id === 'github')?.connected, true)
assert.equal(saved.integrations.find((item) => item.id === 'github')?.token, undefined)

const restored = restoreWizardState({
  projectName: 'Fitoyo',
  projectId: 42,
  integrations: [{ id: 'github', connected: true, token: 'secret', label: 'GitHub' }],
})
assert.equal(restored.projectId, '42')
assert.equal(restored.requirementFile, null)
assert.equal(restored.integrations.find((item) => item.id === 'github')?.connected, true)
assert.equal(restored.integrations.find((item) => item.id === 'github')?.token, undefined)
assert.equal(isWizardStep('requirements'), true)
assert.equal(isWizardStep('nope'), false)
assert.ok(parseRemoteUpdatedAt('2026-09-11T10:00:00') > 0)

console.log('resume.check.ts: ok')
