import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'

import { buildMediaIndex } from '../src/drive/indexer.js'
import { writeIndex } from '../src/lib/write-index.js'

describe('buildMediaIndex', () => {
  it('flattens nested folders and classifies media', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async (folderId) => {
        if (folderId === 'root') {
          return [
            { id: 'folder-a', name: 'Trips', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'video-1', name: 'clip.mp4', mimeType: 'video/mp4', modifiedTime: '2026-03-01T00:00:00.000Z', size: '10' },
          ]
        }

        return [
          { id: 'raw-1', name: 'frame.cr2', mimeType: 'image/x-canon-cr2', modifiedTime: '2026-03-01T00:00:00.000Z', size: '20' },
        ]
      },
    })

    expect(index.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(index.items).toHaveLength(2)
    expect(index.items[0]).toMatchObject({
      id: 'video-1',
      folderPath: '',
      kind: 'video',
      playbackMode: 'playable_in_browser',
    })
    expect(index.items[1]).toMatchObject({
      id: 'raw-1',
      folderPath: 'Trips',
      kind: 'photo',
      playbackMode: 'preview_only',
    })
  })

  it('marks browser-playable images and preview-only formats', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'image-1', name: 'cover.jpg', mimeType: 'image/jpeg', modifiedTime: '2026-03-01T00:00:00.000Z', size: '5' },
        { id: 'image-2', name: 'portrait.heic', mimeType: 'image/heic', modifiedTime: '2026-03-01T00:00:00.000Z', size: '6' },
      ],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-1',
        kind: 'photo',
        playbackMode: 'playable_in_browser',
      }),
      expect.objectContaining({
        id: 'image-2',
        kind: 'photo',
        playbackMode: 'preview_only',
      }),
    ])
  })

  it('uses preview-only for non-standard image formats', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'image-3', name: 'scan.tiff', mimeType: 'image/tiff', modifiedTime: '2026-03-01T00:00:00.000Z', size: '7' },
      ],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-3',
        kind: 'photo',
        playbackMode: 'preview_only',
      }),
    ])
  })

  it('does not trust a browser-playable extension when mime type is non-standard', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'image-4', name: 'fake.jpg', mimeType: 'image/tiff', modifiedTime: '2026-03-01T00:00:00.000Z', size: '8' },
      ],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-4',
        kind: 'photo',
        playbackMode: 'preview_only',
      }),
    ])
  })

  it('does not trust an mp4 extension when mime type disagrees', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'video-2', name: 'fake.mp4', mimeType: 'application/octet-stream', modifiedTime: '2026-03-01T00:00:00.000Z', size: '9' },
      ],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'video-2',
        kind: 'other',
        playbackMode: 'unsupported',
      }),
    ])
  })

  it('preserves exact folder segments alongside the joined folder path', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async (folderId) => {
        if (folderId === 'root') {
          return [{ id: 'folder-a', name: 'Trips/2026', mimeType: 'application/vnd.google-apps.folder' }]
        }

        return [
          { id: 'image-5', name: 'cover.jpg', mimeType: 'image/jpeg', modifiedTime: '2026-03-01T00:00:00.000Z', size: '10' },
        ]
      },
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-5',
        folderPath: 'Trips/2026',
        folderPathSegments: ['Trips/2026'],
      }),
    ])
  })

  it('sorts indexed items into a stable order before returning', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async (folderId) => {
        if (folderId === 'root') {
          return [
            { id: 'folder-b', name: 'B', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'video-3', name: 'zeta.mp4', mimeType: 'video/mp4', modifiedTime: '2026-03-01T00:00:00.000Z', size: '11' },
            { id: 'folder-a', name: 'A', mimeType: 'application/vnd.google-apps.folder' },
          ]
        }

        if (folderId === 'folder-a') {
          return [
            { id: 'image-6', name: 'beta.jpg', mimeType: 'image/jpeg', modifiedTime: '2026-03-01T00:00:00.000Z', size: '12' },
          ]
        }

        return [
          { id: 'image-7', name: 'alpha.jpg', mimeType: 'image/jpeg', modifiedTime: '2026-03-01T00:00:00.000Z', size: '13' },
        ]
      },
    })

    expect(index.items.map((item) => item.id)).toEqual(['video-3', 'image-6', 'image-7'])
  })

  it('walks folders without unbounded concurrent list calls', async () => {
    let inFlight = 0
    let maxInFlight = 0

    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async (folderId) => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)

        await Promise.resolve()

        inFlight -= 1

        if (folderId === 'root') {
          return [
            { id: 'folder-a', name: 'A', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'folder-b', name: 'B', mimeType: 'application/vnd.google-apps.folder' },
          ]
        }

        return [
          { id: `file-${folderId}`, name: `${folderId}.jpg`, mimeType: 'image/jpeg', modifiedTime: '2026-03-01T00:00:00.000Z', size: '14' },
        ]
      },
    })

    expect(index.items).toHaveLength(2)
    expect(maxInFlight).toBe(1)
  })

  it('fills missing file metadata with empty strings', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [{ id: 'image-8', name: 'cover.jpg', mimeType: 'image/jpeg' }],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-8',
        modifiedTime: '',
        size: '',
      }),
    ])
  })

  it('skips malformed entries before indexing valid files', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'broken-folder', mimeType: 'application/vnd.google-apps.folder' },
        { id: 'broken-file', name: 42, mimeType: 'image/jpeg' },
        { id: 'image-9', name: 'cover.jpg', mimeType: 'image/jpeg', modifiedTime: '2026-03-01T00:00:00.000Z', size: '15' },
      ],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-9',
        name: 'cover.jpg',
      }),
    ])
  })

  it('coerces partial raw file metadata to strings at the indexer boundary', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'image-10', name: 'cover.jpg', mimeType: 'image/jpeg', modifiedTime: 1709251200000, size: 16 },
      ],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-10',
        modifiedTime: '1709251200000',
        size: '16',
      }),
    ])
  })

  it('does not trust preview-only photo extensions when mime type is not an image', async () => {
    const index = await buildMediaIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'image-11', name: 'fake.heic', mimeType: 'application/octet-stream', modifiedTime: '2026-03-01T00:00:00.000Z', size: '17' },
      ],
    })

    expect(index.items).toEqual([
      expect.objectContaining({
        id: 'image-11',
        kind: 'other',
        playbackMode: 'unsupported',
      }),
    ])
  })
})

