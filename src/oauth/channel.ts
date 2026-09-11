export type OauthProvider = 'github' | 'jira' | 'figma'

export interface OauthResult {
  type: 'GITHUB_OAUTH_RESPONSE' | 'JIRA_OAUTH_RESPONSE' | 'FIGMA_OAUTH_RESPONSE'
  code: string | null
  error: string | null
}

const CHANNEL_NAME = 'blink.oauth.callback'

function channel(): BroadcastChannel | null {
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

export function publishOauthResult(result: OauthResult): void {
  const bus = channel()
  bus?.postMessage(result)
  bus?.close()
}

export function subscribeOauthResult(onResult: (result: OauthResult) => void): () => void {
  const bus = channel()
  if (!bus) return () => undefined
  bus.onmessage = (event: MessageEvent<OauthResult>) => {
    if (event.data?.type === 'GITHUB_OAUTH_RESPONSE' || event.data?.type === 'JIRA_OAUTH_RESPONSE' || event.data?.type === 'FIGMA_OAUTH_RESPONSE') {
      onResult(event.data)
    }
  }
  return () => bus.close()
}

export function oauthResultFromLocation(): OauthResult | null {
  if (!/\/(jira|github|figma)\/oauth\/callback/.test(window.location.pathname)) return null
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')
  const errorDesc = params.get('error_description')
  const type = window.location.pathname.includes('/github/')
    ? 'GITHUB_OAUTH_RESPONSE'
    : window.location.pathname.includes('/figma/')
      ? 'FIGMA_OAUTH_RESPONSE'
      : 'JIRA_OAUTH_RESPONSE'
  return {
    type,
    code: params.get('code'),
    error: error ? (errorDesc ? `${error}: ${errorDesc}` : error) : null,
  }
}
