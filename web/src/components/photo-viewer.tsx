import React from 'react'

type PhotoViewerProps = {
  alt: string
  src: string
}

export function PhotoViewer({ alt, src }: PhotoViewerProps) {
  return (
    <img alt={alt} src={src} className="viewer-image" />
  )
}
