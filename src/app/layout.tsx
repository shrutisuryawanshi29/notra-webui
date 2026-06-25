import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { CacheProvider } from '@/hooks/use-notra-cache'
import Nav from '@/components/Nav'

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
})

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
      <body className={`min-h-full ${manrope.className}`}>
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
