import type { Metadata } from 'next'
import { ClientShell } from '@/components/layout/ClientShell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Robin DLMM Dashboard',
  description: 'Monitoring dashboard for Robin DLMM DEX on Robinhood Chain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface text-text-primary antialiased">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  )
}
