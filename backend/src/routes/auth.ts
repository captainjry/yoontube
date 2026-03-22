import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const SESSION_COOKIE_NAME = 'session'

const verifyPasswordBodySchema = z.object({
  password: z.string().min(1),
})

type RegisterAuthRoutesOptions = {
  sharedPassword: string
}

export async function registerAuthRoutes(app: FastifyInstance, options: RegisterAuthRoutesOptions) {
  app.post('/auth/verify', async (request, reply) => {
    const parsedBody = verifyPasswordBodySchema.safeParse(request.body)

    if (!parsedBody.success) {
      return reply.code(400).send({ error: 'Password is required' })
    }

    if (parsedBody.data.password !== options.sharedPassword) {
      return reply.code(401).send({ error: 'Invalid password' })
    }

    reply.setCookie(SESSION_COOKIE_NAME, 'verified', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      signed: true,
    })

    return reply.code(204).send()
  })
}
