import { google } from 'googleapis'

const PROXIED_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-length',
  'content-range',
  'content-type',
]

export function extractProxyHeaders(source: Headers): Headers {
  const headers = new Headers()
  for (const name of PROXIED_HEADERS) {
    const value = source.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}

function createDriveAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: createDriveAuth() })
}

export async function getDriveFileStream(fileId: string, range?: string) {
  const drive = getDriveClient()

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    {
      responseType: 'stream',
      headers: range ? { Range: range } : undefined,
    }
  )

  return {
    status: response.status,
    headers: response.headers,
    data: response.data as NodeJS.ReadableStream,
  }
}

export async function getDriveFileMeta(fileId: string) {
  const drive = getDriveClient()

  const response = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, thumbnailLink, videoMediaMetadata, imageMediaMetadata, createdTime',
  })

  return response.data
}

export async function getDriveThumbnail(fileId: string) {
  const drive = getDriveClient()
  const auth = createDriveAuth()

  const meta = await drive.files.get({
    fileId,
    fields: 'thumbnailLink, mimeType',
  })

  const thumbnailLink = meta.data.thumbnailLink

  if (thumbnailLink) {
    const thumbnailUrl = thumbnailLink.replace(/=s\d+$/, '=s480')
    const accessToken = await auth.getAccessToken()

    const response = await fetch(thumbnailUrl, {
      headers: accessToken.token ? { Authorization: `Bearer ${accessToken.token}` } : {},
    })

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? 'image/jpeg',
      body: Buffer.from(await response.arrayBuffer()),
    }
  }

  return null
}

export async function listDriveFolder(folderId: string) {
  const drive = getDriveClient()
  const entries: Array<{
    id: string
    name: string
    mimeType: string
    size?: string
    createdTime?: string
    thumbnailLink?: string
    videoMediaMetadata?: { durationMillis?: string }
  }> = []

  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, thumbnailLink, videoMediaMetadata)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 1000,
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      if (file.id && file.name && file.mimeType) {
        entries.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ?? undefined,
          createdTime: file.createdTime ?? undefined,
          thumbnailLink: file.thumbnailLink ?? undefined,
          videoMediaMetadata: file.videoMediaMetadata
            ? { durationMillis: String(file.videoMediaMetadata.durationMillis ?? '') }
            : undefined,
        })
      }
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return entries
}
