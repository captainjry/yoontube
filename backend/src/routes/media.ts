import type { FastifyInstance } from 'fastify'

import type { MediaIndex } from '../drive/types.js'

const SESSION_COOKIE_NAME = 'session'
const VERIFIED_SESSION_VALUE = 'verified'

type RegisterMediaRoutesOptions = {
  readIndex: () => Promise<MediaIndex>
}

export async function registerMediaRoutes(app: FastifyInstance, options: RegisterMediaRoutesOptions) {
  app.get('/media', async (request, reply) => {
    const signedSession = request.cookies[SESSION_COOKIE_NAME]
    const session = signedSession ? request.unsignCookie(signedSession) : null

    if (!session?.valid || session.value !== VERIFIED_SESSION_VALUE) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      return await options.readIndex()
    } catch {
      return reply.code(500).send({ error: 'Failed to load media index' })
    }
  })
}
