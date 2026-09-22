/**
 * Clarify auto-start. Jira issues are created only when the user clicks Create.
 * Run: node --experimental-strip-types src/wizard/thinking.check.ts
 */
import assert from 'node:assert/strict'
import {
  isConnectFirstJiraError,
  shouldAutoStartClarify,
  shouldAutoStartTickets,
} from './thinking.ts'

assert.equal(shouldAutoStartClarify({ hasPaste: true, questionCount: 0, groomStatus: null }), true)
assert.equal(shouldAutoStartClarify({ hasPaste: false, questionCount: 0, groomStatus: null }), false)
assert.equal(shouldAutoStartClarify({ hasPaste: true, questionCount: 2, groomStatus: null }), false)
assert.equal(
  shouldAutoStartClarify({ hasPaste: true, questionCount: 0, groomStatus: 'need_choices' }),
  false,
)
assert.equal(shouldAutoStartClarify({ hasPaste: true, questionCount: 0, groomStatus: 'error' }), false)

assert.equal(shouldAutoStartTickets({ hasWording: true, epicCount: 0, failed: false }), true)
assert.equal(shouldAutoStartTickets({ hasWording: true, epicCount: 2, failed: false }), false)
assert.equal(shouldAutoStartTickets({ hasWording: true, epicCount: 0, failed: true }), false)
assert.equal(isConnectFirstJiraError('Connect Atlassian first'), true)

console.log('thinking.check.ts ok')
