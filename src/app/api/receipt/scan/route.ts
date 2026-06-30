import { NextResponse } from 'next/server'
import { geminiGenerateContentURL } from '@/lib/gemini-config'
import { GeminiReceiptResponse, GeminiReceiptResult, GeminiReceiptItem, GeminiReceiptSummary, GeminiReceiptAdjustment } from '@/types/gemini'

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

const REFUND_PATTERNS = /^(refund|return|cancel|cancelled|void|credit|not charged|adjusted)/i

function isRefundItem(name: string, rawText: string | null, finalPrice: number): boolean {
  if (REFUND_PATTERNS.test(name)) return true
  if (rawText && REFUND_PATTERNS.test(rawText)) return true
  if (finalPrice <= 0) return true
  return false
}

function validateAndBuildResult(response: GeminiReceiptResponse, rawText: string): GeminiReceiptResult {
  const warnings: string[] = response.warnings ?? []
  const extraAdjustments: GeminiReceiptAdjustment[] = []

  const items: GeminiReceiptItem[] = []
  for (const rawItem of response.items ?? []) {
    const name = rawItem.name.trim()
    if (name.length === 0) continue
    if (isRefundItem(name, rawItem.rawText ?? null, rawItem.finalPrice)) {
      extraAdjustments.push({
        name,
        type: 'refund',
        amount: Math.abs(rawItem.finalPrice),
        description: rawItem.rawText ?? null,
      })
      continue
    }
    items.push({
      id: generateId(),
      name,
      quantity: rawItem.quantity ?? null,
      unitPrice: rawItem.unitPrice ?? null,
      finalPrice: rawItem.finalPrice,
      categoryHint: rawItem.categoryHint ?? null,
      category: rawItem.categoryHint ?? null,
      rawText: rawItem.rawText ?? null,
      classification: 'mine' as const,
      isEditable: true,
      sharedWith: [],
    })
  }

  for (const adj of response.adjustments ?? []) {
    if (adj.type === 'weightAdjustment' && adj.amount && adj.amount > 0) {
      const name = adj.name.trim()
      if (!name) continue
      items.push({
        id: generateId(),
        name,
        quantity: null,
        unitPrice: null,
        finalPrice: adj.amount,
        categoryHint: null,
        category: null,
        rawText: adj.description ?? null,
        classification: 'mine' as const,
        isEditable: true,
        sharedWith: [],
      })
    }
  }

  const itemSum = items.reduce((sum, item) => sum + item.finalPrice, 0)
  if (response.summary?.itemsSubtotal != null && Math.abs(itemSum - response.summary.itemsSubtotal) > 0.1) {
    const refundTotal = extraAdjustments.reduce((s, a) => s + (a.amount ?? 0), 0)
    const adjustedExpected = response.summary.itemsSubtotal - refundTotal
    if (Math.abs(itemSum - adjustedExpected) > 0.1) {
      const msg = `Item total ($${itemSum.toFixed(2)}) differs from receipt subtotal ($${response.summary.itemsSubtotal.toFixed(2)}). Please review.`
      if (!warnings.some(w => w.includes('differs from receipt subtotal'))) {
        warnings.push(msg)
      }
    }
  }

  if (items.length === 0) {
    warnings.push('No receipt items were detected. You can add items manually.')
  }

  const s = response.summary
  const summary: GeminiReceiptSummary = {
    itemsSubtotal: s?.itemsSubtotal ?? null,
    tax: s?.tax ?? null,
    serviceFee: s?.serviceFee ?? null,
    deliveryFee: s?.deliveryFee ?? null,
    tip: s?.tip ?? null,
    discount: s?.discount ?? null,
    total: s?.total ?? null,
    totalCharged: s?.totalCharged ?? null,
  }

  const adjustments: GeminiReceiptAdjustment[] = [
    ...extraAdjustments,
    ...(response.adjustments ?? [])
      .filter(adj => !(adj.type === 'weightAdjustment' && adj.amount && adj.amount > 0))
      .map(adj => ({
        name: adj.name,
        type: adj.type ?? 'unknown',
        amount: adj.amount ?? null,
        description: adj.description ?? null,
      })),
  ]

  return {
    merchant: response.merchant ?? null,
    platform: response.platform ?? null,
    date: response.date ?? null,
    orderNumber: response.orderNumber ?? null,
    currency: response.currency ?? 'USD',
    items,
    summary,
    adjustments,
    warnings,
    rawText,
  }
}

