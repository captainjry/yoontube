// src/lib/auth.test.ts
import { describe, it, expect } from 'vitest'
import { createSessionToken, verifySessionToken } from './auth'

describe('auth', () => {
  const secret = 'test-secret-at-least-32-chars-long!'

  it('creates a verifiable session token', () => {
    const token = createSessionToken(secret)
    expect(verifySessionToken(token, secret)).toBe(true)
  })

  it('rejects a tampered token', () => {
    expect(verifySessionToken('garbage', secret)).toBe(false)
  })

  it('rejects empty token', () => {
    expect(verifySessionToken('', secret)).toBe(false)
  })
})
