import { NextRequest } from 'next/server'

import { getBackendBaseUrl, SESSION_COOKIE_NAME } from '../../../../lib/backend'

const PROXIED_HEADER_NAMES = ['accept-ranges', 'cache-control', 'content-length', 'content-range', 'content-type']

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  const headers = new Headers()
  const range = request.headers.get('range')

  if (sessionCookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${sessionCookie.value}`)
  }

  if (range) {
    headers.set('range', range)
  }

  let response: Response

  try {
    response = await fetch(`${getBackendBaseUrl()}/stream/${encodeURIComponent(id)}`, {
      headers,
      cache: 'no-store',
    })
  } catch {
    return Response.json({ error: 'Unable to reach stream service' }, { status: 502 })
  }

  const proxiedHeaders = new Headers()

  for (const name of PROXIED_HEADER_NAMES) {
    const value = response.headers.get(name)

    if (value) {
      proxiedHeaders.set(name, value)
    }
  }

  return new Response(response.body, {
    status: response.status,
    headers: proxiedHeaders,
  })
}
