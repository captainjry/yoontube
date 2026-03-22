import { notFound } from 'next/navigation'
import { getMediaById } from '@/lib/queries'
import { PhotoViewer } from '@/components/photo-viewer'
import Link from 'next/link'

type PhotoPageProps = {
  params: Promise<{ id: string }>
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params
  const media = await getMediaById(id)

  if (!media || media.type !== 'photo') notFound()

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

      <PhotoViewer
        src={`/api/stream/${media.id}`}
        alt={media.name}
      />

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-bold">{media.name}</h1>
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
