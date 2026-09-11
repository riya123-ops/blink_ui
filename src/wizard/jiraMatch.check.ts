/**
 * Lightweight Node checks for jiraMatch helpers (no vitest dependency).
 * Run: node --experimental-strip-types src/wizard/jiraMatch.check.ts
 */
import assert from 'node:assert/strict'
import {
  blinkQuestionMarker,
  buildJiraClarifyComment,
  matchQuestionToJiraIssue,
  parseBlinkQuestionMarker,
  type MatchableIssue,
} from './jiraMatch.ts'

const issues: MatchableIssue[] = [
  { key: 'FIT-1', title: 'Authentication and MFA', type: 'Epic', objective: 'Secure login' },
  { key: 'FIT-2', title: 'Billing invoices', type: 'Story', objective: 'Invoice export' },
]

const matched = matchQuestionToJiraIssue('How should MFA work for authentication?', issues)
assert.equal(matched?.key, 'FIT-1')

const weak = matchQuestionToJiraIssue('zzzz unrelated', issues)
assert.equal(weak?.key, 'FIT-1', 'weak overlap falls back to first epic')

assert.equal(parseBlinkQuestionMarker('<!-- blink-question:q-9 -->\nHello'), 'q-9')
assert.equal(blinkQuestionMarker('q-9'), '<!-- blink-question:q-9 -->')

const body = buildJiraClarifyComment({
  questionId: 'q-9',
  question: 'MFA?',
  personName: 'Ada',
  roleLabel: 'Security Champion',
  proposedAnswer: 'TOTP',
})
assert.match(body, /blink-question:q-9/)
assert.match(body, /Proposed answer/)
assert.match(body, /Ada/)

console.log('jiraMatch.check.ts: ok')
