import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const requiredEnv = {
  DRIVE_ROOT_FOLDER_ID: 'folder123',
  SHARED_PASSWORD: 'secret',
  GOOGLE_CLIENT_EMAIL: 'bot@example.com',
  GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
}

describe('loadConfig', () => {
  it('parses required environment values', () => {
    const config = loadConfig({
      PORT: '4000',
      ...requiredEnv,
    })

    expect(config.port).toBe(4000)
    expect(config.driveRootFolderId).toBe('folder123')
    expect(config.sharedPassword).toBe('secret')
    expect(config.googleClientEmail).toBe('bot@example.com')
    expect(config.googlePrivateKey).toBe('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----')
  })

  it('defaults port to 4000 when PORT is missing', () => {
    const config = loadConfig(requiredEnv)

    expect(config.port).toBe(4000)
  })

  it('rejects a port outside the valid range', () => {
    expect(() =>
      loadConfig({
        PORT: '70000',
        ...requiredEnv,
      }),
    ).toThrow()
  })
})
