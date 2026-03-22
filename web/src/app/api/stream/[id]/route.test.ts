import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from './route'

describe('stream proxy route', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes through stream status and allowed headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('video-bytes', {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-range': 'bytes 0-9/10',
          'cache-control': 'private, max-age=0',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const request = new NextRequest('http://localhost:3000/api/stream/video-1', {
      headers: {
        cookie: 'session=signed-session',
        range: 'bytes=0-9',
      },
    })

    const response = await GET(request, {
      params: Promise.resolve({ id: 'video-1' }),
    })

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4000/stream/video-1', {
      headers: expect.any(Headers),
      cache: 'no-store',
    })
    expect(response.status).toBe(206)
    expect(response.headers.get('content-type')).toBe('video/mp4')
    expect(response.headers.get('content-range')).toBe('bytes 0-9/10')
    await expect(response.text()).resolves.toBe('video-bytes')

    const proxiedHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers
    expect(proxiedHeaders.get('cookie')).toBe('session=signed-session')
    expect(proxiedHeaders.get('range')).toBe('bytes=0-9')
  })

  it('returns a controlled response when the backend fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')))

    const request = new NextRequest('http://localhost:3000/api/stream/video-1')
    const response = await GET(request, {
      params: Promise.resolve({ id: 'video-1' }),
    })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'Unable to reach stream service' })
  })
})
