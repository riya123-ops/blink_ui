import type { DesignOption, DesignOptionScreen } from './types'

export type ScreenKind = 'auth' | 'dashboard' | 'list' | 'detail' | 'form' | 'board'

export function screenKind(screen: Pick<DesignOptionScreen, 'name' | 'purpose'>): ScreenKind {
  const text = `${screen.name} ${screen.purpose || ''}`.toLowerCase()
  if (/(log ?in|sign[- ]?in|auth|password)/.test(text)) return 'auth'
  if (/(home|hub|dashboard|overview|workspace)/.test(text)) return 'dashboard'
  if (/(board|kanban|pipeline)/.test(text)) return 'board'
  if (/(list|inbox|queue|activity|history|search|catalog)/.test(text)) return 'list'
  if (/(setting|profile|edit|create|form|config)/.test(text)) return 'form'
  return 'detail'
}

function ScreenChrome({
  title,
  kind,
  compact,
}: {
  title: string
  kind: ScreenKind
  compact?: boolean
}) {
  return (
    <div className={`wire-screen wire-${kind}${compact ? ' is-compact' : ''}`}>
      <div className="wire-top">
        <span className="wire-dots" aria-hidden="true" />
        <span className="wire-title">{title}</span>
      </div>
      {kind === 'auth' ? (
        <div className="wire-body">
          <div className="wire-hero" />
          <div className="wire-field" />
          <div className="wire-field" />
          <div className="wire-btn" />
        </div>
      ) : null}
      {kind === 'dashboard' ? (
        <div className="wire-body">
          <div className="wire-search" />
          <div className="wire-tiles">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}
      {kind === 'list' ? (
        <div className="wire-body">
          <div className="wire-search" />
          <div className="wire-row" />
          <div className="wire-row" />
          <div className="wire-row" />
        </div>
      ) : null}
      {kind === 'board' ? (
        <div className="wire-body wire-board">
          <div className="wire-col" />
          <div className="wire-col" />
          <div className="wire-col" />
        </div>
      ) : null}
      {kind === 'form' ? (
        <div className="wire-body">
          <div className="wire-field" />
          <div className="wire-field wide" />
          <div className="wire-btn ghost" />
        </div>
      ) : null}
      {kind === 'detail' ? (
        <div className="wire-body">
          <div className="wire-hero short" />
          <div className="wire-row" />
          <div className="wire-row" />
        </div>
      ) : null}
    </div>
  )
}

export function DesignWireframe({
  option,
  variant = 'compact',
}: {
  option: DesignOption
  variant?: 'compact' | 'full'
}) {
  const screens = (option.screens || []).slice(0, variant === 'compact' ? 4 : 8)
  const layout = String(option.layout || 'linear')
  const compact = variant === 'compact'
  return (
    <div className={`wire-stage layout-${layout}${compact ? ' is-compact' : ''}`} aria-hidden="true">
      {layout === 'hub' && screens[0] ? (
        <>
          <ScreenChrome title={screens[0].name} kind={screenKind(screens[0])} compact={compact} />
          <div className="wire-satellites">
            {screens.slice(1, 4).map((screen) => (
              <ScreenChrome key={screen.id || screen.name} title={screen.name} kind={screenKind(screen)} compact />
            ))}
          </div>
        </>
      ) : null}
      {layout === 'split' && screens[0] ? (
        <div className="wire-split">
          <ScreenChrome title={screens[0].name} kind={screenKind(screens[0])} compact={compact} />
          {screens[1] ? (
            <ScreenChrome title={screens[1].name} kind={screenKind(screens[1])} compact={compact} />
          ) : null}
        </div>
      ) : null}
      {layout !== 'hub' && layout !== 'split' ? (
        <div className="wire-flow">
          {screens.map((screen) => (
            <ScreenChrome
              key={screen.id || screen.name}
              title={screen.name}
              kind={screenKind(screen)}
              compact={compact}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function svgScreen(x: number, y: number, screen: DesignOptionScreen): string {
  const title = escapeXml(screen.name)
  const kind = screenKind(screen)
  const blocks =
    kind === 'auth'
      ? `<rect x="${x + 28}" y="${y + 58}" width="144" height="10" rx="3" fill="#d7e0ea"/>
         <rect x="${x + 28}" y="${y + 78}" width="144" height="10" rx="3" fill="#d7e0ea"/>
         <rect x="${x + 28}" y="${y + 102}" width="88" height="16" rx="4" fill="#2563eb"/>`
      : kind === 'dashboard'
        ? `<rect x="${x + 16}" y="${y + 48}" width="168" height="12" rx="6" fill="#d7e0ea"/>
           <rect x="${x + 16}" y="${y + 72}" width="78" height="44" rx="6" fill="#e8eef5"/>
           <rect x="${x + 106}" y="${y + 72}" width="78" height="44" rx="6" fill="#e8eef5"/>`
        : `<rect x="${x + 16}" y="${y + 52}" width="168" height="10" rx="3" fill="#d7e0ea"/>
           <rect x="${x + 16}" y="${y + 70}" width="168" height="10" rx="3" fill="#d7e0ea"/>
           <rect x="${x + 16}" y="${y + 88}" width="128" height="10" rx="3" fill="#d7e0ea"/>`
  return `<g>
    <rect x="${x}" y="${y}" width="200" height="280" rx="16" fill="#fff" stroke="#c5d0dc"/>
    <rect x="${x}" y="${y}" width="200" height="32" rx="16" fill="#f3f6fa"/>
    <text x="${x + 100}" y="${y + 21}" text-anchor="middle" font-size="11" font-family="Segoe UI, sans-serif" fill="#12263a">${title}</text>
    ${blocks}
  </g>`
}

export function optionToSvg(option: DesignOption): string {
  const screens = (option.screens || []).slice(0, 8)
  const gap = 28
  const width = Math.max(240, screens.length * (200 + gap) + 40)
  const frames = screens.map((screen, index) => svgScreen(20 + index * (200 + gap), 36, screen)).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="340" viewBox="0 0 ${width} 340">
  <rect width="100%" height="100%" fill="#f7f9fc"/>
  <text x="20" y="22" font-size="13" font-family="Segoe UI, sans-serif" fill="#12263a">${escapeXml(option.name)} — Blink wireframes (drop into Figma)</text>
  ${frames}
</svg>`
}

export function downloadOptionSvg(option: DesignOption, projectName?: string) {
  const svg = optionToSvg(option)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const slug = (projectName || 'blink').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
  link.href = url
  link.download = `${slug || 'blink'}-${option.id || 'design'}-wireframes.svg`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
