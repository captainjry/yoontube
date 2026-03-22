import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { resolveOutputPathFromUrl, syncDriveIndex } from '../src/jobs/sync-drive-index.js'

describe('syncDriveIndex', () => {
  it('decodes file URLs into filesystem paths', () => {
    const fileUrl = new URL('file:///tmp/yoontube%20sync/media-index.json')

    expect(resolveOutputPathFromUrl(fileUrl)).toBe(fileURLToPath(fileUrl))
  })

  it('writes the generated index to disk', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'yoontube-sync-'))
    const outputPath = join(tempDir, 'data', 'media-index.json')

    await syncDriveIndex({
      rootFolderId: 'root',
      listFolder: async () => [
        { id: 'video-1', name: 'clip.mp4', mimeType: 'video/mp4', modifiedTime: '2026-03-01T00:00:00.000Z', size: '10' },
      ],
      resolveOutputPath: () => outputPath,
    })

    const written = JSON.parse(await readFile(outputPath, 'utf8'))

    expect(outputPath).toContain('media-index.json')
    expect(written).toMatchObject({
      items: [
        {
          id: 'video-1',
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          modifiedTime: '2026-03-01T00:00:00.000Z',
          size: '10',
          folderPath: '',
          folderPathSegments: [],
          kind: 'video',
          playbackMode: 'playable_in_browser',
        },
      ],
    })
    expect(written.generatedAt).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})
