import { fileURLToPath } from 'node:url'

import { loadConfig } from './config.js'
import { buildApp } from './app.js'
import { createDriveClient } from './drive/client.js'
import { readIndex } from './lib/read-index.js'

const indexPath = fileURLToPath(new URL('../data/media-index.json', import.meta.url))

export function createServer(env: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(env)
  const driveClient = createDriveClient({
    clientEmail: config.googleClientEmail,
    privateKey: config.googlePrivateKey,
  })

  return {
    app: buildApp({
      sharedPassword: config.sharedPassword,
      readIndex: () => readIndex(indexPath),
      getDriveStream: driveClient.getDriveStream,
      getDriveThumbnail: driveClient.getDriveThumbnail,
    }),
    port: config.port,
  }
}

export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  const { app, port } = createServer(env)
  await app.listen({ host: '0.0.0.0', port })
}

await startServer()
