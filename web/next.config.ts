import type { NextConfig } from 'next'
import { resolve } from 'path'

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(__dirname),
  transpilePackages: ['@vidstack/react'],
  serverExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
