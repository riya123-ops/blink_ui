import { TalentServLogo } from './TalentServLogo'
import { BlinkLogo } from './BlinkLogo'

export function AppHeader({ compact = false }: { compact?: boolean }) {
  const Tag = compact ? 'div' : 'header'
  return (
    <Tag className={`app-header${compact ? ' compact' : ''}`}>
      <div className="header-brands">
        <TalentServLogo size={compact ? 'sm' : 'md'} />
        <span className="brand-divider" />
        <BlinkLogo size={compact ? 'sm' : 'md'} />
      </div>
    </Tag>
  )
}
