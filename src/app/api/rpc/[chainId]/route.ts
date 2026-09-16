import { NextResponse } from 'next/server'
import { supportedChains } from '@/config/chains'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chainId: string }> },
) {
  const { chainId } = await params
  const id = parseInt(chainId, 10)
  const chain = supportedChains.find((c) => c.id === id)

  if (!chain) {
    return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 })
  }

  const rpcUrl = chain.rpcUrls.default.http[0]
  const body = await request.json()

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data)
}
