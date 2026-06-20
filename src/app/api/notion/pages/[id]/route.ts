import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken } from '@/lib/notion-client'

export async function PATCH(
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
      { error: 'Failed to update page' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { token: rawToken } = body
    const token = getToken(rawToken)
    const { id } = await params

    const client = createNotionClient(token)
    await client.trashPage(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to archive page' },
      { status: 500 }
    )
  }
}
