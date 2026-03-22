import React from 'react'

type VideoPlayerProps = {
  title: string
  src: string
}

export function VideoPlayer({ title, src }: VideoPlayerProps) {
  return (
    <video controls preload="metadata" role="video" aria-label={title} src={src} className="viewer-video" />
  )
}
