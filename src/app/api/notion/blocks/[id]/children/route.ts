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
    const startCursor = body.startCursor as string | undefined

    const client = createNotionClient(token)

    const allResults: unknown[] = []
    let cursor: string | undefined = startCursor
    let hasMore = true

    while (hasMore) {
      const result = await client.getBlockChildren(id, cursor)
      allResults.push(...result.results)
      hasMore = result.has_more
      cursor = result.next_cursor || undefined
    }

    return NextResponse.json({ results: allResults })
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? (error as { status: number }).status : 500
    const message = error instanceof Error ? error.message : 'Failed to fetch block children'
    return NextResponse.json({ error: message }, { status })
  }
}
