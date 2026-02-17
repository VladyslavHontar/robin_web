import type { Metadata } from 'next'
import { Nav } from '@/components/layout/Nav'
import { Web3Provider } from '@/providers/Web3Provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Robin DLMM Dashboard',
  description: 'Monitoring dashboard for Robin DLMM DEX on Robinhood Chain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        <Web3Provider>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </Web3Provider>
      </body>
    </html>
  )
}
