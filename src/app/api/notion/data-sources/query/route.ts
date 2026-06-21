import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken } from '@/lib/notion-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token: rawToken, dataSourceId } = body
    const token = getToken(rawToken)

    if (!dataSourceId) {
      return NextResponse.json(
        { error: 'dataSourceId required' },
        { status: 400 }
      )
    }

    const client = createNotionClient(token)
    const results = await client.queryDataSource(dataSourceId)

    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to query data source' },
      { status: 500 }
    )
  }
}
