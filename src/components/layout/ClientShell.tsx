'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { TxToastProvider } from '@/components/shared/TxToastProvider'

const Web3Provider = dynamic(
  () => import('@/providers/Web3Provider').then((m) => m.Web3Provider),
  { ssr: false },
)
const Nav = dynamic(
  () => import('@/components/layout/Nav').then((m) => m.Nav),
  { ssr: false },
)

export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <Web3Provider>
      <TxToastProvider>
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </TxToastProvider>
    </Web3Provider>
  )
}
