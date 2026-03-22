import { describe, expect, it, vi } from 'vitest'

import { buildApp } from '../src/app.js'
import type { MediaIndex } from '../src/drive/types.js'

function createPlayableIndex(): MediaIndex {
  return {
    generatedAt: 'now',
    items: [
      {
        id: 'video-1',
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        modifiedTime: 'now',
        size: '100',
        folderPath: '',
        folderPathSegments: [],
        kind: 'video',
        playbackMode: 'playable_in_browser',
      },
    ],
  }
}

async function authenticate(app: ReturnType<typeof buildApp>) {
  const auth = await app.inject({
    method: 'POST',
    url: '/auth/verify',
    payload: { password: 'secret' },
  })

  return auth.cookies.reduce<Record<string, string>>((acc, cookie) => {
    acc[cookie.name] = cookie.value
    return acc
  }, {})
}

describe('stream route', () => {
  it('proxies byte ranges for mp4 playback', async () => {
    const getDriveStream = vi.fn().mockResolvedValue({
      statusCode: 206,
      headers: {
        'accept-ranges': 'bytes',
        'cache-control': 'private, max-age=0',
        'content-type': 'video/mp4',
        'content-range': 'bytes 0-9/100',
        'x-goog-hash': 'not-forwarded',
      },
      body: Buffer.from('1234567890'),
    })

    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createPlayableIndex(),
      getDriveStream,
    })

    const cookies = await authenticate(app)

    const response = await app.inject({
      method: 'GET',
      url: '/stream/video-1',
      headers: { range: 'bytes=0-9' },
      cookies,
    })

    expect(response.statusCode).toBe(206)
    expect(response.headers['accept-ranges']).toBe('bytes')
    expect(response.headers['cache-control']).toBe('private, max-age=0')
    expect(response.headers['content-type']).toBe('video/mp4')
    expect(response.headers['content-range']).toBe('bytes 0-9/100')
    expect(response.headers['x-goog-hash']).toBeUndefined()
    expect(response.body).toBe('1234567890')
    expect(getDriveStream).toHaveBeenCalledWith('video-1', 'bytes=0-9')
  })

  it('rejects stream requests without a verified session cookie', async () => {
    const getDriveStream = vi.fn()
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createPlayableIndex(),
      getDriveStream,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/stream/video-1',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized' })
    expect(getDriveStream).not.toHaveBeenCalled()
  })

  it('rejects a forged verified session cookie', async () => {
    const getDriveStream = vi.fn()
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createPlayableIndex(),
      getDriveStream,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/stream/video-1',
      cookies: {
        session: 'verified',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'Unauthorized' })
    expect(getDriveStream).not.toHaveBeenCalled()
  })

  it('rejects ids that are not present in the current media index', async () => {
    const getDriveStream = vi.fn()
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createPlayableIndex(),
      getDriveStream,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/stream/missing-video',
      cookies: await authenticate(app),
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Media not found' })
    expect(getDriveStream).not.toHaveBeenCalled()
  })

  it('rejects indexed media that is not browser-playable', async () => {
    const getDriveStream = vi.fn()
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => ({
        generatedAt: 'now',
        items: [
          {
            id: 'image-1',
            name: 'photo.heic',
            mimeType: 'image/heic',
            modifiedTime: 'now',
            size: '100',
            folderPath: '',
            folderPathSegments: [],
            kind: 'photo',
            playbackMode: 'preview_only',
          },
        ],
      }),
      getDriveStream,
    })

    const response = await app.inject({
      method: 'GET',
      url: '/stream/image-1',
      cookies: await authenticate(app),
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Media not streamable' })
    expect(getDriveStream).not.toHaveBeenCalled()
  })

  it('returns a clear gateway error when the upstream stream fetch fails', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createPlayableIndex(),
      getDriveStream: vi.fn().mockRejectedValue(new Error('drive unavailable')),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/stream/video-1',
      cookies: await authenticate(app),
    })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toEqual({ error: 'Failed to stream media' })
  })

  it('returns a clear unavailable error when streaming is not configured', async () => {
    const app = buildApp({
      sharedPassword: 'secret',
      readIndex: async () => createPlayableIndex(),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/stream/video-1',
      cookies: await authenticate(app),
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ error: 'Streaming is unavailable' })
  })
})
