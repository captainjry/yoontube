import { describe, expect, it, vi } from 'vitest'

import { createDriveClient } from '../src/drive/client.js'

describe('createDriveClient', () => {
  it('maps Google Drive API files into plain raw entries', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'folder-1',
              name: 'Trips',
              mimeType: 'application/vnd.google-apps.folder',
              modifiedTime: '2026-03-01T00:00:00.000Z',
              size: '0',
              kind: 'drive#file',
              owners: [{ displayName: 'ignored' }],
            },
          ],
          nextPageToken: 'next-page',
        },
      })
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'clip.mp4',
              mimeType: 'video/mp4',
              modifiedTime: '2026-03-02T00:00:00.000Z',
              size: '10',
              webViewLink: 'https://example.com/ignored',
            },
          ],
        },
      })

    const client = createDriveClient({
      clientEmail: 'service@example.com',
      privateKey: 'secret',
      listFiles: list,
    })

    await expect(client.listFolder('root')).resolves.toEqual([
      {
        id: 'folder-1',
        name: 'Trips',
        mimeType: 'application/vnd.google-apps.folder',
      },
      {
        id: 'file-1',
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        modifiedTime: '2026-03-02T00:00:00.000Z',
        size: '10',
      },
    ])
  })

  it('forwards file id and byte range when requesting a stream', async () => {
    const getFileStream = vi.fn().mockResolvedValue({
      status: 206,
      headers: {
        'content-type': 'video/mp4',
        'content-range': 'bytes 0-9/100',
      },
      data: Buffer.from('1234567890'),
    })

    const client = createDriveClient({
      clientEmail: 'service@example.com',
      privateKey: 'secret',
      listFiles: vi.fn(),
      getFileStream,
    })

    await expect(client.getDriveStream('video-1', 'bytes=0-9')).resolves.toEqual({
      statusCode: 206,
      headers: {
        'content-type': 'video/mp4',
        'content-range': 'bytes 0-9/100',
      },
      body: Buffer.from('1234567890'),
    })

    expect(getFileStream).toHaveBeenCalledWith('video-1', 'bytes=0-9')
  })
})
