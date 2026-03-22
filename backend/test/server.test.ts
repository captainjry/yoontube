import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'

import { buildApp } from '../src/app.js'
import type { MediaIndex } from '../src/drive/types.js'
import { readIndex } from '../src/lib/read-index.js'

function createIndex(): MediaIndex {
  return {
    generatedAt: 'now',
    items: [
      {
        id: '1',
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        modifiedTime: 'now',
        size: '1',
        folderPath: '',
        folderPathSegments: [],
        kind: 'video',
        playbackMode: 'playable_in_browser',
      },
    ],
  }
}

describe('buildApp', () => {
  it('returns indexed items after password verification', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createIndex(),
    })

    const auth = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { password: 'secret' },
    })

    expect(auth.statusCode).toBe(204)

    const media = await app.inject({
      method: 'GET',
      url: '/media',
      cookies: auth.cookies.reduce<Record<string, string>>((acc, cookie) => {
        acc[cookie.name] = cookie.value
        return acc
      }, {}),
    })

    expect(media.statusCode).toBe(200)
    expect(media.json()).toEqual({
      generatedAt: 'now',
      items: [
        {
          id: '1',
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          modifiedTime: 'now',
          size: '1',
          folderPath: '',
          folderPathSegments: [],
          kind: 'video',
          playbackMode: 'playable_in_browser',
        },
      ],
    })
  })

  it('rejects media requests without a verified session cookie', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => ({ generatedAt: 'now', items: [] }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/media',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects a forged session cookie that was not issued by the server', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createIndex(),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/media',
      cookies: {
        session: 'verified',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('rejects an incorrect password without setting a session cookie', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => ({ generatedAt: 'now', items: [] }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { password: 'wrong' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.cookies).toHaveLength(0)
    expect(response.json()).toEqual({ error: 'Invalid password' })
  })

  it('rejects invalid auth payloads before checking the password', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => ({ generatedAt: 'now', items: [] }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({ error: 'Password is required' })
  })

  it('returns an intentional error when the media index cannot be loaded', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => {
        throw new Error('bad index')
      },
    })

    const auth = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: { password: 'secret' },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/media',
      cookies: auth.cookies.reduce<Record<string, string>>((acc, cookie) => {
        acc[cookie.name] = cookie.value
        return acc
      }, {}),
    })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({ error: 'Failed to load media index' })
  })

  it('reports health', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => ({ generatedAt: 'now', items: [] }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })
})

describe('readIndex', () => {
  it('loads the media index json from disk', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'yoontube-read-index-'))
    const indexPath = join(tempDir, 'media-index.json')

    await writeFile(
      indexPath,
      `${JSON.stringify(createIndex(), null, 2)}\n`,
      'utf8',
    )

    await expect(readIndex(indexPath)).resolves.toEqual(createIndex())
  })

  it('rejects malformed media index json shape', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'yoontube-read-index-'))
    const indexPath = join(tempDir, 'media-index.json')

    await writeFile(
      indexPath,
      `${JSON.stringify({ generatedAt: 'now', items: [{ id: '1' }] }, null, 2)}\n`,
      'utf8',
    )

    await expect(readIndex(indexPath)).rejects.toThrow('Invalid media index')
  })
})
