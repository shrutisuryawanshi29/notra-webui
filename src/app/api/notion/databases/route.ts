import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken } from '@/lib/notion-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = getToken(body.token)

    const client = createNotionClient(token)
    const result = await client.search({
      filter: { object: 'database' },
    })

    return NextResponse.json({ results: result.results })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch databases' },
      { status: 500 }
    )
  }
}
