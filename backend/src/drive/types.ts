export const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export type DriveFolderEntry = {
  id: string
  name: string
  mimeType: typeof DRIVE_FOLDER_MIME_TYPE
}

export type DriveFileEntry = {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  size?: string
}

export type DriveEntry = DriveFolderEntry | DriveFileEntry

export type MediaKind = 'video' | 'photo' | 'other'

export type PlaybackMode = 'playable_in_browser' | 'preview_only' | 'unsupported'

export type MediaClassification = {
  kind: MediaKind
  playbackMode: PlaybackMode
}

export type MediaIndexItem = DriveFileEntry & {
  modifiedTime: string
  size: string
  folderPath: string
  folderPathSegments: string[]
} & MediaClassification

export type MediaIndex = {
  generatedAt: string
  items: MediaIndexItem[]
}

export type ListFolder = (folderId: string) => Promise<unknown[]>
