import type { FastifyInstance } from 'fastify'

import type { MediaIndex } from '../drive/types.js'

const SESSION_COOKIE_NAME = 'session'
const VERIFIED_SESSION_VALUE = 'verified'
const STREAMABLE_PLAYBACK_MODE = 'playable_in_browser'
const PROXIED_HEADER_NAMES = new Set([
  'accept-ranges',
  'cache-control',
  'content-length',
  'content-range',
  'content-type',
])

type DriveStreamResponse = {
  statusCode: number
  headers: Record<string, string>
  body: Buffer | NodeJS.ReadableStream
}

type RegisterStreamRoutesOptions = {
  readIndex: () => Promise<MediaIndex>
  getDriveStream?: (fileId: string, range?: string) => Promise<DriveStreamResponse>
}

export async function registerStreamRoutes(app: FastifyInstance, options: RegisterStreamRoutesOptions) {
  app.get('/stream/:id', async (request, reply) => {
    const signedSession = request.cookies[SESSION_COOKIE_NAME]
    const session = signedSession ? request.unsignCookie(signedSession) : null

    if (!session?.valid || session.value !== VERIFIED_SESSION_VALUE) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { id } = request.params as { id: string }
    const index = await loadCurrentIndex(reply, options.readIndex)

    if (!index) {
      return
    }

    const mediaItem = index.items.find((item) => item.id === id)

    if (!mediaItem) {
      return reply.code(404).send({ error: 'Media not found' })
    }

    if (mediaItem.playbackMode !== STREAMABLE_PLAYBACK_MODE) {
      return reply.code(404).send({ error: 'Media not streamable' })
    }

    if (!options.getDriveStream) {
      return reply.code(503).send({ error: 'Streaming is unavailable' })
    }

    const range = typeof request.headers.range === 'string' ? request.headers.range : undefined
    let response: DriveStreamResponse

    try {
      response = await options.getDriveStream(id, range)
    } catch {
      return reply.code(502).send({ error: 'Failed to stream media' })
    }

    reply.code(response.statusCode)

    let hasContentType = false

    for (const name of PROXIED_HEADER_NAMES) {
      const value = response.headers[name]

      if (value) {
        reply.header(name, value)

        if (name === 'content-type') {
          hasContentType = true
        }
      }
    }

    if (!hasContentType) {
      reply.header('content-type', mediaItem.mimeType)
    }

    return reply.send(response.body)
  })
}

async function loadCurrentIndex(reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }, readIndex: () => Promise<MediaIndex>) {
  try {
    return await readIndex()
  } catch {
    reply.code(500).send({ error: 'Failed to load media index' })
    return null
  }
}
