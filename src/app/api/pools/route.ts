import { NextResponse } from 'next/server'
import { getAllPools, addPool } from '@/lib/db'

export async function GET() {
  const pools = getAllPools()
  return NextResponse.json(pools)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { pairAddress, tokenX, tokenY, binStep } = body

  if (!pairAddress || !tokenX || !tokenY || binStep == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const pool = addPool(pairAddress, tokenX, tokenY, binStep)
  return NextResponse.json(pool, { status: 201 })
}
