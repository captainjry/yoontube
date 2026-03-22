import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { SESSION_COOKIE_NAME } from './lib/backend'

const PUBLIC_FILE_PATH = /\/[^/]+\.[^/]+$/

export function isPublicPath(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/login/') || PUBLIC_FILE_PATH.test(pathname)
}

export function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
}
