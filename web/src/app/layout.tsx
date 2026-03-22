import type { Metadata } from 'next'
import { NavBar } from '@/components/nav-bar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yoontube',
  description: 'Private media gallery',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
