import { useEffect } from 'react'
import { openDeveloperPopup } from './window'
import './developer.css'

/** Keeps Ctrl+Shift+D working; opener UI lives in the profile widget. */
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
