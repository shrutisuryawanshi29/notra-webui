import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken, NotionApiError } from '@/lib/notion-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token: rawToken, ...searchParams } = body
    const token = getToken(rawToken)

    const client = createNotionClient(token)

    const params: Record<string, unknown> = {}
    if (searchParams.query) params.query = searchParams.query
    if (searchParams.filter) params.filter = searchParams.filter
    if (searchParams.sort) params.sort = searchParams.sort
    if (searchParams.page_size) params.page_size = searchParams.page_size
    if (searchParams.start_cursor) params.start_cursor = searchParams.start_cursor

    const result = await client.search(params)
    const count = (result.results || []).length
    console.log(`[Notion Search] OK: ${count} results`)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof NotionApiError) {
      console.error(`[Notion Search] Error ${error.status}: ${error.message}`, error.body)
      return NextResponse.json(
        { error: error.message, status: error.status, body: error.body },
        { status: error.status }
      )
    }
    console.error('[Notion Search] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    )
  }
}
