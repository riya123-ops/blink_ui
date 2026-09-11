import { useEffect } from 'react'
import { Code2 } from 'lucide-react'
import { useDeveloperMode } from './DeveloperModeContext'
import { openDeveloperPopup } from './window'
import './developer.css'

export function DeveloperWindowHost() {
  const { state } = useDeveloperMode()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        openDeveloperPopup()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <button
      type="button"
      className={`dev-window-opener${state.enabled ? ' is-on' : ''}`}
      onClick={() => openDeveloperPopup()}
      title="Open developer tools in a separate window (Ctrl+Shift+D)"
    >
      <Code2 size={14} strokeWidth={2.2} />
      Dev
    </button>
  )
}
