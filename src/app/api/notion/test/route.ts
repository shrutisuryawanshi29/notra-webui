import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken, NotionApiError } from '@/lib/notion-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = getToken(body.token)

    const client = createNotionClient(token)
    const user = await client.testConnection()

    return NextResponse.json({
      valid: true,
      user: { id: user.id, name: user.name || 'Unknown' },
    })
  } catch (error) {
    if (error instanceof NotionApiError) {
      if (error.status === 401) {
        return NextResponse.json(
          { valid: false, error: 'Invalid token' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { valid: false, error: error.message },
        { status: error.status }
      )
    }
    return NextResponse.json(
      { valid: false, error: 'Failed to test connection' },
      { status: 500 }
    )
  }
}
