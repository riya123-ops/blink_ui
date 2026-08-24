type LogoSize = 'sm' | 'md' | 'lg'

interface BlinkLogoProps {
  size?: LogoSize
  className?: string
}

const HEIGHT: Record<LogoSize, number> = { sm: 28, md: 40, lg: 48 }

/** Official Blink logo — same asset on every screen. */
export function BlinkLogo({ size = 'md', className = '' }: BlinkLogoProps) {
  return (
    <img
      src="/blink-logo.png"
      alt="Blink"
      className={`blink-logo ${size}${className ? ` ${className}` : ''}`}
      style={{ height: HEIGHT[size] }}
      draggable={false}
    />
  )
}
