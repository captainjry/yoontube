import type { MediaClassification } from '../drive/types.js'

const previewOnlyPhotoExtensions = new Set(['cr2', 'heic'])
const browserPlayableImageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'])
const browserPlayableImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
])

export function classifyMedia(name: string, mimeType: string): MediaClassification {
  const extension = getExtension(name)

  if (extension === 'mp4' && mimeType === 'video/mp4') {
    return {
      kind: 'video',
      playbackMode: 'playable_in_browser',
    }
  }

  if (previewOnlyPhotoExtensions.has(extension) && mimeType.startsWith('image/')) {
    return {
      kind: 'photo',
      playbackMode: 'preview_only',
    }
  }

  if (browserPlayableImageExtensions.has(extension) && browserPlayableImageMimeTypes.has(mimeType)) {
    return {
      kind: 'photo',
      playbackMode: 'playable_in_browser',
    }
  }

  if (mimeType.startsWith('image/')) {
    return {
      kind: 'photo',
      playbackMode: 'preview_only',
    }
  }

  return {
    kind: 'other',
    playbackMode: 'unsupported',
  }
}

function getExtension(name: string): string {
  const lastDotIndex = name.lastIndexOf('.')

  if (lastDotIndex === -1) {
    return ''
  }

  return name.slice(lastDotIndex + 1).toLowerCase()
}
