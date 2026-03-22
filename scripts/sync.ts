// scripts/sync.ts
//
// Run with: npx tsx scripts/sync.ts
// Requires env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
//   GOOGLE_DRIVE_ROOT_FOLDER_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})
const drive = google.drive({ version: 'v3', auth })

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MEDIA_MIMES = [...VIDEO_MIMES, ...PHOTO_MIMES]

type FolderRecord = { id: string; name: string; parent_id: string | null; path: string; synced_at: string }
type MediaRecord = {
  id: string; name: string; folder_id: string | null; mime_type: string;
  type: 'video' | 'photo'; size: number | null; thumbnail_url: string | null;
  duration: number | null; created_at: string; synced_at: string;
}

const now = new Date().toISOString()
const allFolders: FolderRecord[] = []
const allMedia: MediaRecord[] = []

async function listAllFiles(folderId: string) {
  const files: any[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, thumbnailLink, videoMediaMetadata)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 1000,
      pageToken,
    })
    files.push(...(res.data.files ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}

async function downloadAndUploadThumbnail(fileId: string, thumbnailLink: string): Promise<string | null> {
  try {
    const url = thumbnailLink.replace(/=s\d+$/, '=s480')
    const token = await auth.getAccessToken()
    const res = await fetch(url, {
      headers: token.token ? { Authorization: `Bearer ${token.token}` } : {},
    })
    if (!res.ok) return null

    const buffer = Buffer.from(await res.arrayBuffer())
    const path = `thumbnails/${fileId}.jpg`

    const { error } = await supabase.storage
      .from('thumbnails')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

    if (error) { console.error(`Thumbnail upload failed for ${fileId}:`, error.message); return null }

    const { data } = supabase.storage.from('thumbnails').getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.error(`Thumbnail failed for ${fileId}:`, e)
    return null
  }
}

async function crawl(folderId: string, parentId: string | null, pathSegments: string[]) {
  const files = await listAllFiles(folderId)

  for (const file of files) {
    if (file.mimeType === FOLDER_MIME) {
      const folderPath = [...pathSegments, file.name].join('/')
      allFolders.push({ id: file.id, name: file.name, parent_id: parentId, path: folderPath, synced_at: now })
      await crawl(file.id, file.id, [...pathSegments, file.name])
    } else if (MEDIA_MIMES.includes(file.mimeType)) {
      const type = VIDEO_MIMES.includes(file.mimeType) ? 'video' : 'photo'
      const duration = file.videoMediaMetadata?.durationMillis
        ? parseInt(file.videoMediaMetadata.durationMillis)
        : null

      let thumbnailUrl: string | null = null
      if (file.thumbnailLink) {
        thumbnailUrl = await downloadAndUploadThumbnail(file.id, file.thumbnailLink)
      }

      allMedia.push({
        id: file.id,
        name: file.name,
        folder_id: parentId,
        mime_type: file.mimeType,
        type,
        size: file.size ? parseInt(file.size) : null,
        thumbnail_url: thumbnailUrl,
        duration,
        created_at: file.createdTime ?? now,
        synced_at: now,
      })
    }
  }
}

async function main() {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!
  console.log('Starting sync from root folder:', rootId)

  await crawl(rootId, null, [])

  console.log(`Found ${allFolders.length} folders, ${allMedia.length} media files`)

  // Upsert folders (parents first — sorted by path depth)
  const sortedFolders = allFolders.sort((a, b) => a.path.split('/').length - b.path.split('/').length)
  for (const batch of chunk(sortedFolders, 500)) {
    const { error } = await supabase.from('folders').upsert(batch, { onConflict: 'id' })
    if (error) console.error('Folder upsert error:', error.message)
  }

  // Upsert media
  for (const batch of chunk(allMedia, 500)) {
    const { error } = await supabase.from('media').upsert(batch, { onConflict: 'id' })
    if (error) console.error('Media upsert error:', error.message)
  }

  // Delete orphaned records
  const { count: deletedMedia } = await supabase
    .from('media')
    .delete({ count: 'exact' })
    .lt('synced_at', now)

  if (deletedMedia && deletedMedia > 0) {
    console.log(`Deleted ${deletedMedia} orphaned media records`)
  }

  const { count: deletedFolders } = await supabase
    .from('folders')
    .delete({ count: 'exact' })
    .lt('synced_at', now)

  if (deletedFolders && deletedFolders > 0) {
    console.log(`Deleted ${deletedFolders} orphaned folder records`)
  }

  console.log('Sync complete!')
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

main().catch((e) => { console.error(e); process.exit(1) })
