import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken } from '@/lib/notion-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token: rawToken, databaseId, startCursor, pageSize, filter } = body
    const token = getToken(rawToken)

    if (!databaseId) {
      return NextResponse.json(
        { error: 'databaseId required' },
        { status: 400 }
      )
    }

    const client = createNotionClient(token)
    const results = await client.queryDatabase(databaseId, startCursor, pageSize, filter)

    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to query database' },
      { status: 500 }
    )
  }
}
