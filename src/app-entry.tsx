import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DeveloperModeProvider, DeveloperWindowHost } from './developer'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeveloperModeProvider>
      <App />
      <DeveloperWindowHost />
    </DeveloperModeProvider>
  </StrictMode>,
)
