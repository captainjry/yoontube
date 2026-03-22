import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMediaIndexFromBackend, verifyPasswordWithBackend } from './backend'

describe('verifyPasswordWithBackend', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a controlled error when the backend request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    )

    await expect(verifyPasswordWithBackend('secret')).resolves.toEqual({
      ok: false,
      error: 'Unable to reach auth service',
    })
  })
})

describe('getMediaIndexFromBackend', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('filters unsupported items while keeping supported media in the payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          items: [
            {
              id: 'video-1',
              kind: 'video',
              title: 'Playable clip',
              folderPath: 'Trips/2026',
              folderPathSegments: ['Trips', '2026'],
            },
            {
              id: 'other-1',
              kind: 'other',
              title: 'Unsupported file',
            },
          ],
        }),
      }),
    )

    await expect(getMediaIndexFromBackend('session=signed')).resolves.toEqual([
      {
        id: 'video-1',
        kind: 'video',
        title: 'Playable clip',
        mimeType: undefined,
        playbackMode: undefined,
        folderPath: 'Trips/2026',
        folderPathSegments: ['Trips', '2026'],
      },
    ])
  })

  it('throws when the backend media payload is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ items: [{ id: 'broken-1', kind: 'gif', title: 'Broken item' }] }),
      }),
    )

    await expect(getMediaIndexFromBackend('session=signed')).rejects.toThrow('Invalid media index payload')
  })
})
