import { readFile } from 'node:fs/promises'
import { z } from 'zod'

import type { MediaIndex } from '../drive/types.js'

const mediaIndexSchema = z.object({
  generatedAt: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      mimeType: z.string(),
      modifiedTime: z.string(),
      size: z.string(),
      folderPath: z.string(),
      folderPathSegments: z.array(z.string()),
      kind: z.enum(['video', 'photo', 'other']),
      playbackMode: z.enum(['playable_in_browser', 'preview_only', 'unsupported']),
    }),
  ),
})

export async function readIndex(indexPath: string): Promise<MediaIndex> {
  const parsed = mediaIndexSchema.safeParse(JSON.parse(await readFile(indexPath, 'utf8')))

  if (!parsed.success) {
    throw new Error('Invalid media index')
  }

  return parsed.data
}
