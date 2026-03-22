import type { FastifyInstance } from 'fastify'

import type { MediaIndex } from '../drive/types.js'

const SESSION_COOKIE_NAME = 'session'
const VERIFIED_SESSION_VALUE = 'verified'

type GetDriveThumbnail = (fileId: string) => Promise<{
  statusCode: number
  headers: Record<string, string>
  body: Buffer | NodeJS.ReadableStream
}>

type RegisterThumbnailRoutesOptions = {
  readIndex: () => Promise<MediaIndex>
  getDriveThumbnail?: GetDriveThumbnail
}

export async function registerThumbnailRoutes(app: FastifyInstance, options: RegisterThumbnailRoutesOptions) {
  app.get('/thumbnail/:id', async (request, reply) => {
    const signedSession = request.cookies[SESSION_COOKIE_NAME]
    const session = signedSession ? request.unsignCookie(signedSession) : null

    if (!session?.valid || session.value !== VERIFIED_SESSION_VALUE) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { id } = request.params as { id: string }

    let index: MediaIndex

    try {
      index = await options.readIndex()
    } catch {
      return reply.code(500).send({ error: 'Failed to load media index' })
    }

    const mediaItem = index.items.find((item) => item.id === id)

    if (!mediaItem) {
      return reply.code(404).send({ error: 'Media not found' })
    }

    if (!options.getDriveThumbnail) {
      return reply.code(503).send({ error: 'Thumbnails are unavailable' })
    }

    try {
      const response = await options.getDriveThumbnail(id)

      reply.code(response.statusCode)
      reply.header('content-type', response.headers['content-type'] ?? mediaItem.mimeType)
      reply.header('cache-control', 'public, max-age=3600')

      return reply.send(response.body)
    } catch {
      return reply.code(502).send({ error: 'Failed to fetch thumbnail' })
    }
  })
}
