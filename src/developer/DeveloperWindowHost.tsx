import { useEffect } from 'react'
import { openDeveloperPopup } from './window'
import './developer.css'

/** Keeps Ctrl+Shift+D working; the account menu and sidebar also open these tools. */
export function DeveloperWindowHost() {
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

  return null
}
