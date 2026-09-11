type LogoId = 'github' | 'atlassian' | 'bitbucket' | 'figma'

function logoIdFor(id: string): LogoId {
  if (id === 'bitbucket') return 'bitbucket'
  if (id === 'github') return 'github'
  if (id === 'figma') return 'figma'
  return 'atlassian'
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

function AtlassianMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.12 11.084a.683.683 0 00-1.16.126L.075 22.974a.703.703 0 00.63 1.018h8.19a.678.678 0 00.63-.39c1.767-3.65.696-9.203-2.406-12.52zM11.434.386a15.515 15.515 0 00-.906 15.317l3.95 7.9a.703.703 0 00.628.388h8.19a.703.703 0 00.63-1.017L12.63.38a.664.664 0 00-1.196.006z" />
    </svg>
  )
}

function BitbucketMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  )
}

function FigmaMark() {
  return (
    <svg viewBox="0 0 38 57" aria-hidden="true">
      <path d="M19 28.5c0-5.247 4.253-9.5 9.5-9.5S38 23.253 38 28.5 33.747 38 28.5 38 19 33.747 19 28.5z" />
      <path d="M0 47.5C0 42.253 4.253 38 9.5 38H19v9.5c0 5.247-4.253 9.5-9.5 9.5S0 52.747 0 47.5z" />
      <path d="M19 0v19H9.5C4.253 19 0 14.747 0 9.5S4.253 0 9.5 0H19z" />
      <path d="M19 0v19h9.5c5.247 0 9.5-4.253 9.5-9.5S33.747 0 28.5 0H19z" />
      <path d="M0 28.5C0 23.253 4.253 19 9.5 19H19v19H9.5C4.253 38 0 33.747 0 28.5z" />
    </svg>
  )
}

export function IntegrationLogo({
  id,
  label,
  className = '',
}: {
  id: string
  label?: string
  className?: string
}) {
  const logoId = logoIdFor(id)
  return (
    <span className={`int-logo int-logo-${logoId} ${className}`.trim()} title={label} aria-hidden="true">
      {logoId === 'github' ? (
        <GitHubMark />
      ) : logoId === 'bitbucket' ? (
        <BitbucketMark />
      ) : logoId === 'figma' ? (
        <FigmaMark />
      ) : (
        <AtlassianMark />
      )}
    </span>
  )
}
