import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { getAllPools, addPool } from '@/lib/db'

export async function GET() {
  const pools = getAllPools()
  return NextResponse.json(pools)
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { pairAddress, tokenX, tokenY, binStep } = body as Record<string, unknown>

  if (
    typeof pairAddress !== 'string' || !isAddress(pairAddress) ||
    typeof tokenX !== 'string' || !isAddress(tokenX) ||
    typeof tokenY !== 'string' || !isAddress(tokenY) ||
    typeof binStep !== 'number' || !Number.isInteger(binStep) || binStep <= 0 || binStep > 10_000
  ) {
    return NextResponse.json({ error: 'Invalid fields' }, { status: 400 })
  }

  const pool = addPool(pairAddress, tokenX, tokenY, binStep)
  return NextResponse.json(pool, { status: 201 })
}
