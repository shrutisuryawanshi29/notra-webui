import { NextResponse } from 'next/server'
import { geminiGenerateContentURL } from '@/lib/gemini-config'
import { ItemStatus, GeminiReceiptResponse, GeminiReceiptResult, GeminiReceiptItem, GeminiReceiptSummary, GeminiReceiptAdjustment } from '@/types/gemini'

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function coerceStatus(s: string | null | undefined): ItemStatus {
  const valid: Set<string> = new Set([
    'purchased', 'return_pending', 'return_complete', 'returned',
    'refunded', 'refund_complete', 'cancelled', 'substituted',
    'not_charged', 'excluded', 'unknown',
  ])
  if (s && valid.has(s)) return s as ItemStatus
  return 'purchased'
}

function validateAndBuildResult(response: GeminiReceiptResponse, rawText: string): GeminiReceiptResult {
  const warnings: string[] = response.warnings ?? []

  const items: GeminiReceiptItem[] = []

  for (const rawItem of response.items ?? []) {
    const name = rawItem.name.trim()
    if (name.length === 0) continue

    const status = coerceStatus(rawItem.status)

    items.push({
      id: generateId(),
      name,
      quantity: rawItem.quantity ?? null,
      unitPrice: rawItem.unitPrice ?? null,
      finalPrice: rawItem.finalPrice,
      status,
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
        status: 'purchased',
        categoryHint: null,
        category: null,
        rawText: adj.description ?? null,
        classification: 'mine' as const,
        isEditable: true,
        sharedWith: [],
      })
    }
  }

  if (items.length === 0) {
    warnings.push('No receipt items were detected. You can add items manually.')
  }

  const s = response.summary
  const summary: GeminiReceiptSummary = {
    itemsSubtotal: s?.itemsSubtotal ?? null,
    discount: s?.discount ?? null,
    tax: s?.tax ?? null,
    serviceFee: s?.serviceFee ?? null,
    deliveryFee: s?.deliveryFee ?? null,
    tip: s?.tip ?? null,
    printedTotal: s?.printedTotal ?? null,
    printedCharged: s?.printedCharged ?? null,
    total: s?.printedTotal ?? s?.total ?? null,
    totalCharged: s?.printedCharged ?? s?.totalCharged ?? null,
  }

  const adjustments: GeminiReceiptAdjustment[] = [
    ...(response.adjustments ?? [])
      .filter(adj => !(adj.type === 'weightAdjustment' && adj.amount && adj.amount > 0))
      .map(adj => ({
        name: adj.name,
        type: adj.type ?? 'unknown',
        amount: adj.amount ?? null,
        alreadyIncludedInPrintedTotal: adj.alreadyIncludedInPrintedTotal ?? null,
        appliesToItemName: adj.appliesToItemName ?? null,
        description: adj.description ?? null,
      })),
  ]

  return {
    merchant: response.merchant ?? null,
    platform: response.platform ?? null,
    receiptType: response.receiptType ?? null,
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
  "receiptType": "store|online_order|invoice|refund|delivery|unknown",
  "date": "YYYY-MM-DD or null",
  "orderNumber": "string or null",
  "currency": "USD",
  "items": [
    {
      "name": "string",
      "quantity": null_or_number,
      "unitPrice": null_or_number,
      "finalPrice": 0,
      "status": "purchased|return_pending|return_complete|returned|refunded|refund_complete|cancelled|substituted|not_charged|unknown",
      "categoryHint": "string or null",
      "rawText": "string or null"
    }
  ],
  "summary": {
    "itemsSubtotal": null_or_number,
    "discount": null_or_number,
    "tax": null_or_number,
    "serviceFee": null_or_number,
    "deliveryFee": null_or_number,
    "tip": null_or_number,
    "printedTotal": null_or_number,
    "printedCharged": null_or_number
  },
  "adjustments": [
    {
      "name": "string",
      "type": "discount|savings|weightAdjustment|substitution|fee|tax|tip|delivery|unknown",
      "amount": 0,
      "alreadyIncludedInPrintedTotal": true_or_false_or_null,
      "appliesToItemName": "string or null",
      "description": "string or null"
    }
  ],
  "warnings": ["string"]
}

ITEM STATUS RULES:
- All receipt item lines must be included in items[].
- Do NOT exclude any item lines.
- purchased items → status "purchased"
- Items being returned → status "return_pending", "returned", or "refunded"
- Completed returns/refunds → status "return_complete" or "refund_complete"
- Cancelled items → status "cancelled"
- Items with "not charged" → status "not_charged"
- Substituted items → status "substituted"
- finalPrice = the item's line total on the receipt. For returned items this may be negative if shown as a credit.
- Duplicate item lines must be preserved. Do NOT deduplicate by name.
- Same item name on multiple lines means multiple items unless quantity clearly shows otherwise.

ADJUSTMENT RULES:
- adjustments[] is for receipt-level line items that are not products: discounts, savings, fees, tips, delivery, service fees.
- Do NOT put returned/refunded items in adjustments. They belong in items[] with their status.
- For Walmart: returned/refunded items appear as line items. Do not move them to adjustments.
- If unsure whether an adjustment is already included in the printed total, set alreadyIncludedInPrintedTotal=null and add a warning.

SUMMARY RULES:
- itemsSubtotal = subtotal printed on receipt (before discounts/tax)
- discount = total discount/savings amount
- printedTotal = total printed on receipt
- printedCharged = amount actually charged/paid if shown separately

GENERAL RULES:
- Do NOT include subtotal, tax, total, payment, delivery fee, tip, service fee, authorization, or order number as items.
- Put ALL fees, taxes, tips, delivery in summary fields.
- CHARGED weight adjustments are real purchase items — include in items with final charged price.
- For Instacart: parse by sections (ITEMS FOUND, ADJUSTMENTS, ORDER TOTALS).
- When uncertain, always prefer adding a warning over guessing silently.
- Preserve all item lines — do not drop any.`

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
