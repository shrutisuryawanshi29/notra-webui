'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isSetupComplete, getExpenseConfig, getExpenseMapping, getGeminiKey, getNotionToken, loadConfig } from '@/lib/config'
import { getStoredGeminiModel } from '@/lib/gemini-config'
import { buildNotionProperties } from '@/lib/notion-payload'
import { getSplitPeople } from '@/lib/split-people'
import { calculateReceiptSplitTotals, getDefaultFinalAmount, computeIncludedItemsTotal } from '@/lib/receipt-calc'
import { normalizeReceiptResult } from '@/lib/receipt-normalizer'
import type { GeminiReceiptResult, GeminiReceiptPerson, GeminiClassification } from '@/types/gemini'
import type { ReceiptReviewItem, ReceiptReviewState, FinalAmountMode, SplitItem, ReceiptScanMetadata, SplitMetadata } from '@/types/transaction'
import Card from '@/components/Card'
import Chip from '@/components/Chip'
import LoadingSpinner from '@/components/LoadingSpinner'
import StyledSelect from '@/components/StyledSelect'
import { Upload, Camera, ArrowLeft, X, Plus, AlertTriangle } from 'lucide-react'

type Phase = 'upload' | 'review'

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function formatPrice(cents: number): string {
  return `$${cents.toFixed(2)}`
}

function todayString(): string {
  return new Date().toLocaleDateString('en-CA')
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  return_pending: { label: 'Return Pending', className: 'bg-[#D49A4A]/20 text-[#D49A4A]' },
  return_complete: { label: 'Returned', className: 'bg-[#D8755D]/20 text-[#D8755D]' },
  returned: { label: 'Returned', className: 'bg-[#D8755D]/20 text-[#D8755D]' },
  refunded: { label: 'Refunded', className: 'bg-[#D8755D]/20 text-[#D8755D]' },
  refund_complete: { label: 'Refunded', className: 'bg-[#D8755D]/20 text-[#D8755D]' },
  cancelled: { label: 'Cancelled', className: 'bg-[#5A4638]/40 text-[#9B8778]' },
  excluded: { label: 'Excluded', className: 'bg-[#5A4638]/40 text-[#9B8778]' },
  not_charged: { label: 'Not Charged', className: 'bg-[#5A4638]/40 text-[#9B8778]' },
  substituted: { label: 'Substituted', className: 'bg-[#6FC2D0]/20 text-[#6FC2D0]' },
  unknown: { label: 'Unknown', className: 'bg-[#5A4638]/40 text-[#9B8778]' },
}

function extractTitle(page: Record<string, unknown>): string {
  if (!page?.properties) return 'Untitled'
  const props = page.properties as Record<string, Record<string, unknown>>
  const titleProp = Object.values(props).find(v => (v as Record<string, unknown>).type === 'title')
  const text = (titleProp as Record<string, unknown>)?.title as Array<{ text?: { content?: string } }> | undefined
  return text?.[0]?.text?.content?.trim() || 'Untitled'
}

