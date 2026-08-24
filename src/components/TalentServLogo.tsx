type LogoSize = 'sm' | 'md' | 'lg'

interface TalentServLogoProps {
  size?: LogoSize
  className?: string
}

const HEIGHT: Record<LogoSize, number> = { sm: 36, md: 44, lg: 56 }

/** Official TalentServ wordmark (transparent PNG). */
export function TalentServLogo({ size = 'md', className = '' }: TalentServLogoProps) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}talentserv_logo%202.png`}
      alt="TalentServ — Humans In Harmony"
      className={`talentserv-logo ${size}${className ? ` ${className}` : ''}`}
      style={{ height: HEIGHT[size] }}
      draggable={false}
    />
  )
}
