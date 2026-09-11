import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { DeveloperModeProvider, DeveloperWindowHost } from './developer'
import { LoginScreen } from './screens/LoginScreen'
import './index.css'

function Root() {
  const { session } = useAuth()
  if (!session) {
    return <LoginScreen />
  }
  return (
    <>
      <App />
      <DeveloperWindowHost />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeveloperModeProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </DeveloperModeProvider>
  </StrictMode>,
)
