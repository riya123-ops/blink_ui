import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import {
  fetchLoginConfig,
  publicOtpSentMessage,
  requestLoginOtp,
  shouldRevealLoginOtp,
  toUserAuthError,
  verifyLoginOtp,
} from '../api/auth'
import { useAuth } from '../auth/AuthContext'
import { LOGIN_ALLOWED_DOMAIN, isTalentservEmail } from '../auth/session'
import { AppHeader } from '../components/AppHeader'
import { ThemeBackground } from '../components/ThemeBackground'
import { useDeveloperMode } from '../developer'

export function LoginScreen() {
  const { signIn } = useAuth()
  const { state: developerState } = useDeveloperMode()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [gateRequired, setGateRequired] = useState(false)
  const [otpReveal, setOtpReveal] = useState(false)
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [notice, setNotice] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)
  const [issuedOtp, setIssuedOtp] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    void fetchLoginConfig()
      .then((config) => {
        setGateRequired(config.gateRequired)
        setOtpReveal(Boolean(config.otpReveal))
      })
      .catch(() => {
        setGateRequired(false)
        setOtpReveal(false)
      })
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((prev) => Math.max(0, prev - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const backToEmail = () => {
    setStep('email')
    setOtp('')
    setIssuedOtp(null)
    setNotice(null)
  }

  const sendCode = async () => {
    const trimmed = email.trim()
    if (!isTalentservEmail(trimmed)) {
      setNotice({
        type: 'error',
        message: `Enter a work email at @${LOGIN_ALLOWED_DOMAIN}.`,
      })
      return
    }
    if (gateRequired && !accessCode.trim()) {
      setNotice({ type: 'error', message: 'Enter your access code.' })
      return
    }
    setSending(true)
    setNotice(null)
    try {
      const result = await requestLoginOtp(trimmed, gateRequired ? accessCode : undefined)
      setEmail(trimmed)
      const localCode = result.otp?.trim() || null
      const reveal = shouldRevealLoginOtp(localCode, {
        otpReveal,
        developerEnabled: developerState.enabled,
        deliveryMode: result.deliveryMode,
      })
      setIssuedOtp(reveal ? localCode : null)
      setOtp(reveal && localCode ? localCode : '')
      setStep('otp')
      setResendIn(result.resendAfterSeconds || 45)
    } catch (err) {
      setNotice({
        type: 'error',
        message: toUserAuthError(err, 'We could not send the sign-in code. Try again in a moment.'),
      })
    } finally {
      setSending(false)
    }
  }

  const signInWithOtp = async () => {
    const code = otp.replace(/\s/g, '')
    if (!/^\d{6}$/.test(code)) {
      setNotice({ type: 'error', message: 'Enter the 6-digit code from your email.' })
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
      setNotice({
        type: 'error',
        message: toUserAuthError(err, 'Could not verify the code. Try again.'),
      })
    } finally {
      setVerifying(false)
    }
  }

  const emailLocked = step === 'otp'
  const showDeveloperCode = Boolean(issuedOtp)

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
            <p className="welcome-desc">
              {step === 'otp'
                ? publicOtpSentMessage(email, showDeveloperCode)
                : gateRequired
                  ? `Enter your @${LOGIN_ALLOWED_DOMAIN} email and access code.`
                  : `We'll send a 6-digit code to your @${LOGIN_ALLOWED_DOMAIN} inbox.`}
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
            {notice && <div className={`status-banner ${notice.type}`}>{notice.message}</div>}

            {showDeveloperCode && issuedOtp && (
              <div className="login-otp-reveal" aria-live="polite">
                <span>Developer code</span>
                <strong>{issuedOtp}</strong>
                <p>Shown only for local or developer sign-in.</p>
              </div>
            )}

            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="login-email">Email</label>
                {emailLocked && (
                  <button
                    type="button"
                    className="mini-btn"
                    disabled={sending || verifying}
                    onClick={backToEmail}
                  >
                    Change
                  </button>
                )}
              </div>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={`you@${LOGIN_ALLOWED_DOMAIN}`}
                value={email}
                disabled={sending || verifying || emailLocked}
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
                  placeholder="Access code"
                  value={accessCode}
                  disabled={sending || verifying || step === 'otp'}
                  onChange={(event) => setAccessCode(event.target.value)}
                />
              </div>
            )}

            {step === 'otp' && (
              <div className="field-group">
                <label htmlFor="login-otp">6-digit code</label>
                <input
                  id="login-otp"
                  className="login-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
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
                  : 'Send sign-in code'
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
              </div>
            )}
          </form>
        </div>

        <footer className="welcome-footer">
          <span className="footer-trust">
            <ShieldCheck size={14} /> Secure • Scalable • Smart
          </span>
          <span className="footer-copy">© {new Date().getFullYear()} TalentServ. All rights reserved.</span>
        </footer>
      </div>
    </div>
  )
}
