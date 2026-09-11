import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DeveloperPopupApp } from './DeveloperPopupApp'
import './developer.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeveloperPopupApp />
  </StrictMode>,
)
