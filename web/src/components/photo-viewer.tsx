'use client'

import { useState } from 'react'

type PhotoViewerProps = {
  src: string
  alt: string
}

export function PhotoViewer({ src, alt }: PhotoViewerProps) {
  const [zoomed, setZoomed] = useState(false)

  return (
    <div
      className="relative flex items-center justify-center bg-black rounded-lg overflow-hidden cursor-zoom-in min-h-[60vh]"
      onClick={() => setZoomed(!zoomed)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`max-h-[80vh] w-auto object-contain transition-transform ${zoomed ? 'scale-150 cursor-zoom-out' : ''}`}
      />
    </div>
  )
}