describe('writeIndex', () => {
  it('writes through a temp file before renaming into place', async () => {
    const mkdir = vi.fn()
    const writeFile = vi.fn()
    const rename = vi.fn()
    const outputPath = '/tmp/media-index.json'
    const index = {
      generatedAt: '2026-03-01T00:00:00.000Z',
      items: [],
    }

    await writeIndex(outputPath, index, { mkdir, writeFile, rename })

    expect(mkdir).toHaveBeenCalledWith('/tmp', { recursive: true })
    expect(writeFile).toHaveBeenCalledOnce()
    expect(writeFile.mock.calls[0][0]).toBe('/tmp/media-index.json.tmp')
    expect(rename).toHaveBeenCalledOnce()
    expect(rename).toHaveBeenCalledWith('/tmp/media-index.json.tmp', outputPath)
  })

  it('writes index json for later sync usage', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'yoontube-index-'))
    const outputPath = join(tempDir, 'index.json')
    const index = {
      generatedAt: '2026-03-01T00:00:00.000Z',
      items: [
        {
          id: 'video-1',
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          modifiedTime: '2026-03-01T00:00:00.000Z',
          size: '10',
          folderPath: '',
          folderPathSegments: [],
          kind: 'video' as const,
          playbackMode: 'playable_in_browser' as const,
        },
      ],
    }

    await writeIndex(outputPath, index)

    await expect(readFile(outputPath, 'utf8')).resolves.toBe(`${JSON.stringify(index, null, 2)}\n`)
  })
})
