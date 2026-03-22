import { getMediaIndexFromBackend } from './backend'
import type { MediaItem, MediaKind } from './types'

export async function getMediaDetailItem(sessionCookieHeader: string | undefined, id: string, kind: MediaKind) {
  const items = await getMediaIndexFromBackend(sessionCookieHeader)

  return items.find((candidate): candidate is MediaItem => candidate.id === id && candidate.kind === kind) ?? null
}

export function getDriveViewUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/view`
}

export function getDriveDownloadUrl(id: string) {
  return `https://drive.google.com/uc?export=download&id=${id}`
}
