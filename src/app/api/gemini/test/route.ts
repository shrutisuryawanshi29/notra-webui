import { NextResponse } from 'next/server'
import { geminiGenerateContentURL, GEMINI_DEFAULT_MODEL } from '@/lib/gemini-config'

export async function POST(request: Request) {
  try {
    const { apiKey, model } = await request.json()
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const modelName = model || GEMINI_DEFAULT_MODEL
    const url = geminiGenerateContentURL(modelName, apiKey)

    const body = {
      contents: [{ parts: [{ text: 'Reply with one word: OK' }] }],
      generationConfig: { maxOutputTokens: 5 },
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      const geminiStatus = errData?.error?.status || ''
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: 'Gemini key failed. Please update your key in Settings.' }, { status: 401 })
      }
      if (res.status === 404) {
        return NextResponse.json({ error: 'Gemini model is unavailable. Please choose another model in Settings.' }, { status: 404 })
      }
      if (res.status === 429) {
        return NextResponse.json({ error: 'Gemini quota reached for this API key/model. Try again later or choose another model.' }, { status: 429 })
      }
      if (res.status >= 500) {
        return NextResponse.json({ error: 'Gemini is temporarily unavailable. Try again.' }, { status: res.status })
      }
      return NextResponse.json({ error: 'Gemini API error' }, { status: res.status })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Could not connect to Gemini. Check your internet connection.` }, { status: 500 })
  }
}
