import type { Metadata } from 'next'
import './globals.css'
import { CacheProvider } from '@/hooks/use-notra-cache'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  title: 'Notra — Finance Tracker',
  description: 'Track expenses and income with Notion',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <CacheProvider>
          <Nav />
          <main className="min-h-screen">
            {children}
          </main>
        </CacheProvider>
      </body>
    </html>
  )
}
