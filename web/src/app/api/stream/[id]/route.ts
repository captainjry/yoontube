import { NextRequest } from 'next/server'
import { getDriveFileStream, extractProxyHeaders } from '@/lib/drive'
import { verifySessionToken, getSessionSecret, SESSION_COOKIE_NAME } from '@/lib/auth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  const session = request.cookies.get(SESSION_COOKIE_NAME)
  if (!session?.value || !verifySessionToken(session.value, getSessionSecret())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const range = request.headers.get('range') ?? undefined

  try {
    const { status, headers: rawHeaders, data } = await getDriveFileStream(id, range)

    const responseHeaders = new Headers()
    const headerEntries = rawHeaders instanceof Headers
      ? rawHeaders
      : new Headers(rawHeaders as Record<string, string>)

    for (const [key, value] of headerEntries.entries()) {
      responseHeaders.set(key, value)
    }

    const proxied = extractProxyHeaders(responseHeaders)

    // Convert Node readable stream to web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        data.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
        data.on('end', () => controller.close())
        data.on('error', (err: Error) => controller.error(err))
      },
    })

    return new Response(webStream, { status, headers: proxied })
  } catch {
    return Response.json({ error: 'Stream unavailable' }, { status: 502 })
  }
}
