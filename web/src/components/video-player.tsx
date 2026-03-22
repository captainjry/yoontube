'use client'

import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default'
import { useEffect, useRef } from 'react'
import type { MediaPlayerInstance } from '@vidstack/react'

type VideoPlayerProps = {
  src: string
  title: string
  mediaId: string
}

const STORAGE_KEY_PREFIX = 'yoontube-resume-'

export function VideoPlayer({ src, title, mediaId }: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null)

  // Resume playback from localStorage
  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const savedTime = localStorage.getItem(`${STORAGE_KEY_PREFIX}${mediaId}`)
    if (savedTime) {
      const time = parseFloat(savedTime)
      if (time > 0) {
        player.currentTime = time
      }
    }

    // Save position periodically
    const interval = setInterval(() => {
      if (player.currentTime > 0) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${mediaId}`, String(player.currentTime))
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [mediaId])

  return (
    <MediaPlayer
      ref={playerRef}
      title={title}
      src={src}
      crossOrigin
      playsInline
      keyShortcuts={{
        togglePaused: 'k Space',
        toggleMuted: 'm',
        toggleFullscreen: 'f',
        togglePictureInPicture: 'i',
        seekBackward: ['j', 'ArrowLeft'],
        seekForward: ['l', 'ArrowRight'],
        volumeUp: 'ArrowUp',
        volumeDown: 'ArrowDown',
        speedUp: '>',
        slowDown: '<',
      }}
      className="w-full aspect-video bg-black rounded-lg overflow-hidden"
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  )
}
