import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { parseBackendSessionCookie } from './lib/backend'
import { isPublicPath, middleware } from './middleware'

describe('isPublicPath', () => {
  it('allows login path and blocks home path', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/')).toBe(false)
  })

  it('allows nested login routes', () => {
    expect(isPublicPath('/login/reset')).toBe(true)
  })

  it('allows public static asset paths', () => {
    expect(isPublicPath('/logo.svg')).toBe(true)
    expect(isPublicPath('/robots.txt')).toBe(true)
    expect(isPublicPath('/site.webmanifest')).toBe(true)
  })
})

describe('middleware', () => {
  it('allows /login without a session cookie', () => {
    const response = middleware(new NextRequest('http://localhost/login'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('redirects a protected path without the session cookie to /login', () => {
    const response = middleware(new NextRequest('http://localhost/'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
  })

  it('allows a protected path when the session cookie is present', () => {
    const response = middleware(
      new NextRequest('http://localhost/', {
        headers: {
          cookie: 'session=s%3Averified.signature',
        },
      }),
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('allows static asset requests without a session cookie', () => {
    const response = middleware(new NextRequest('http://localhost/logo.svg'))

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('parseBackendSessionCookie', () => {
  it('reads the signed session value from a set-cookie header', () => {
    expect(parseBackendSessionCookie('session=s%3Averified.signature; Path=/; HttpOnly; SameSite=Lax')).toEqual({
      name: 'session',
      value: 's%3Averified.signature',
    })
  })

  it('returns null when the backend did not send the session cookie', () => {
    expect(parseBackendSessionCookie('other=value; Path=/')).toBeNull()
    expect(parseBackendSessionCookie(null)).toBeNull()
  })
})
