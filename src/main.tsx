import { isDeveloperPopupWindow } from './developer/window'

if (window.opener && /\/(jira|github)\/oauth\/callback/.test(window.location.pathname)) {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')
  const errorDesc = params.get('error_description')
  const state = params.get('state')
  const type = window.location.pathname.includes('/github/')
    ? 'GITHUB_OAUTH_RESPONSE'
    : 'JIRA_OAUTH_RESPONSE'
  window.opener.postMessage(
    {
      type,
      code: code || null,
      error: error ? (errorDesc ? `${error}: ${errorDesc}` : error) : null,
      state: state || null,
    },
    '*'
  )
  window.close()
} else if (isDeveloperPopupWindow()) {
  void import('./developer/popup-entry')
} else {
  void import('./app-entry')
}
