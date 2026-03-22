import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadConfig } from '../config.js'
import { createDriveClient } from '../drive/client.js'
import { buildMediaIndex } from '../drive/indexer.js'
import type { ListFolder, MediaIndex } from '../drive/types.js'
import { writeIndex } from '../lib/write-index.js'

const DEFAULT_OUTPUT_PATH = new URL('../../data/media-index.json', import.meta.url)

export function resolveOutputPathFromUrl(fileUrl: URL | string): string {
  return fileURLToPath(fileUrl)
}

type SyncDriveIndexOptions = {
  rootFolderId: string
  listFolder: ListFolder
  outputPath?: string
  resolveOutputPath?: () => string
  writeFile?: (path: string, contents: string, encoding: 'utf8') => Promise<unknown> | unknown
}

export async function syncDriveIndex({
  rootFolderId,
  listFolder,
  outputPath,
  resolveOutputPath = () => resolveOutputPathFromUrl(DEFAULT_OUTPUT_PATH),
  writeFile,
}: SyncDriveIndexOptions): Promise<MediaIndex> {
  const index = await buildMediaIndex({ rootFolderId, listFolder })
  const resolvedOutputPath = outputPath ?? resolveOutputPath()

  await writeIndex(resolvedOutputPath, index, { writeFile })

  return index
}

export async function runSyncDriveIndexCli(): Promise<void> {
  const config = loadConfig(process.env)
  const driveClient = createDriveClient({
    clientEmail: config.googleClientEmail,
    privateKey: config.googlePrivateKey,
  })

  await syncDriveIndex({
    rootFolderId: config.driveRootFolderId,
    listFolder: driveClient.listFolder,
  })

  process.stdout.write(`Wrote media index to ${resolveOutputPathFromUrl(DEFAULT_OUTPUT_PATH)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runSyncDriveIndexCli()
}
