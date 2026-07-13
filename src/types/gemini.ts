export type ItemStatus = 'purchased' | 'return_pending' | 'return_complete' | 'returned' | 'refunded' | 'refund_complete' | 'cancelled' | 'substituted' | 'not_charged' | 'excluded' | 'unknown'

export type ReceiptType = 'store' | 'online_order' | 'invoice' | 'refund' | 'delivery' | 'unknown'

export interface GeminiItemResponse {
  name: string
  quantity?: number | null
  unitPrice?: number | null
  finalPrice: number
  status?: string | null
  categoryHint?: string | null
  rawText?: string | null
}

export interface GeminiSummaryResponse {
  itemsSubtotal?: number | null
  discount?: number | null
  tax?: number | null
  serviceFee?: number | null
  deliveryFee?: number | null
  tip?: number | null
  printedTotal?: number | null
  printedCharged?: number | null
  total?: number | null
  totalCharged?: number | null
}

export interface GeminiAdjustmentResponse {
  name: string
  type?: string | null
  amount?: number | null
  alreadyIncludedInPrintedTotal?: boolean | null
  appliesToItemName?: string | null
  description?: string | null
}

export interface GeminiReceiptResponse {
  merchant?: string | null
  platform?: string | null
  receiptType?: ReceiptType | null
  date?: string | null
  orderNumber?: string | null
  currency?: string | null
  items: GeminiItemResponse[]
  summary?: GeminiSummaryResponse | null
  adjustments?: GeminiAdjustmentResponse[] | null
  warnings?: string[] | null
}

export type GeminiClassification = 'mine' | 'person' | 'shared' | 'everyone' | 'ignore'

export interface GeminiReceiptItem {
  id: string
  name: string
  quantity: number | null
  unitPrice: number | null
  finalPrice: number
  status: ItemStatus
  categoryHint: string | null
  rawText: string | null
  classification: GeminiClassification
  isEditable: boolean
  sharedWith: string[]
  category: string | null
}

export interface GeminiReceiptSummary {
  itemsSubtotal: number | null
  discount: number | null
  tax: number | null
  serviceFee: number | null
  deliveryFee: number | null
  tip: number | null
  printedTotal: number | null
  printedCharged: number | null
  total: number | null
  totalCharged: number | null
}

export interface GeminiReceiptAdjustment {
  name: string
  type: string
  amount: number | null
  alreadyIncludedInPrintedTotal: boolean | null
  appliesToItemName: string | null
  description: string | null
}

export interface GeminiReceiptResult {
  merchant: string | null
  platform: string | null
  receiptType: ReceiptType | null
  date: string | null
  orderNumber: string | null
  currency: string
  items: GeminiReceiptItem[]
  summary: GeminiReceiptSummary
  adjustments: GeminiReceiptAdjustment[]
  warnings: string[]
  rawText: string
}

export interface GeminiReceiptPerson {
  id: string
  name: string
}