export async function POST(request: Request) {
  try {
    const { image, mimeType, apiKey, model } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is required' }, { status: 400 })
    }
    if (!image) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 })
    }

    const modelName = model || 'gemini-2.0-flash'
    const url = geminiGenerateContentURL(modelName, apiKey)

    const prompt = `You are a receipt and grocery order parser.
Parse the receipt document attached and return JSON ONLY.
No markdown. No code blocks. No explanation.

Return a JSON object with this exact structure:
{
  "merchant": "string or null",
  "platform": "string or null",
  "date": "YYYY-MM-DD or null",
  "orderNumber": "string or null",
  "currency": "USD",
  "items": [{"name": "string", "quantity": null_or_number, "unitPrice": null_or_number, "finalPrice": number, "categoryHint": "string or null", "rawText": "string or null"}],
  "summary": {"itemsSubtotal": null_or_number, "tax": null_or_number, "serviceFee": null_or_number, "deliveryFee": null_or_number, "tip": null_or_number, "discount": null_or_number, "total": null_or_number, "totalCharged": null_or_number},
  "adjustments": [{"name": "string", "type": "refund|weightAdjustment|substitution|discount|fee|unknown", "amount": null_or_number, "description": "string or null"}],
  "warnings": ["string"]
}

RULES:
- items must contain ONLY real purchased products
- do NOT include subtotal, tax, total, payment, delivery fee, tip, service fee, authorization, or order number as items
- put ALL fees, taxes, tips, delivery, and discounts in summary
- put refunds, NOT CHARGED, and zero-amount adjustments in adjustments
- CHARGED weight adjustments are real purchase items — include them in items with their final charged price
- for Instacart, parse by sections:
  - ITEMS FOUND section → items
  - ADJUSTMENTS / WEIGHT ADJUSTMENTS section → include CHARGED adjusted items (positive amount) in items, NOT in adjustments
  - NOT CHARGED / refunded items → adjustments only, do NOT include as items
  - ORDER TOTALS / CHARGES section → summary only
- for Walmart: product lines with Qty and price -> items; Free delivery/Tax/Tip/Subtotal/Total -> summary
- use final charged prices, not original unit prices or delta amounts
- the sum of items[].finalPrice should match summary.itemsSubtotal when possible
- for Instacart loyalty savings, use the final price shown after savings
- when uncertain, add a warning instead of inventing data`

    const body = {
      contents: [
        {
          parts: [
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: 'Invalid Gemini API key' }, { status: 401 })
      }
      if (res.status === 429) {
        return NextResponse.json({ error: 'Gemini rate limited. Try again later.' }, { status: 429 })
      }
      return NextResponse.json({ error: `Gemini API error: ${res.status}`, detail: errText.slice(0, 500) }, { status: res.status })
    }

    const data = await res.json()
    const candidates = data?.candidates
    if (!candidates?.length) {
      return NextResponse.json({ error: 'No response from Gemini' }, { status: 502 })
    }

    const parts = candidates[0]?.content?.parts
    if (!parts?.length) {
      return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 502 })
    }

    let jsonText = (parts[0]?.text ?? '').trim()
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()

    let parsed: GeminiReceiptResponse
    try {
      parsed = JSON.parse(jsonText) as GeminiReceiptResponse
    } catch {
      return NextResponse.json({ error: 'Gemini returned invalid JSON', detail: jsonText.slice(0, 500) }, { status: 502 })
    }

    const result = validateAndBuildResult(parsed, jsonText)

    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
