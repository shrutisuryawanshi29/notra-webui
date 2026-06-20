import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken } from '@/lib/notion-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token: rawToken, databaseId, properties } = body
    const token = getToken(rawToken)

    if (!databaseId || !properties) {
      return NextResponse.json(
        { error: 'databaseId and properties required' },
        { status: 400 }
      )
    }

    const client = createNotionClient(token)
    const result = await client.createPage({
      parent: { database_id: databaseId },
      properties,
    })

    return NextResponse.json({ page: result })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}
