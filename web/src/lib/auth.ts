// src/lib/auth.ts
import { createHmac, timingSafeEqual } from 'crypto'
import { SESSION_COOKIE_NAME } from './constants'

const PAYLOAD = 'yoontube-authenticated'

export function createSessionToken(secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(PAYLOAD)
  return hmac.digest('hex')
}

export function verifySessionToken(token: string, secret: string): boolean {
  if (!token) return false
  try {
    const expected = createSessionToken(secret)
    const a = Buffer.from(token)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is required')
  return secret
}

export function getSharedPassword(): string {
  const password = process.env.SHARED_PASSWORD
  if (!password) throw new Error('SHARED_PASSWORD env var is required')
  return password
}

export { SESSION_COOKIE_NAME }
