type LogoSize = 'sm' | 'md' | 'lg'

interface BlinkLogoProps {
  size?: LogoSize
  className?: string
}

const HEIGHT: Record<LogoSize, number> = { sm: 32, md: 40, lg: 52 }

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
