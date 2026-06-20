import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken } from '@/lib/notion-client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { id } = await params
    const token = getToken(body.token)

    const client = createNotionClient(token)
    const database = await client.getDatabase(id)

    return NextResponse.json({ database })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch database schema' },
      { status: 500 }
    )
  }
}
