import { apiUrl } from './blink'

export interface OtpRequestResponse {
  message: string
  deliveryMode: string
  expiresInSeconds: number
  resendAfterSeconds: number
  otp?: string | null
}

export interface AuthSessionResponse {
  token?: string | null
  email: string
  expiresAt: string
}

async function readError(response: Response): Promise<string> {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text) as { message?: string }
    return parsed.message || text || `Request failed (${response.status})`
  } catch {
    return text || `Request failed (${response.status})`
  }
}

export interface AuthLoginConfig {
  allowedDomain: string
  gateRequired: boolean
  otpReveal: boolean
}

export async function fetchLoginConfig(): Promise<AuthLoginConfig> {
  const response = await fetch(apiUrl('/auth/config'))
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json() as Promise<AuthLoginConfig>
}

export async function requestLoginOtp(email: string, accessCode?: string): Promise<OtpRequestResponse> {
  const response = await fetch(apiUrl('/auth/otp/request'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, accessCode: accessCode || undefined }),
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json() as Promise<OtpRequestResponse>
}

export async function verifyLoginOtp(email: string, otp: string, accessCode?: string): Promise<AuthSessionResponse> {
  const response = await fetch(apiUrl('/auth/otp/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, accessCode: accessCode || undefined }),
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json() as Promise<AuthSessionResponse>
}
