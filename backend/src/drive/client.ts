import { google } from 'googleapis'

import type { ListFolder } from './types.js'

type DriveStreamResponse = {
  statusCode: number
  headers: Record<string, string>
  body: Buffer | NodeJS.ReadableStream
}

type CreateDriveClientOptions = {
  clientEmail: string
  privateKey: string
  listFiles?: (parameters: {
    q: string
    fields: string
    includeItemsFromAllDrives: boolean
    supportsAllDrives: boolean
    pageSize: number
    pageToken?: string
  }) => Promise<{
    data: {
      files?: Array<{
        id?: string | null
        name?: string | null
        mimeType?: string | null
        modifiedTime?: string | null
        size?: string | null
      }>
      nextPageToken?: string | null
    }
  }>
  getFileStream?: (fileId: string, range?: string) => Promise<{
    status: number
    headers: Record<string, string | undefined>
    data: Buffer | NodeJS.ReadableStream
  }>
}

export function createDriveClient({ clientEmail, privateKey, listFiles, getFileStream }: CreateDriveClientOptions): {
  listFolder: ListFolder
  getDriveStream: (fileId: string, range?: string) => Promise<DriveStreamResponse>
  getDriveThumbnail: (fileId: string) => Promise<DriveStreamResponse>
} {
  const resolvedListFiles = listFiles ?? createGoogleListFiles({ clientEmail, privateKey })
  const resolvedGetFileStream = getFileStream ?? createGoogleGetFileStream({ clientEmail, privateKey })

  return {
    async listFolder(folderId) {
      const entries: unknown[] = []
      let pageToken: string | undefined

      do {
        const response = await resolvedListFiles({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          pageSize: 1000,
          pageToken,
        })

        entries.push(...(response.data.files ?? []).map(toDriveEntry))
        pageToken = response.data.nextPageToken ?? undefined
      } while (pageToken)

      return entries
    },
    async getDriveThumbnail(fileId) {
      const resolvedGetThumbnail = createGoogleGetThumbnail({ clientEmail, privateKey })
      return resolvedGetThumbnail(fileId)
    },
    async getDriveStream(fileId, range) {
      const response = await resolvedGetFileStream(fileId, range)

      return {
        statusCode: response.status,
        headers: Object.fromEntries(
          Object.entries(response.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        ),
        body: response.data,
      }
    },
  }
}

function createGoogleListFiles({ clientEmail, privateKey }: Pick<CreateDriveClientOptions, 'clientEmail' | 'privateKey'>) {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  const drive = google.drive({ version: 'v3', auth })

  return drive.files.list.bind(drive.files)
}

function createGoogleGetFileStream({ clientEmail, privateKey }: Pick<CreateDriveClientOptions, 'clientEmail' | 'privateKey'>) {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  const drive = google.drive({ version: 'v3', auth })

  return async (fileId: string, range?: string) => {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      {
        responseType: 'stream',
        headers: range ? { Range: range } : undefined,
      },
    )

    return {
      status: response.status,
      headers: extractHeaders(response.headers),
      data: response.data,
    }
  }
}

const HEADER_NAMES_TO_EXTRACT = ['accept-ranges', 'cache-control', 'content-length', 'content-range', 'content-type']

function extractHeaders(raw: unknown): Record<string, string> {
  const headers: Record<string, string> = {}

  if (!raw || typeof raw !== 'object') {
    return headers
  }

  for (const name of HEADER_NAMES_TO_EXTRACT) {
    let value: unknown

    // Headers object (from googleapis/fetch) — use .get()
    if (typeof (raw as Headers).get === 'function') {
      value = (raw as Headers).get(name)
    } else {
      // Plain object
      value = (raw as Record<string, unknown>)[name]
    }

    if (typeof value === 'string') {
      headers[name] = value
    }
  }

  return headers
}

function createGoogleGetThumbnail({ clientEmail, privateKey }: Pick<CreateDriveClientOptions, 'clientEmail' | 'privateKey'>) {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  const drive = google.drive({ version: 'v3', auth })

  return async (fileId: string): Promise<DriveStreamResponse> => {
    // First get the file metadata to find thumbnailLink
    const meta = await drive.files.get({
      fileId,
      fields: 'thumbnailLink, mimeType',
    })

    const thumbnailLink = meta.data.thumbnailLink

    if (thumbnailLink) {
      // Fetch the thumbnail image (replace default size with larger)
      const thumbnailUrl = thumbnailLink.replace(/=s\d+$/, '=s480')
      const accessToken = await auth.getAccessToken()

      const response = await fetch(thumbnailUrl, {
        headers: accessToken.token ? { Authorization: `Bearer ${accessToken.token}` } : {},
      })

      return {
        statusCode: response.status,
        headers: {
          'content-type': response.headers.get('content-type') ?? 'image/jpeg',
        },
        body: Buffer.from(await response.arrayBuffer()),
      }
    }

    // Fallback: stream the file itself (works for images)
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' },
    )

    return {
      statusCode: response.status,
      headers: {
        'content-type': (meta.data.mimeType as string) ?? 'application/octet-stream',
      },
      body: response.data,
    }
  }
}

function toDriveEntry(file: {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  modifiedTime?: string | null
  size?: string | null
}) {
  const entry = {
    id: file.id ?? undefined,
    name: file.name ?? undefined,
    mimeType: file.mimeType ?? undefined,
  }

  if (file.mimeType === 'application/vnd.google-apps.folder') {
    return entry
  }

  return {
    ...entry,
    modifiedTime: file.modifiedTime ?? undefined,
    size: file.size ?? undefined,
  }
}
