import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'

import type { MediaIndex } from './drive/types.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerMediaRoutes } from './routes/media.js'
import { registerStreamRoutes } from './routes/stream.js'
import { registerThumbnailRoutes } from './routes/thumbnail.js'

type DriveResponse = {
  statusCode: number
  headers: Record<string, string>
  body: Buffer | NodeJS.ReadableStream
}

type BuildAppOptions = {
  sharedPassword: string
  readIndex: () => Promise<MediaIndex>
  getDriveStream?: (fileId: string, range?: string) => Promise<DriveResponse>
  getDriveThumbnail?: (fileId: string) => Promise<DriveResponse>
}

export function buildApp(options: BuildAppOptions) {
  const app = fastify()

  app.register(fastifyCookie, {
    secret: options.sharedPassword,
  })
  app.register(async (instance) => {
    await registerHealthRoutes(instance)
    await registerAuthRoutes(instance, { sharedPassword: options.sharedPassword })
    await registerMediaRoutes(instance, { readIndex: options.readIndex })
    await registerStreamRoutes(instance, {
      readIndex: options.readIndex,
      getDriveStream: options.getDriveStream,
    })
    await registerThumbnailRoutes(instance, {
      readIndex: options.readIndex,
      getDriveThumbnail: options.getDriveThumbnail,
    })
  })

  return app
}
