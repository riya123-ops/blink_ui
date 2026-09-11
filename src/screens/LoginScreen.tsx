import { useEffect, useState } from 'react'
import { ArrowRight, KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { fetchLoginConfig, requestLoginOtp, verifyLoginOtp } from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { LOGIN_ALLOWED_DOMAIN, isTalentservEmail } from '../auth/session'
import { AppHeader } from '../components/AppHeader'
import { ThemeBackground } from '../components/ThemeBackground'

export function LoginScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [gateRequired, setGateRequired] = useState(false)
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)
  const [issuedOtp, setIssuedOtp] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    void fetchLoginConfig()
      .then((config) => setGateRequired(config.gateRequired))
      .catch(() => setGateRequired(false))
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((prev) => Math.max(0, prev - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const sendCode = async () => {
    const trimmed = email.trim()
    if (!isTalentservEmail(trimmed)) {
      setNotice({
        type: 'error',
        message: `Username must be a TalentServ email (@${LOGIN_ALLOWED_DOMAIN}).`,
      })
      return
    }
    if (gateRequired && !accessCode.trim()) {
      setNotice({ type: 'error', message: 'Enter the shared access code.' })
      return
    }
    setSending(true)
    setNotice(null)
    try {
      const result = await requestLoginOtp(trimmed, gateRequired ? accessCode : undefined)
      setEmail(trimmed)
      const localCode = result.otp?.trim() || null
      setIssuedOtp(localCode)
      setOtp('')
      setStep('otp')
      setResendIn(result.resendAfterSeconds || 45)
      setNotice({
        type: localCode ? 'info' : 'success',
        message: result.message,
      })
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Could not send the code.' })
    } finally {
      setSending(false)
    }
  }

  const signInWithOtp = async () => {
    const code = otp.replace(/\s/g, '')
    if (!/^\d{6}$/.test(code)) {
      setNotice({ type: 'error', message: 'Enter the 6-digit one-time password from your email.' })
      return
    }
    setVerifying(true)
    setNotice(null)
    try {
      const session = await verifyLoginOtp(email, code, gateRequired ? accessCode : undefined)
      if (!session.token) {
        throw new Error('Sign-in did not return a session. Try again.')
      }
      signIn({ token: session.token, email: session.email, expiresAt: session.expiresAt })
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Could not verify the code.' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="app-shell welcome-mode">
      <ThemeBackground />
      <div className="login-page">
        <AppHeader />

        <div className="welcome-body">
          <div className="welcome-headline">
            <h1>
              Sign in to <span className="gradient-text">Blink</span>
            </h1>
            <p className="welcome-tagline">TalentServ access</p>
            <p className="welcome-desc">
              Use your @{LOGIN_ALLOWED_DOMAIN} email
              {gateRequired ? ' and the shared access code.' : '. We will send a one-time password to that inbox.'}
            </p>
          </div>

          <form
            className="login-card"
            onSubmit={(event) => {
              event.preventDefault()
              if (step === 'email') void sendCode()
              else void signInWithOtp()
            }}
          >
            <div className="login-card-icon">
              {step === 'email' ? <Mail size={26} strokeWidth={1.75} /> : <KeyRound size={26} strokeWidth={1.75} />}
            </div>
            <h2>{step === 'email' ? 'Work email' : 'One-time password'}</h2>
            <p className="login-card-copy">
              {step === 'email'
                ? 'Only TalentServ accounts can open the project wizard.'
                : issuedOtp
                  ? `Demo code for ${email}. Email OTP is off until SMTP is enabled.`
                  : `Enter the 6-digit code we sent to ${email}.`}
            </p>

            {notice && <div className={`status-banner ${notice.type}`}>{notice.message}</div>}

            {step === 'otp' && issuedOtp && (
              <div className="login-otp-reveal" aria-live="polite">
                <span>Demo code</span>
                <strong>{issuedOtp}</strong>
              </div>
            )}

            <div className="field-group">
              <label htmlFor="login-email">Username</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder={`you@${LOGIN_ALLOWED_DOMAIN}`}
                value={email}
                disabled={sending || verifying || step === 'otp'}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {gateRequired && (
              <div className="field-group">
                <label htmlFor="login-gate">Access code</label>
                <input
                  id="login-gate"
                  type="password"
                  autoComplete="off"
                  placeholder="Shared demo access code"
                  value={accessCode}
                  disabled={sending || verifying || step === 'otp'}
                  onChange={(event) => setAccessCode(event.target.value)}
                />
              </div>
            )}

            {step === 'otp' && (
              <div className="field-group">
                <label htmlFor="login-otp">Password</label>
                <input
                  id="login-otp"
                  className="login-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  disabled={verifying}
                  autoFocus
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
            )}

            <button type="submit" className="primary-btn login-submit" disabled={sending || verifying}>
              {step === 'email'
                ? sending
                  ? 'Sending code…'
                  : 'Send one-time password'
                : verifying
                  ? 'Signing in…'
                  : 'Sign in'}
              <ArrowRight size={16} />
            </button>

            {step === 'otp' && (
              <div className="login-secondary">
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={sending || verifying || resendIn > 0}
                  onClick={() => void sendCode()}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={sending || verifying}
                  onClick={() => {
                    setStep('email')
                    setOtp('')
                    setIssuedOtp(null)
                    setNotice(null)
                  }}
                >
                  Use a different email
                </button>
              </div>
            )}
          </form>
        </div>

        <footer className="welcome-footer">
          <span className="footer-trust">
            <ShieldCheck size={14} /> Secure • Scalable • Smart
          </span>
          <span className="footer-copy">© 2024 TalentServ. All rights reserved.</span>
        </footer>
      </div>
    </div>
  )
}
