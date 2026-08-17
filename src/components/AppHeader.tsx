import { BlinkLogo } from './BlinkLogo'

export function AppHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`app-header${compact ? ' compact' : ''}`}>
      <div className="header-brands">
        <div className="brand-block talentserv">
          <span className="brand-mark ts-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <circle cx="12" cy="8" r="4" fill="#10b981" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#2563eb" />
            </svg>
          </span>
          <span className="brand-name">TalentServ</span>
        </div>
        <span className="brand-divider" />
        <BlinkLogo size={compact ? 'sm' : 'md'} />
      </div>
    </header>
  )
}
