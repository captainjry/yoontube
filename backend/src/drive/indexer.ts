import { z } from 'zod'

import { classifyMedia } from '../lib/classify-media.js'
import {
  DRIVE_FOLDER_MIME_TYPE,
  type DriveEntry,
  type DriveFileEntry,
  type ListFolder,
  type MediaIndex,
  type MediaIndexItem,
} from './types.js'

type BuildMediaIndexOptions = {
  rootFolderId: string
  listFolder: ListFolder
}

export async function buildMediaIndex({ rootFolderId, listFolder }: BuildMediaIndexOptions): Promise<MediaIndex> {
  const items = await collectFolderItems({
    folderId: rootFolderId,
    folderNames: [],
    listFolder,
  })

  return {
    generatedAt: new Date().toISOString(),
    items: sortMediaIndexItems(items),
  }
}

async function collectFolderItems({
  folderId,
  folderNames,
  listFolder,
}: {
  folderId: string
  folderNames: string[]
  listFolder: ListFolder
}): Promise<MediaIndexItem[]> {
  const entries = normalizeDriveEntries(await listFolder(folderId))
  const fileItems = entries.filter(isDriveFile).map((entry) => toMediaIndexItem(entry, folderNames))
  const folders = entries.filter(isDriveFolder)
  const nestedItems: MediaIndexItem[] = []

  for (const folder of folders) {
    const items = await collectFolderItems({
      folderId: folder.id,
      folderNames: [...folderNames, folder.name],
      listFolder,
    })

    nestedItems.push(...items)
  }

  return [...fileItems, ...nestedItems]
}

function isDriveFolder(entry: DriveEntry): entry is Extract<DriveEntry, { mimeType: typeof DRIVE_FOLDER_MIME_TYPE }> {
  return entry.mimeType === DRIVE_FOLDER_MIME_TYPE
}

function isDriveFile(entry: DriveEntry): entry is DriveFileEntry {
  return !isDriveFolder(entry)
}

function toMediaIndexItem(entry: DriveFileEntry, folderNames: string[]): MediaIndexItem {
  return {
    ...entry,
    modifiedTime: entry.modifiedTime ?? '',
    size: entry.size ?? '',
    folderPath: folderNames.join('/'),
    folderPathSegments: [...folderNames],
    ...classifyMedia(entry.name, entry.mimeType),
  }
}

function sortMediaIndexItems(items: MediaIndexItem[]): MediaIndexItem[] {
  return [...items].sort((left, right) => {
    const leftPath = left.folderPathSegments.join('\u0000')
    const rightPath = right.folderPathSegments.join('\u0000')

    if (leftPath !== rightPath) {
      return leftPath.localeCompare(rightPath)
    }

    if (left.name !== right.name) {
      return left.name.localeCompare(right.name)
    }

    return left.id.localeCompare(right.id)
  })
}

const driveFolderEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.literal(DRIVE_FOLDER_MIME_TYPE),
})

const driveFileEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.coerce.string().optional(),
  size: z.coerce.string().optional(),
})

function normalizeDriveEntries(entries: unknown[]): DriveEntry[] {
  const normalizedEntries: DriveEntry[] = []

  for (const entry of entries) {
    const folderResult = driveFolderEntrySchema.safeParse(entry)

    if (folderResult.success) {
      normalizedEntries.push(folderResult.data)
      continue
    }

    const fileResult = driveFileEntrySchema.safeParse(entry)

    if (fileResult.success) {
      normalizedEntries.push(fileResult.data)
    }

  }

  return normalizedEntries
}
