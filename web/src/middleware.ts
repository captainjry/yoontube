// src/middleware.ts
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from './lib/constants'

const PUBLIC_PATHS = ['/login']
const PAYLOAD = 'yoontube-authenticated'

async function verifyTokenEdge(token: string): Promise<boolean> {
  const secret = process.env.SESSION_SECRET
  if (!secret || !token) return false

  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(PAYLOAD))
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return token === expected
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Allow static files
  if (pathname.includes('.')) {
    return NextResponse.next()
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME)
  if (session?.value && (await verifyTokenEdge(session.value))) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
