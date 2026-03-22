import { notFound } from 'next/navigation'
import { getMediaById } from '@/lib/queries'
import { VideoPlayer } from '@/components/video-player'
import { formatSize } from '@/lib/format'
import Link from 'next/link'

type WatchPageProps = {
  params: Promise<{ id: string }>
}

function isH265(name: string): boolean {
  const lowerName = name.toLowerCase()
  return lowerName.endsWith('.hevc') || lowerName.includes('h265') || lowerName.includes('h.265')
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
  const media = await getMediaById(id)

  if (!media || media.type !== 'video') notFound()

  const h265Warning = isH265(media.name)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {media.folders?.path && (
        <Link
          href={`/folders/${media.folders.path}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to {media.folders.name}
        </Link>
      )}

      {h265Warning && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm">
          <p className="font-medium">This video may use H.265/HEVC encoding</p>
          <p className="text-muted-foreground mt-1">
            H.265 has limited browser support (Safari only). If playback fails, use the download button below.
          </p>
        </div>
      )}

      <VideoPlayer
        src={`/api/stream/${media.id}`}
        title={media.name}
        mediaId={media.id}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{media.name}</h1>
          {media.size && (
            <p className="text-sm text-muted-foreground">{formatSize(media.size)}</p>
          )}
        </div>
        <a
          href={`/api/stream/${media.id}`}
          download={media.name}
          className="text-sm text-primary hover:underline shrink-0"
        >
          Download
        </a>
      </div>
    </div>
  )
}
