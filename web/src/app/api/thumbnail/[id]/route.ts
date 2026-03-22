import { NextRequest } from 'next/server'

import { getBackendBaseUrl, SESSION_COOKIE_NAME } from '../../../../lib/backend'

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)
  const headers = new Headers()

  if (sessionCookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${sessionCookie.value}`)
  }

  let response: Response

  try {
    response = await fetch(`${getBackendBaseUrl()}/thumbnail/${encodeURIComponent(id)}`, {
      headers,
      cache: 'no-store',
    })
  } catch {
    return Response.json({ error: 'Unable to reach thumbnail service' }, { status: 502 })
  }

  const proxiedHeaders = new Headers()
  const contentType = response.headers.get('content-type')

  if (contentType) {
    proxiedHeaders.set('content-type', contentType)
  }

  proxiedHeaders.set('cache-control', 'public, max-age=3600')

  return new Response(response.body, {
    status: response.status,
    headers: proxiedHeaders,
  })
}
