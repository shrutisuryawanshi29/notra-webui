import type {
  ItemStatus,
  GeminiReceiptResult,
} from '@/types/gemini'
import type {
  ReceiptReviewState,
  ReceiptReviewItem,
  ReceiptAdjustment,
  FinalAmountMode,
} from '@/types/transaction'
import { getDefaultFinalAmount } from './receipt-calc'

const STATUS_LABEL_MAP: Record<string, ItemStatus> = {
  'return scheduled for pickup': 'return_pending',
  'return started': 'return_pending',
  'return pending': 'return_pending',
  'return complete': 'refund_complete',
  'refund complete': 'refund_complete',
  'refunded': 'refund_complete',
  'cancelled': 'excluded',
  'not charged': 'excluded',
}

export function normalizeItemStatus(rawStatus: string | null | undefined): ItemStatus {
  if (!rawStatus) return 'purchased'
  const lower = rawStatus.toLowerCase().trim()
  const mapped = STATUS_LABEL_MAP[lower]
  if (mapped) return mapped

  const valid: Set<string> = new Set([
    'purchased', 'return_pending', 'return_complete', 'returned',
    'refunded', 'refund_complete', 'cancelled', 'substituted',
    'not_charged', 'unknown', 'excluded',
  ])
  if (valid.has(lower)) return lower as ItemStatus
  if (lower === 'excluded') return 'excluded'
  return 'purchased'
}

export function normalizeReceiptResult(raw: GeminiReceiptResult): {
  state: ReceiptReviewState
} {
  const items: ReceiptReviewItem[] = raw.items.map(item => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    finalPrice: item.finalPrice,
    status: normalizeItemStatus(item.status),
    category: item.category,
    classification: 'mine' as const,
    sharedWith: [],
  }))

  const seen = new Set<string>()
  const adjustments: ReceiptAdjustment[] = []
  for (const adj of raw.adjustments ?? []) {
    const key = `${adj.name}|${adj.type}|${adj.amount}`
    if (seen.has(key)) continue
    seen.add(key)
    if (adj.type === 'savings' || adj.type === 'discount') continue
    adjustments.push({
      name: adj.name,
      type: adj.type,
      amount: adj.amount,
    })
  }

  const state: ReceiptReviewState = {
    merchant: raw.merchant,
    platform: raw.platform,
    receiptType: raw.receiptType ?? null,
    date: raw.date,
    orderNumber: raw.orderNumber ?? null,
    currency: raw.currency ?? 'USD',
    rawText: raw.rawText ?? null,

    printedTotal: raw.summary.printedTotal ?? raw.summary.total ?? null,
    chargedAmount: raw.summary.printedCharged ?? raw.summary.totalCharged ?? null,
    itemsSubtotal: raw.summary.itemsSubtotal ?? null,
    tax: raw.summary.tax ?? null,
    deliveryFee: raw.summary.deliveryFee ?? null,
    tip: raw.summary.tip ?? null,
    serviceFee: raw.summary.serviceFee ?? null,
    discount: raw.summary.discount ?? null,

    adjustments,
    items,
    people: [],

    finalAmountMode: 'printed_total' as FinalAmountMode,
    finalAmountToSplit: 0,
    manualAdjustment: 0,
    manualAdjustmentNote: '',

    warnings: [...(raw.warnings ?? [])],
  }

  state.finalAmountToSplit = getDefaultFinalAmount(state)

  return { state }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export function getFinalAmountForMode(
  mode: FinalAmountMode,
  state: ReceiptReviewState,
): number {
  switch (mode) {
    case 'printed_total':
      return round2(state.chargedAmount ?? state.printedTotal ?? state.itemsSubtotal ?? 0)
    case 'items_only': {
      const kept = state.items.filter(i => i.classification !== 'ignore')
      return round2(kept.reduce((s, i) => s + i.finalPrice, 0))
    }
    case 'items_plus_tax': {
      const kept = state.items.filter(i => i.classification !== 'ignore')
      const itemsTotal = kept.reduce((s, i) => s + i.finalPrice, 0)
      return round2(itemsTotal + (state.tax ?? 0))
    }
    case 'custom':
      return state.finalAmountToSplit
  }
}
