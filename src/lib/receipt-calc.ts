import type { ReceiptReviewItem, ReceiptReviewState } from '@/types/transaction'
import type { GeminiReceiptPerson } from '@/types/gemini'

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export interface ReceiptCalcInput {
  items: ReceiptReviewItem[]
  people: GeminiReceiptPerson[]
  finalAmountToSplit: number
}

export interface CategoryPreview {
  category: string
  itemCount: number
  paidAmount: number
  myShare: number
}

export interface ReceiptCalcResult {
  myShare: number
  theyOwe: number
  personOwes: Record<string, number>
  personalTotal: number
  includedItemsTotal: number
  ignoredItemsTotal: number
  scaleFactor: number
  effectiveTotal: number
  groupPreviews: CategoryPreview[]
}

function calcSplitForItems(
  keptItems: ReceiptReviewItem[],
  people: GeminiReceiptPerson[],
  effectiveTotal: number,
): {
  myShare: number
  theyOwe: number
  personOwes: Record<string, number>
  personalTotal: number
  groupPreviews: CategoryPreview[]
} {
  let myShare = 0
  let personalTotal = 0
  const personOwes: Record<string, number> = {}
  for (const person of people) {
    personOwes[person.id] = 0
  }

  const itemsTotal = keptItems.reduce((s, i) => s + i.finalPrice, 0)
  const scaleFactor = itemsTotal > 0 ? effectiveTotal / itemsTotal : 0

  for (const item of keptItems) {
    const scaledPrice = round2(item.finalPrice * scaleFactor)
    switch (item.classification) {
      case 'mine':
        myShare += scaledPrice
        personalTotal += scaledPrice
        break
      case 'shared': {
        const sharedWith = item.sharedWith.length > 0
          ? item.sharedWith
          : people.map(p => p.id)
        const count = 1 + sharedWith.length
        const each = scaledPrice / count
        myShare += each
        for (const pid of sharedWith) {
          personOwes[pid] = (personOwes[pid] || 0) + each
        }
        break
      }
      case 'person': {
        const pid = item.sharedWith[0]
        if (pid) personOwes[pid] = (personOwes[pid] || 0) + scaledPrice
        break
      }
      case 'everyone': {
        const allIds = people.map(p => p.id)
        const count = 1 + allIds.length
        const each = scaledPrice / count
        myShare += each
        for (const pid of allIds) {
          personOwes[pid] = (personOwes[pid] || 0) + each
        }
        break
      }
    }
  }

  myShare = round2(myShare)
  personalTotal = round2(personalTotal)
  for (const pid of Object.keys(personOwes)) {
    personOwes[pid] = round2(personOwes[pid])
  }

  const participantsSum = round2(Object.values(personOwes).reduce((s, v) => s + v, 0))
  const totalAllocated = round2(myShare + participantsSum)
  const remaining = round2(effectiveTotal - totalAllocated)
  if (Math.abs(remaining) > 0.005) {
    myShare = round2(myShare + remaining)
  }

  const theyOwe = round2(effectiveTotal - myShare)

  const groups = new Map<string, ReceiptReviewItem[]>()
  for (const item of keptItems) {
    const cat = item.category || 'Uncategorized'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(item)
  }

  const groupPreviews: CategoryPreview[] = []
  for (const [cat, groupItems] of groups) {
    const groupRawTotal = groupItems.reduce((s, i) => s + i.finalPrice, 0)
    const groupPaidAmount = round2(groupRawTotal * scaleFactor)
    let groupMyShare = 0
    for (const item of groupItems) {
      const scaledPrice = round2(item.finalPrice * scaleFactor)
      switch (item.classification) {
        case 'mine':
          groupMyShare += scaledPrice
          break
        case 'shared': {
          const sharedWith = item.sharedWith.length > 0
            ? item.sharedWith
            : people.map(p => p.id)
          const count = 1 + sharedWith.length
          groupMyShare += scaledPrice / count
          break
        }
        case 'person':
          break
        case 'everyone': {
          const allIds = people.map(p => p.id)
          const count = 1 + allIds.length
          groupMyShare += scaledPrice / count
          break
        }
      }
    }
    groupPreviews.push({
      category: cat,
      itemCount: groupItems.length,
      paidAmount: groupPaidAmount,
      myShare: round2(groupMyShare),
    })
  }

  return { myShare, theyOwe, personOwes, personalTotal, groupPreviews }
}

export function calculateReceiptSplitTotals(input: ReceiptCalcInput): ReceiptCalcResult {
  const { items, people, finalAmountToSplit } = input

  const keptItems = items.filter(i => i.classification !== 'ignore')
  const ignoredItems = items.filter(i => i.classification === 'ignore')

  const includedItemsTotal = keptItems.reduce((s, i) => s + i.finalPrice, 0)
  const ignoredItemsTotal = ignoredItems.reduce((s, i) => s + Math.abs(i.finalPrice), 0)

  const scaleFactor = includedItemsTotal > 0 ? finalAmountToSplit / includedItemsTotal : 0

  const split = calcSplitForItems(keptItems, people, finalAmountToSplit)

  return {
    myShare: split.myShare,
    theyOwe: split.theyOwe,
    personOwes: split.personOwes,
    personalTotal: split.personalTotal,
    includedItemsTotal,
    ignoredItemsTotal,
    scaleFactor,
    effectiveTotal: finalAmountToSplit,
    groupPreviews: split.groupPreviews,
  }
}

export function getDefaultFinalAmount(state: ReceiptReviewState): number {
  const v = state.chargedAmount ?? state.printedTotal ?? state.itemsSubtotal ?? null
  if (v != null && v > 0) return round2(v)
  const itemSum = state.items.reduce((s, i) => s + i.finalPrice, 0)
  if (itemSum > 0) return round2(itemSum)
  return 0
}

export function computeIncludedItemsTotal(items: ReceiptReviewItem[]): number {
  const total = items
    .filter(i => i.classification !== 'ignore')
    .reduce((s, i) => s + i.finalPrice, 0)
  return round2(total)
}
