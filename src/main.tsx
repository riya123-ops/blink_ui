import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Check if this window was opened as an OAuth callback popup (e.g. on Render static site)
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
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
