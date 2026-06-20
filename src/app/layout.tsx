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
      <body className="min-h-full flex">
        <CacheProvider>
          <Nav />
          <main className="flex-1 bg-[#2B241E] min-h-screen pb-20 md:pb-0">
            {children}
          </main>
        </CacheProvider>
      </body>
    </html>
  )
}