async function fetchSchema(databaseId: string) {
  const config = loadConfig()
  const res = await fetch(`/api/notion/databases/${databaseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: config?.notionToken }),
  })
  if (!res.ok) throw new Error(`Failed to fetch schema: ${res.statusText}`)
  const data = await res.json()
  return data.database
}

async function loadRelationOptions(dataSourceId?: string): Promise<{ options: { name: string; id?: string }[]; error?: string }> {
  if (!dataSourceId) return { options: [], error: 'No relation data source ID' }
  const config = loadConfig()
  const token = config?.notionToken
  try {
    const res = await fetch('/api/notion/data-sources/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, dataSourceId }),
    })
    if (res.ok) {
      const data = await res.json()
      const results = (data.results || []) as Record<string, unknown>[]
      return { options: results.map(r => ({ name: extractTitle(r), id: String(r.id) })) }
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch('/api/notion/databases/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, databaseId: dataSourceId }),
    })
    if (res.ok) {
      const data = await res.json()
      const results = (data.results || []) as Record<string, unknown>[]
      return { options: results.map(r => ({ name: extractTitle(r), id: String(r.id) })) }
    }
  } catch { /* fall through */ }
  return { options: [], error: 'Failed to load relation options' }
}

const ITEM_STATUSES_WARNING = ['return_pending', 'return_complete', 'returned', 'refunded', 'refund_complete', 'cancelled', 'excluded', 'not_charged', 'unknown']

function isNonPurchasedStatus(s: string | null | undefined): boolean {
  return !!s && s !== 'purchased' && s !== 'substituted'
}

export default function ScanPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [result, setResult] = useState<GeminiReceiptResult | null>(null)
  const [review, setReview] = useState<ReceiptReviewState | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  const [categoryOptions, setCategoryOptions] = useState<{ name: string; id?: string }[]>([])
  const [categoryOptionsLoading, setCategoryOptionsLoading] = useState(true)
  const [categoryType, setCategoryType] = useState<string | null>(null)
  const [savedPeople, setSavedPeople] = useState<{ id: string; name: string }[]>([])
  const [categoryRelationDsId, setCategoryRelationDsId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [showMultiSelect, setShowMultiSelect] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [includeTax, setIncludeTax] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const loadCategoryOptions = useCallback(async () => {
    const config = loadConfig()
    if (!config) { setCategoryOptionsLoading(false); return }
    const mapping = getExpenseMapping(config)
    const cm = mapping?.columnMapping
    const columnName = cm?.categoryColumn
    const type = mapping?.categoryType
    const relationDSId = cm?.categoryRelationDataSourceId
    const dbId = getExpenseConfig(config).databaseId
    if (!columnName || !type || !dbId) { setCategoryOptionsLoading(false); return }
    setCategoryType(type)
    setCategoryRelationDsId(relationDSId ?? null)
    try {
      let loaded: { name: string; id?: string }[] = []
      if (type === 'relation') {
        const { options, error } = await loadRelationOptions(relationDSId || undefined)
        if (!error) loaded = options
      } else if (type === 'select' || type === 'multi_select') {
        const schema = await fetchSchema(dbId)
        const props = Object.values(schema.properties || {}) as Record<string, unknown>[]
        const prop = props.find(p => p.name === columnName) as Record<string, unknown> | undefined
        if (prop) {
          const typeKey = type === 'multi_select' ? 'multi_select' : 'select'
          const opts = (prop[typeKey] as Record<string, unknown>)?.options as Array<Record<string, unknown>> | undefined
          if (opts) loaded = opts.map(o => ({ name: String(o.name), id: o.id ? String(o.id) : undefined }))
        }
      }
      setCategoryOptions(loaded)
      setCategoryOptionsLoading(false)
    } catch { setCategoryOptionsLoading(false) }
  }, [])

  useEffect(() => {
    loadCategoryOptions()
  }, [loadCategoryOptions])

  useEffect(() => {
    if (phase === 'review') {
      setSavedPeople(getSplitPeople())
    }
  }, [phase])

  const updateReviewItem = useCallback((id: string, upd: Partial<ReceiptReviewItem>) => {
    setReview(prev => {
      if (!prev) return prev
      const nextItems = prev.items.map(item => {
        if (item.id !== id) return item
        const next = { ...item, ...upd }
        if (upd.classification === 'everyone') {
          next.sharedWith = prev.people.map(p => p.id)
        } else if (upd.classification === 'person') {
          next.sharedWith = item.classification === 'person' ? item.sharedWith : []
        } else if (upd.classification === 'mine' || upd.classification === 'ignore') {
          next.sharedWith = []
        }
        if (upd.classification === 'person' && item.classification !== 'person' && prev.people.length > 0) {
          next.sharedWith = [prev.people[0].id]
        }
        return next
      })
      return { ...prev, items: nextItems }
    })
  }, [])

  const updateReviewPeople = useCallback((people: GeminiReceiptPerson[]) => {
    setReview(prev => {
      if (!prev) return prev
      const allIds = people.map(p => p.id)
      const nextItems = prev.items.map(item =>
        item.classification === 'everyone' ? { ...item, sharedWith: allIds } : item
      )
      return { ...prev, people, items: nextItems }
    })
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    setLoading(true)
    setError(null)

    const geminiKey = getGeminiKey()
    if (!geminiKey) {
      setError('Gemini API key not configured. Go to Settings to add one.')
      setLoading(false)
      return
    }

    setPreviewUrl(URL.createObjectURL(file))

    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')

      const model = getStoredGeminiModel()
      const res = await fetch('/api/receipt/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType, apiKey: geminiKey, model }),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Gemini rate limit hit. Try again in a minute, use a different model, or check your key in Settings.')
        }
        if (res.status === 401) {
          throw new Error('Invalid Gemini API key. Go to Settings to update it.')
        }
        throw new Error(data.error || 'Scan failed')
      }

      const scanResult = data.result as GeminiReceiptResult
      setResult(scanResult)

      const { state } = normalizeReceiptResult(scanResult)
      setReview(state)
      setPhase('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan receipt')
      setPreviewUrl(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/') || file?.name.endsWith('.pdf')) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  const toggleItemSelect = useCallback((id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const applyOwnershipToSelected = useCallback((classification: GeminiClassification) => {
    setReview(prev => {
      if (!prev) return prev
      const nextItems = prev.items.map(item => {
        if (!selectedItemIds.has(item.id)) return item
        const next = { ...item, classification }
        if (classification === 'everyone') {
          next.sharedWith = prev.people.map(p => p.id)
        } else if (classification === 'person') {
          next.sharedWith = prev.people.length > 0 ? [prev.people[0].id] : []
        } else if (classification === 'shared') {
          if (next.sharedWith.length === 0 && prev.people.length > 0) {
            next.sharedWith = [prev.people[0].id]
          }
        } else {
          next.sharedWith = []
        }
        return next
      })
      return { ...prev, items: nextItems }
    })
    setSelectedItemIds(new Set())
  }, [selectedItemIds])

  const applyCategoryToSelected = useCallback((cat: string) => {
    setReview(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map(item =>
          selectedItemIds.has(item.id) ? { ...item, category: cat } : item
        ),
      }
    })
    setSelectedItemIds(new Set())
  }, [selectedItemIds])

  const assignPersonToSelected = useCallback((personId: string) => {
    setReview(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map(item =>
          selectedItemIds.has(item.id)
            ? { ...item, classification: 'person' as const, sharedWith: [personId] }
            : item
        ),
      }
    })
    setSelectedItemIds(new Set())
  }, [selectedItemIds])

  const addPerson = useCallback(() => {
    const name = prompt('Enter person name:')
    if (name?.trim()) {
      const newPerson: GeminiReceiptPerson = { id: generateId(), name: name.trim() }
      updateReviewPeople([...(review?.people ?? []), newPerson])
    }
  }, [review, updateReviewPeople])

  const removePerson = useCallback((personId: string) => {
    updateReviewPeople((review?.people ?? []).filter(p => p.id !== personId))
    setReview(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map(item => ({
          ...item,
          sharedWith: item.sharedWith.filter(id => id !== personId),
        })),
      }
    })
  }, [review, updateReviewPeople])

  const toggleSharedWith = useCallback((itemId: string, personId: string) => {
    setReview(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map(item => {
          if (item.id !== itemId) return item
          const has = item.sharedWith.includes(personId)
          return {
            ...item,
            sharedWith: has
              ? item.sharedWith.filter(id => id !== personId)
              : [...item.sharedWith, personId],
          }
        }),
      }
    })
  }, [])

  const bulkSet = useCallback((classification: GeminiClassification) => {
    setReview(prev => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map(item => {
          const next = { ...item, classification }
          if (classification === 'everyone') {
            next.sharedWith = prev.people.map(p => p.id)
          } else if (classification === 'person') {
            next.sharedWith = prev.people.length > 0 ? [prev.people[0].id] : []
          } else if (classification === 'shared') {
            if (next.sharedWith.length === 0 && prev.people.length > 0) {
              next.sharedWith = [prev.people[0].id]
            }
          } else {
            next.sharedWith = []
          }
          return next
        }),
      }
    })
  }, [])

  const [bulkCategory, setBulkCategory] = useState('')
  const bulkSetCategory = useCallback(() => {
    if (!bulkCategory) return
    setReview(prev => {
      if (!prev) return prev
      return { ...prev, items: prev.items.map(item => ({ ...item, category: bulkCategory })) }
    })
  }, [bulkCategory])

  const setFinalAmountMode = useCallback((mode: FinalAmountMode) => {
    setReview(prev => {
      if (!prev) return prev
      let amount: number
      switch (mode) {
        case 'printed_total':
          amount = round2(prev.chargedAmount ?? prev.printedTotal ?? prev.itemsSubtotal ?? 0)
          break
        case 'items_only':
          amount = round2(computeIncludedItemsTotal(prev.items))
          break
        case 'items_plus_tax': {
          const kept = prev.items.filter(i => i.classification !== 'ignore')
          const itemsTotal = kept.reduce((s, i) => s + i.finalPrice, 0)
          amount = round2(itemsTotal + (prev.tax ?? 0))
          break
        }
        case 'custom':
          amount = prev.finalAmountToSplit
          break
        default:
          amount = round2(getDefaultFinalAmount(prev))
      }
      return { ...prev, finalAmountMode: mode, finalAmountToSplit: amount }
    })
  }, [])

  const activeAmount = useMemo(() => {
    if (!review) return 0
    let base: number
    switch (review.finalAmountMode) {
      case 'printed_total':
        base = review.chargedAmount ?? review.printedTotal ?? review.itemsSubtotal ?? 0
        break
      case 'items_only':
        base = computeIncludedItemsTotal(review.items)
        break
      case 'items_plus_tax':
        base = round2(computeIncludedItemsTotal(review.items) + (review.tax ?? 0))
        break
      case 'custom':
        base = review.finalAmountToSplit
        break
      default:
        base = getDefaultFinalAmount(review)
    }
    return round2(base)
  }, [review])

  const calcResult = useMemo(() => {
    if (!review) return null
    const effectiveAmount = (includeTax || review.tax == null)
      ? activeAmount
      : Math.max(0, activeAmount - (review.tax ?? 0))
    return calculateReceiptSplitTotals({
      items: review.items,
      people: review.people,
      finalAmountToSplit: effectiveAmount,
    })
  }, [review, includeTax, activeAmount])

  const validationWarnings = useMemo(() => {
    if (!review) return []
    const warnings: string[] = []
    const active = review.items.filter(i => i.classification !== 'ignore')

    const noCat = active.filter(i => !i.category)
    if (noCat.length > 0) warnings.push(`${noCat.length} item(s) without category: "${noCat[0].name}"`)

    const noOwner = active.filter(i => !i.classification)
    if (noOwner.length > 0) warnings.push(`${noOwner.length} item(s) without ownership`)

    const personNoPerson = active.filter(i => i.classification === 'person' && i.sharedWith.length === 0)
    if (personNoPerson.length > 0) warnings.push(`${personNoPerson.length} person-assigned item(s) without a person selected`)

    const sharedNoPeople = active.filter(i => i.classification === 'shared' && i.sharedWith.length === 0 && review.people.length > 0)
    if (sharedNoPeople.length > 0) warnings.push(`${sharedNoPeople.length} shared item(s) without people selected — they will be split among everyone`)

    const nonPurchasedNotIgnored = active.filter(i => isNonPurchasedStatus(i.status))
    if (nonPurchasedNotIgnored.length > 0) {
      warnings.push(`${nonPurchasedNotIgnored.length} item(s) with "${nonPurchasedNotIgnored[0].status}" status — click "Ignore" to exclude from split`)
    }

    if (active.length === 0) {
      warnings.push('No non-ignored items — transaction would be empty')
    }

    if (review.itemsSubtotal != null && activeAmount <= 0) {
      warnings.push('Final Amount to Split is 0 but receipt has subtotal $' + review.itemsSubtotal.toFixed(2))
    }

    const ignoredTotal = review.items
      .filter(i => i.classification === 'ignore')
      .reduce((s, i) => s + Math.abs(i.finalPrice), 0)
    if (ignoredTotal > 0 && review.finalAmountMode === 'printed_total') {
      warnings.push(`You ignored $${ignoredTotal.toFixed(2)} of items, but Final Amount to Split still uses printed total. Review before saving.`)
    }

    if (review.discount != null && Math.abs(review.discount) > 0 && (review.finalAmountMode === 'items_only' || review.finalAmountMode === 'items_plus_tax')) {
      warnings.push('Savings/discounts are already reflected in printed total. They are not subtracted again.')
    }

    if (ignoredTotal > 0 && review.finalAmountMode === 'items_plus_tax') {
      warnings.push('Tax is approximate when ignored items exist. Use Custom to adjust final amount if needed.')
    }

    return warnings
  }, [review])

  const handleCreate = useCallback(async () => {
    if (!review || !calcResult) return
    setCreating(true)
    setCreateError(null)

    try {
      const config = loadConfig()
      if (!config) {
        router.replace('/setup')
        return
      }
      const expenseCfg = getExpenseConfig(config)
      const token = getNotionToken()

      const splitCandidates = review.items.filter(i => i.classification !== 'ignore')
      const uncategorized = splitCandidates.filter(i => !i.category)
      if (uncategorized.length > 0) {
        throw new Error(`Set a category for each item before saving. Missing: "${uncategorized[0].name}"`)
      }

      const rawTax = review.tax
      const scaleFactor = calcResult.scaleFactor

      const categoryGroups = new Map<string, ReceiptReviewItem[]>()
      for (const item of splitCandidates) {
        const key = item.category || 'Uncategorized'
        if (!categoryGroups.has(key)) categoryGroups.set(key, [])
        categoryGroups.get(key)!.push(item)
      }

      let firstError: string | null = null
      let createdCount = 0

      for (const [catName, groupItems] of categoryGroups.entries()) {
        const catOption = categoryOptions.find(o => o.name === catName)
        const catId = categoryType === 'relation' ? catOption?.id : undefined

        const groupItemPrice = groupItems.reduce((s, i) => s + i.finalPrice, 0)
        const groupPaidAmount = round2(groupItemPrice * scaleFactor)
        const groupTax = rawTax != null ? round2(groupItemPrice * (rawTax / calcResult.includedItemsTotal)) : 0

        const effectiveItems: SplitItem[] = groupItems.map(item => ({
          name: item.name,
          price: round2(item.finalPrice * scaleFactor),
          assignment: item.classification,
          sharedWith: item.sharedWith,
          category: item.category,
          categoryId: catId,
        }))

        const groupMyShare = round2(
          effectiveItems
            .filter(i => i.assignment !== 'person')
            .reduce((s, i) => {
              switch (i.assignment) {
                case 'mine': return s + i.price
                case 'shared': {
                  const sw = i.sharedWith.length > 0 ? i.sharedWith : review.people.map(p => p.id)
                  return s + i.price / (1 + sw.length)
                }
                case 'everyone': {
                  return s + i.price / (1 + review.people.length)
                }
                default: return s
              }
            }, 0)
        )

        const groupTitle = `${review.merchant || 'Receipt'} - ${review.date || todayString()} - ${catName}`

        const receiptMeta: ReceiptScanMetadata = {
          source: 'gemini-v1',
          merchant: review.merchant ?? null,
          itemCount: groupItems.length,
          originalTotal: review.printedTotal ?? review.chargedAmount ?? null,
          groupCategory: catName,
          groupCategoryId: catId ?? null,
          groupSubtotal: groupItemPrice,
          groupTax,
          originalReceiptTotal: review.chargedAmount ?? review.printedTotal ?? null,
          printedTotal: review.printedTotal,
          chargedAmount: review.chargedAmount,
          finalAmountToSplit: activeAmount,
          finalAmountMode: review.finalAmountMode,
          manualAdjustment: review.manualAdjustment,
          manualAdjustmentNote: review.manualAdjustmentNote,
          splitItems: review.items.map(i => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            finalPrice: i.finalPrice,
            status: i.status,
            category: i.category,
            classification: i.classification,
            sharedWith: i.sharedWith,
          })),
          itemStatuses: Object.fromEntries(review.items.map(i => [i.id, i.status])),
          warnings: [...validationWarnings],
        }

        const groupSplitMetadata: SplitMetadata = {
          version: 2,
          split: {
            enabled: review.people.length > 0,
            paidAmount: groupPaidAmount,
            myShare: groupMyShare,
            theyOwe: round2(groupPaidAmount - groupMyShare),
            type: review.people.length > 0 ? 'receiptMultiPerson' : 'receipt',
            status: 'pending',
            participants: review.people.map(p => ({
              id: p.id,
              name: p.name,
              owes: calcResult.personOwes[p.id] ?? 0,
              status: 'pending' as const,
              settledAt: null,
            })),
            items: splitCandidates.map(item => ({
              name: item.name,
              price: item.finalPrice,
              assignment: item.classification,
              sharedWith: item.sharedWith,
              category: item.category,
              categoryId: catId,
            })),
            inputs: {
              finalAmountToSplit: activeAmount,
              finalAmountMode: review.finalAmountMode,
              manualAdjustment: review.manualAdjustment,
            },
          },
          receipt: receiptMeta,
        }

        const properties = buildNotionProperties(
          config, 'expense',
          {
            title: groupTitle,
            amount: groupMyShare,
            date: review.date || todayString(),
            category: catName,
            splitMetadata: groupSplitMetadata,
          },
          categoryType,
          catId
        )

        const res = await fetch('/api/notion/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, databaseId: expenseCfg.databaseId, properties }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          firstError = errData.error || `Failed to create "${groupTitle}"`
          break
        }
        createdCount++
      }

      if (firstError) {
        const msg = createdCount > 0
          ? `${firstError} (${createdCount} of ${categoryGroups.size} created)`
          : firstError
        throw new Error(msg)
      }

      router.push('/dashboard')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create transaction')
    } finally {
      setCreating(false)
    }
  }, [review, activeAmount, calcResult, categoryOptions, categoryType, router, validationWarnings])

  const handleRetake = useCallback(() => {
    setPhase('upload')
    setResult(null)
    setReview(null)
    setPreviewUrl(null)
    setError(null)
    setSelectedItemIds(new Set())
    setExpandedCategories(new Set())
  }, [])

  if (!loaded) return null
  if (!isSetupComplete()) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight mb-6">Scan Receipt</h1>
        <p className="text-[#B8A99A] text-sm">Setup not complete. Please complete setup first.</p>
      </div>
    )
  }

  if (phase === 'upload') {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#1B120E] p-4 md:p-6 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/dashboard" className="text-[#9B8778] hover:text-[#D49A4A] transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-[#F4EDE3]">Scan Receipt</h1>
          </div>

          {loading && (
            <Card className="text-center py-16">
              <LoadingSpinner />
              <p className="text-[#B8A99A] mt-4">Processing receipt...</p>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="mx-auto mt-4 max-h-48 rounded object-contain opacity-50"
                />
              )}
            </Card>
          )}

          {!loading && !error && (
            <>
              <div
                onDragOver={(e: React.DragEvent) => e.preventDefault()}
                onDrop={handleDrop}
                className="bg-n-surface rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.35)] border-2 border-dashed border-[#5A4638] hover:border-[#D49A4A] transition-colors cursor-pointer text-center py-16"
              >
                <div className="flex flex-col items-center gap-4">
                  <Upload size={40} className="text-[#9B8778]" />
                  <p className="text-[#B8A99A]">Drop a receipt image or PDF here</p>
                  <p className="text-[#6A5140] text-sm">or</p>
                  <label className="bg-[#D49A4A] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#C1883A] transition-colors cursor-pointer inline-flex items-center gap-2">
                    <Camera size={16} />
                    Choose File
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <p className="text-[#6A5140] text-xs text-center mt-4">
                Supported: JPEG, PNG, PDF &middot; Sent to Gemini for OCR
              </p>
            </>
          )}

          {error && (
            <Card className="border border-red-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-red-400 font-semibold">Error</p>
                  <p className="text-[#B8A99A] text-sm mt-1">{error}</p>
                  <div className="flex gap-2 mt-3">
                    <label className="bg-[#D49A4A] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#C1883A] transition-colors cursor-pointer">
                      Try Again
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                    <Link
                      href="/settings"
                      className="text-[#D49A4A] px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#3A2A22] transition-colors"
                    >
                      Settings
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    )
  }

  if (!review || !calcResult) return null

  const items = review.items
  const adjustments = review.adjustments
  const showSummary = !!(review.printedTotal != null || review.chargedAmount != null || review.itemsSubtotal != null ||
    review.tax != null || review.deliveryFee != null || review.tip != null || review.discount != null)

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#1B120E] p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[#9B8778] hover:text-[#D49A4A] transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-[#F4EDE3]">Review Receipt</h1>
          </div>
          <button
            onClick={handleRetake}
            className="text-sm text-[#9B8778] hover:text-[#D49A4A] transition-colors"
          >
            Scan another
          </button>
        </div>

        {result?.warnings && result.warnings.length > 0 && (
          <Card className="border border-[#D49A4A]/30">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-[#D49A4A] shrink-0 mt-0.5" />
              <div>
                <p className="text-[#D49A4A] text-sm font-semibold">Warnings</p>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-[#B8A99A] text-xs mt-0.5">{w}</p>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#9B8778] font-semibold uppercase tracking-wider">Merchant</label>
              <input
                type="text"
                value={review.merchant || ''}
                onChange={e => setReview(prev => prev ? { ...prev, merchant: e.target.value } : prev)}
                className="w-full bg-[#1B120E] text-[#F4EDE3] border border-[#5A4638] rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-[#D49A4A]"
                placeholder="Store name"
              />
            </div>
            <div>
              <label className="text-xs text-[#9B8778] font-semibold uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={review.date || todayString()}
                onChange={e => setReview(prev => prev ? { ...prev, date: e.target.value } : prev)}
                className="w-full bg-[#1B120E] text-[#F4EDE3] border border-[#5A4638] rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-[#D49A4A]"
              />
            </div>
          </div>
        </Card>

        {savedPeople.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[#F4EDE3]">Saved People</h2>
              <button
                onClick={() => { setSavedPeople([]) }}
                className="text-[#9B8778] text-[10px] hover:text-[#D8755D] transition-colors"
              >Hide</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {savedPeople.map(sp => (
                <Chip
                  key={sp.id}
                  selected={review.people.some(p => p.id === sp.id)}
                  onClick={() => {
                    updateReviewPeople(
                      review.people.some(p => p.id === sp.id)
                        ? review.people.filter(p => p.id !== sp.id)
                        : [...review.people, { id: sp.id, name: sp.name }]
                    )
                  }}
                >{sp.name}</Chip>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#F4EDE3]">Items ({items.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowMultiSelect(!showMultiSelect); setSelectedItemIds(new Set()) }}
                className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                  showMultiSelect ? 'bg-[#D49A4A] text-white' : 'bg-[#2A1F18] text-[#9B8778]'
                }`}
              >
                {showMultiSelect ? 'Done' : 'Select'}
              </button>
              <div className="flex gap-1.5">
                <button onClick={() => bulkSet('mine')} className="px-2 py-1 rounded text-xs font-semibold bg-[#2A1F18] text-[#93B889] hover:bg-[#3A2F18] transition-colors">All Mine</button>
                <button onClick={() => bulkSet('shared')} className="px-2 py-1 rounded text-xs font-semibold bg-[#2A1F18] text-[#D49A4A] hover:bg-[#3A2F18] transition-colors">All Shared</button>
                <button onClick={() => bulkSet('everyone')} className="px-2 py-1 rounded text-xs font-semibold bg-[#2A1F18] text-[#8B7EF6] hover:bg-[#3A2F18] transition-colors">All Everyone</button>
                <button onClick={() => bulkSet('ignore')} className="px-2 py-1 rounded text-xs font-semibold bg-[#2A1F18] text-[#9B8778] hover:bg-[#3A2F18] transition-colors">Clear</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#6A5140] mb-3 flex-wrap">
            <span className="text-[#93B889]">{items.filter(i => i.classification === 'mine').length} mine</span>
            <span className="text-[#6FC2D0]">{items.filter(i => i.classification === 'person').length} person</span>
            <span className="text-[#D49A4A]">{items.filter(i => i.classification === 'shared').length} shared</span>
            <span className="text-[#8B7EF6]">{items.filter(i => i.classification === 'everyone').length} everyone</span>
            <span className="text-[#5A4638]">{items.filter(i => i.classification === 'ignore').length} ignored</span>
          </div>

          {showMultiSelect && selectedItemIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-[#2A1F18] rounded-lg border border-[#5A4638] flex-wrap">
              <span className="text-[#9B8778] text-xs font-medium">{selectedItemIds.size} selected</span>
              <div className="w-px h-4 bg-[#5A4638]" />
              <button onClick={() => applyOwnershipToSelected('mine')} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#93B889]/20 text-[#93B889] hover:bg-[#93B889]/40 transition-colors">Mine</button>
              <button onClick={() => applyOwnershipToSelected('person')} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#6FC2D0]/20 text-[#6FC2D0] hover:bg-[#6FC2D0]/40 transition-colors">Person</button>
              <button onClick={() => applyOwnershipToSelected('shared')} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#D49A4A]/20 text-[#D49A4A] hover:bg-[#D49A4A]/40 transition-colors">Shared</button>
              <button onClick={() => applyOwnershipToSelected('everyone')} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#8B7EF6]/20 text-[#8B7EF6] hover:bg-[#8B7EF6]/40 transition-colors">Everyone</button>
              <button onClick={() => applyOwnershipToSelected('ignore')} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#5A4638]/20 text-[#9B8778] hover:bg-[#5A4638]/40 transition-colors">Ignore</button>
              <div className="w-px h-4 bg-[#5A4638]" />
              {categoryOptions.length > 0 && (
                  <StyledSelect
                    value=""
                    onChange={val => { if (val) applyCategoryToSelected(val) }}
                    options={categoryOptions.map(o => ({ value: o.name, label: o.name }))}
                    placeholder="Set category"
                    size="category"
                    triggerClassName="bg-[#1B120E] min-w-[140px]"
                />
              )}
              {review.people.length > 0 && (
                <StyledSelect
                  value=""
                  onChange={val => { if (val) assignPersonToSelected(val) }}
                  options={review.people.map(p => ({ value: p.id, label: p.name }))}
                  placeholder="Assign person"
                  size="sm"
                  triggerClassName="bg-[#1B120E]"
                />
              )}
            </div>
          )}

          {categoryOptions.length > 0 && (
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#3A2A22]">
              <StyledSelect
                value={bulkCategory}
                onChange={setBulkCategory}
                options={categoryOptions.map(o => ({ value: o.name, label: o.name }))}
                placeholder="Set category for all..."
                size="category"
                triggerClassName="bg-[#2A1F18] min-w-[170px]"
              />
              <button
                onClick={bulkSetCategory}
                disabled={!bulkCategory}
                className="px-2 py-1 rounded text-xs font-semibold bg-[#D49A4A] text-white disabled:opacity-40 hover:bg-[#C1883A] transition-colors"
              >
                Apply to All
              </button>
            </div>
          )}

          {(() => {
            const catGroups = new Map<string, ReceiptReviewItem[]>()
            const uncategorized: ReceiptReviewItem[] = []
            for (const item of items) {
              if (item.category) {
                if (!catGroups.has(item.category)) catGroups.set(item.category, [])
                catGroups.get(item.category)!.push(item)
              } else {
                uncategorized.push(item)
              }
            }
            const sortedCategories = Array.from(catGroups.keys()).sort()
            const allGroups = sortedCategories.map(cat => ({ category: cat, items: catGroups.get(cat)! }))
            if (uncategorized.length > 0) allGroups.push({ category: 'Uncategorized', items: uncategorized })

            return (
              <div className="space-y-2">
                {allGroups.map(group => {
                  const isExpanded = expandedCategories.has(group.category) || !expandedCategories.size
                  const catCounts = { mine: 0, person: 0, shared: 0, everyone: 0, ignore: 0 }
                  for (const i of group.items) {
                    if (catCounts[i.classification] !== undefined) catCounts[i.classification]++
                  }
                  const totalPrice = group.items.reduce((s, i) => s + i.finalPrice, 0)
                  return (
                    <div key={group.category}>
                      <button
                        onClick={() => {
                          setExpandedCategories(prev => {
                            const next = new Set(prev)
                            if (next.has(group.category)) next.delete(group.category)
                            else next.add(group.category)
                            return next
                          })
                        }}
                        className="flex items-center justify-between w-full px-2 py-1.5 rounded bg-[#2A1F18] text-xs font-semibold text-[#B8A99A] hover:bg-[#3A2A22] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                          {group.category}
                          <span className="text-[#6A5140] font-normal">({group.items.length})</span>
                        </span>
                        <span className="text-[#6A5140] font-normal">
                          {catCounts.mine > 0 && <span className="text-[#93B889] mr-1">{catCounts.mine}m</span>}
                          {catCounts.person > 0 && <span className="text-[#6FC2D0] mr-1">{catCounts.person}p</span>}
                          {catCounts.shared > 0 && <span className="text-[#D49A4A] mr-1">{catCounts.shared}s</span>}
                          {catCounts.everyone > 0 && <span className="text-[#8B7EF6] mr-1">{catCounts.everyone}e</span>}
                          {catCounts.ignore > 0 && <span className="text-[#5A4638] mr-1">{catCounts.ignore}i</span>}
                          ${totalPrice.toFixed(2)}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="space-y-1 mt-1">
                          {group.items.map((item) => (
                            <div key={item.id} className="bg-[#1B120E] rounded-lg p-2 border border-[#3A2A22]">
                              <div className="flex items-start gap-2">
                                {showMultiSelect && (
                                  <input
                                    type="checkbox"
                                    checked={selectedItemIds.has(item.id)}
                                    onChange={() => toggleItemSelect(item.id)}
                                    className="mt-1 accent-[#D49A4A] shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={e => updateReviewItem(item.id, { name: e.target.value })}
                                      className="flex-1 bg-transparent text-[#F4EDE3] text-sm focus:outline-none min-w-0"
                                    />
                                    {item.status && item.status !== 'purchased' && STATUS_BADGES[item.status] && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_BADGES[item.status].className}`}>
                                        {STATUS_BADGES[item.status].label}
                                      </span>
                                    )}
                                    <span className="text-[#D49A4A] text-sm font-semibold shrink-0">{formatPrice(item.finalPrice)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {item.quantity != null && (
                                      <span className="text-[#6A5140] text-xs">x {item.quantity}</span>
                                    )}
                                    {item.unitPrice != null && (
                                      <span className="text-[#6A5140] text-xs">{formatPrice(item.unitPrice)} ea</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                <Chip
                                  selected={item.classification === 'mine'}
                                  onClick={() => updateReviewItem(item.id, { classification: 'mine' })}
                                  variant={item.classification === 'mine' ? 'settled' : 'default'}
                                >Mine</Chip>
                                <Chip
                                  selected={item.classification === 'person'}
                                  onClick={() => updateReviewItem(item.id, { classification: 'person' })}
                                  variant={item.classification === 'person' ? 'settled' : 'default'}
                                  className={item.classification === 'person' ? '!bg-[#6FC2D0] !text-white' : ''}
                                >Person</Chip>
                                <Chip
                                  selected={item.classification === 'shared'}
                                  onClick={() => updateReviewItem(item.id, { classification: 'shared' })}
                                  variant={item.classification === 'shared' ? 'pending' : 'default'}
                                >Shared</Chip>
                                <Chip
                                  selected={item.classification === 'everyone'}
                                  onClick={() => updateReviewItem(item.id, { classification: 'everyone' })}
                                  variant={item.classification === 'everyone' ? 'pending' : 'default'}
                                  className={item.classification === 'everyone' ? '!bg-[#8B7EF6] !text-white' : ''}
                                >Everyone</Chip>
                                <Chip
                                  selected={item.classification === 'ignore'}
                                  onClick={() => updateReviewItem(item.id, { classification: 'ignore' })}
                                  variant="default"
                                  className={item.classification === 'ignore' ? '!bg-[#5A4638] !text-[#9B8778]' : ''}
                                >Ignore</Chip>

                                <span className="text-[#6A5140] text-[10px] mx-1">|</span>

                                <span className="text-[#6A5140] text-[10px]">Cat:</span>
                                {categoryOptionsLoading ? (
                                  <span className="text-[#6A5140] text-[10px]">...</span>
                                ) : categoryOptions.length > 0 ? (
                                  <StyledSelect
                                    value={item.category || ''}
                                    onChange={val => updateReviewItem(item.id, { category: val || null })}
                                    options={categoryOptions.map(o => ({ value: o.name, label: o.name }))}
                                    placeholder="--"
                                    size="category"
                                    triggerClassName="bg-[#2A1F18] min-w-[130px] sm:min-w-[160px]"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={item.category || ''}
                                    onChange={e => updateReviewItem(item.id, { category: e.target.value || null })}
                                    placeholder="cat"
                                    className="bg-[#2A1F18] text-[#F4EDE3] text-[10px] rounded px-1 py-0.5 border border-[#5A4638] focus:outline-none focus:border-[#D49A4A] placeholder-[#6A5140] w-16"
                                  />
                                )}

                                {(item.classification === 'shared' || item.classification === 'person') && review.people.length > 0 && (
                                  <>
                                    <span className="text-[#6A5140] text-[10px] ml-1">
                                      {item.classification === 'shared' ? 'with:' : '→'}
                                    </span>
                                    {review.people.map(person => (
                                      <Chip
                                        key={person.id}
                                        selected={item.sharedWith.includes(person.id)}
                                        onClick={() => {
                                          if (item.classification === 'person') {
                                            updateReviewItem(item.id, { sharedWith: [person.id] })
                                          } else {
                                            toggleSharedWith(item.id, person.id)
                                          }
                                        }}
                                      >{person.name}</Chip>
                                    ))}
                                  </>
                                )}
                                {item.classification === 'everyone' && review.people.length > 0 && (
                                  <span className="text-[#6A5140] text-[10px]">with all ({review.people.length})</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </Card>

        {showSummary && (
          <Card>
            <h2 className="text-sm font-semibold text-[#F4EDE3] mb-2">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {review.itemsSubtotal != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Subtotal</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(review.itemsSubtotal)}</p>
                </div>
              )}
              {review.discount != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Savings</span>
                  <p className="text-[#93B889] font-semibold">-{formatPrice(Math.abs(review.discount))}</p>
                </div>
              )}
              {review.tax != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Tax</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(review.tax)}</p>
                </div>
              )}
              {review.deliveryFee != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Delivery</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(review.deliveryFee)}</p>
                </div>
              )}
              {review.tip != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Tip</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(review.tip)}</p>
                </div>
              )}
              {review.serviceFee != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Service Fee</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(review.serviceFee)}</p>
                </div>
              )}
              {review.printedTotal != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Printed Total</span>
                  <p className="text-[#D49A4A] font-semibold">{formatPrice(review.printedTotal)}</p>
                </div>
              )}
              {review.chargedAmount != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Charged</span>
                  <p className="text-[#D49A4A] font-semibold">{formatPrice(review.chargedAmount)}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-sm font-semibold text-[#F4EDE3] mb-2">Amount to Split</h2>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setFinalAmountMode('printed_total')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                review.finalAmountMode === 'printed_total'
                  ? 'bg-[#D49A4A] text-white'
                  : 'bg-[#2A1F18] text-[#9B8778] hover:bg-[#3A2A22]'
              }`}
            >
              Use Printed Total
            </button>
            <button
              onClick={() => setFinalAmountMode('items_only')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                review.finalAmountMode === 'items_only'
                  ? 'bg-[#D49A4A] text-white'
                  : 'bg-[#2A1F18] text-[#9B8778] hover:bg-[#3A2A22]'
              }`}
            >
              Use Items Only
            </button>
            <button
              onClick={() => setFinalAmountMode('items_plus_tax')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                review.finalAmountMode === 'items_plus_tax'
                  ? 'bg-[#D49A4A] text-white'
                  : 'bg-[#2A1F18] text-[#9B8778] hover:bg-[#3A2A22]'
              }`}
            >
              Use Items + Tax
            </button>
            <button
              onClick={() => setFinalAmountMode('custom')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                review.finalAmountMode === 'custom'
                  ? 'bg-[#D49A4A] text-white'
                  : 'bg-[#2A1F18] text-[#9B8778] hover:bg-[#3A2A22]'
              }`}
            >
              Custom
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#9B8778] text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={activeAmount || ''}
              onChange={e => {
                const val = e.target.value ? parseFloat(e.target.value) : 0
                setReview(prev => prev ? {
                  ...prev,
                  finalAmountToSplit: round2(val),
                  finalAmountMode: 'custom' as FinalAmountMode,
                } : prev)
              }}
              className="w-40 bg-[#1B120E] text-[#D49A4A] text-lg font-bold border border-[#5A4638] rounded-lg px-3 py-2 focus:outline-none focus:border-[#D49A4A]"
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#9B8778] mt-3">
            <div>
              <span>Included items total</span>
              <p className="text-[#F4EDE3] font-semibold">{formatPrice(calcResult.includedItemsTotal)}</p>
            </div>
            <div>
              <span>Ignored items total</span>
              <p className="text-[#5A4638] font-semibold">{formatPrice(calcResult.ignoredItemsTotal)}</p>
            </div>
            {review.discount != null && (
              <div>
                <span>Savings</span>
                <p className="text-[#93B889] font-semibold">-{formatPrice(Math.abs(review.discount))}</p>
              </div>
            )}
            {review.tax != null && (
              <div>
                <span>Tax</span>
                <p className="text-[#F4EDE3] font-semibold">{formatPrice(review.tax)}</p>
              </div>
            )}
          </div>
        </Card>

        {adjustments.filter(a => a.amount == null || Math.abs(a.amount) > 0.005).length > 0 && (
          <Card>
            <p className="text-[#D8755D] text-xs font-medium mb-1.5">Adjustments</p>
            <div className="space-y-1">
              {adjustments
                .filter(a => a.amount == null || Math.abs(a.amount) > 0.005)
                .map((adj, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-[#9B8778]">{adj.name}</span>
                  <span className="text-[#D8755D]">{adj.amount != null && adj.amount < 0 ? '' : '-'}{formatPrice(Math.abs(adj.amount ?? 0))}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#F4EDE3]">People ({review.people.length})</h2>
            <button
              onClick={addPerson}
              className="flex items-center gap-1 text-xs text-[#D49A4A] hover:text-[#C1883A] transition-colors"
            >
              <Plus size={14} />
              Add Person
            </button>
          </div>

          {review.people.length === 0 ? (
            <p className="text-[#6A5140] text-sm">Add people to split shared items with them.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {review.people.map(person => (
                <div
                  key={person.id}
                  className="flex items-center gap-1.5 bg-[#2A1F18] text-[#F4EDE3] px-3 py-1.5 rounded-full text-xs font-semibold"
                >
                  {person.name}
                  <button
                    onClick={() => removePerson(person.id)}
                    className="text-[#9B8778] hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {validationWarnings.length > 0 && (
          <Card className="border border-[#D49A4A]/30">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-[#D49A4A] shrink-0 mt-0.5" />
              <div>
                <p className="text-[#D49A4A] text-sm font-semibold">Before saving</p>
                {validationWarnings.map((w, i) => (
                  <p key={i} className="text-[#B8A99A] text-xs mt-0.5">{w}</p>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card className="border border-[#5A4638] bg-[#2A1F18] sticky bottom-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-[#F4EDE3]">Split Summary</h2>
            <label className="flex items-center gap-2 text-xs text-[#9B8778] cursor-pointer">
              <input
                type="checkbox"
                checked={includeTax}
                onChange={e => setIncludeTax(e.target.checked)}
                className="accent-[#D49A4A]"
              />
              Include tax
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-2">
            <div>
              <span className="text-[#9B8778] text-xs">My Share</span>
              <p className="text-[#F4EDE3] font-semibold text-base">{formatPrice(calcResult.myShare)}</p>
            </div>
            <div>
              <span className="text-[#9B8778] text-xs">They Owe</span>
              <p className="text-[#D49A4A] font-semibold text-base">{formatPrice(calcResult.theyOwe)}</p>
            </div>
            <div>
              <span className="text-[#9B8778] text-xs">Personal</span>
              <p className="text-[#93B889] font-semibold">{formatPrice(calcResult.personalTotal)}</p>
            </div>
            <div>
              <span className="text-[#9B8778] text-xs">Ignored</span>
              <p className="text-[#5A4638] font-semibold">{formatPrice(calcResult.ignoredItemsTotal)}</p>
            </div>
          </div>

          {review.people.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mb-2">
              {review.people.map(person => {
                const owes = calcResult.personOwes?.[person.id] ?? 0
                return (
                  <span key={person.id} className="text-[#B8A99A]">
                    {person.name}: <span className="text-[#D49A4A] font-semibold">{formatPrice(owes)}</span>
                  </span>
                )
              })}
            </div>
          )}

          <div className="pt-2 border-t border-[#3A2A22] mb-2">
            <details className="group">
              <summary className="text-xs text-[#9B8778] cursor-pointer hover:text-[#B8A99A] transition-colors select-none list-none flex items-center gap-1">
                <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
                Split Details
              </summary>
              <div className="mt-1.5 space-y-1 text-xs text-[#9B8778]">
                <div className="flex justify-between">
                  <span>Items total (non-ignored)</span>
                  <span className="text-[#F4EDE3]">{formatPrice(calcResult.includedItemsTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Final amount to split</span>
                  <span className="text-[#D49A4A]">{formatPrice(activeAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mode</span>
                  <span className="text-[#F4EDE3]">{review.finalAmountMode.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Scale factor</span>
                  <span className="text-[#F4EDE3]">{calcResult.scaleFactor.toFixed(4)}×</span>
                </div>
              </div>
            </details>
          </div>

          {calcResult.groupPreviews.length > 0 && (
            <div className="pt-2 border-t border-[#3A2A22]">
              <p className="text-xs text-[#93B889] font-semibold mb-1">
                Will create {calcResult.groupPreviews.length} expense{calcResult.groupPreviews.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-0.5 text-xs">
                {calcResult.groupPreviews.map(p => (
                  <div key={p.category} className="flex justify-between text-[#B8A99A]">
                    <span>{p.category} ({p.itemCount} item{p.itemCount !== 1 ? 's' : ''})</span>
                    <span className="text-[#F4EDE3] font-semibold">my share {formatPrice(p.myShare)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {createError && (
          <Card className="border border-red-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{createError}</p>
            </div>
          </Card>
        )}

        <div className="flex gap-3 sticky bottom-0 pb-4">
          <button
            onClick={handleRetake}
            className="flex-1 bg-[#2A1F18] text-[#B8A99A] py-3 rounded-lg font-semibold hover:bg-[#3A2A22] transition-colors text-sm"
          >
            Discard
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || validationWarnings.some(w => w.includes('No non-ignored'))}
            className="flex-1 bg-[#D49A4A] text-white py-3 rounded-lg font-semibold hover:bg-[#C1883A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {creating ? 'Creating...' : `Create ${calcResult.groupPreviews.length > 0 ? calcResult.groupPreviews.length + ' ' : ''}Expense${calcResult.groupPreviews.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
