import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken } from '@/lib/notion-client'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { token: rawToken, properties } = body
    const token = getToken(rawToken)
    const { id } = await params

    if (!properties) {
      return NextResponse.json(
        { error: 'properties required' },
        { status: 400 }
      )
    }

    const client = createNotionClient(token)
    const result = await client.updatePage(id, { properties })

    return NextResponse.json({ page: result })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update settlement' },
      { status: 500 }
    )
  }
}
