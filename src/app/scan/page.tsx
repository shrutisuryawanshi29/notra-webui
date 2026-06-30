'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isSetupComplete, getExpenseConfig, getExpenseMapping, getGeminiKey, getNotionToken, loadConfig } from '@/lib/config'
import { getStoredGeminiModel } from '@/lib/gemini-config'
import { buildNotionProperties } from '@/lib/notion-payload'
import { calculateReceiptSplit } from '@/lib/split-calc'
import { getSplitPeople } from '@/lib/split-people'
import type { GeminiReceiptResult, GeminiReceiptItem, GeminiReceiptPerson, GeminiClassification } from '@/types/gemini'
import type { SplitMetadata, SplitItem, ReceiptScanMetadata } from '@/types/transaction'
import Card from '@/components/Card'
import Chip from '@/components/Chip'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Upload, Camera, ArrowLeft, X, Plus, AlertTriangle } from 'lucide-react'

type Phase = 'upload' | 'review'

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function formatPrice(cents: number): string {
  return `$${cents.toFixed(2)}`
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]
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

export default function ScanPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [result, setResult] = useState<GeminiReceiptResult | null>(null)
  const [merchant, setMerchant] = useState('')
  const [date, setDate] = useState(todayString())
  const [items, setItems] = useState<GeminiReceiptItem[]>([])
  const [people, setPeople] = useState<GeminiReceiptPerson[]>([])
  const [includeTax, setIncludeTax] = useState(true)
  const [categoryOptions, setCategoryOptions] = useState<{ name: string; id?: string }[]>([])
  const [categoryOptionsLoading, setCategoryOptionsLoading] = useState(true)
  const [categoryType, setCategoryType] = useState<string | null>(null)
  const [savedPeople, setSavedPeople] = useState<{ id: string; name: string }[]>([])
  const [categoryRelationDsId, setCategoryRelationDsId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [showMultiSelect, setShowMultiSelect] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategoryOptions()
  }, [loadCategoryOptions])

  useEffect(() => {
    if (phase === 'review') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedPeople(getSplitPeople())
    }
  }, [phase])

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
      setMerchant(scanResult.merchant || '')
      setDate(scanResult.date || todayString())
      setItems(scanResult.items.map(item => ({ ...item })))

      const initialPeople: GeminiReceiptPerson[] = []
      setPeople(initialPeople)

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

  const updateItem = useCallback((id: string, upd: Partial<GeminiReceiptItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const next = { ...item, ...upd }
      if (upd.classification === 'everyone') {
        next.sharedWith = people.map(p => p.id)
      } else if (upd.classification === 'person') {
        next.sharedWith = item.classification === 'person' ? item.sharedWith : []
      } else if (upd.classification === 'mine' || upd.classification === 'ignore') {
        next.sharedWith = []
      }
      if (upd.classification === 'person' && item.classification !== 'person' && people.length > 0) {
        next.sharedWith = [people[0].id]
      }
      return next
    }))
  }, [people])

  const toggleItemSelect = useCallback((id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedItemIds(prev => {
      if (prev.size === items.length) return new Set()
      return new Set(items.map(i => i.id))
    })
  }, [items])

  const applyOwnershipToSelected = useCallback((classification: GeminiClassification) => {
    setItems(prev => prev.map(item => {
      if (!selectedItemIds.has(item.id)) return item
      const next = { ...item, classification }
      if (classification === 'everyone') {
        next.sharedWith = people.map(p => p.id)
      } else if (classification === 'person') {
        next.sharedWith = people.length > 0 ? [people[0].id] : []
      } else {
        next.sharedWith = []
      }
      return next
    }))
    setSelectedItemIds(new Set())
  }, [selectedItemIds, people])

  const applyCategoryToSelected = useCallback((cat: string) => {
    setItems(prev => prev.map(item =>
      selectedItemIds.has(item.id) ? { ...item, category: cat } : item
    ))
    setSelectedItemIds(new Set())
  }, [selectedItemIds])

  const assignPersonToSelected = useCallback((personId: string) => {
    setItems(prev => prev.map(item => {
      if (!selectedItemIds.has(item.id)) return item
      return { ...item, classification: 'person', sharedWith: [personId] }
    }))
    setSelectedItemIds(new Set())
  }, [selectedItemIds])

  const addPerson = useCallback(() => {
    const name = prompt('Enter person name:')
    if (name?.trim()) {
      const newPerson: GeminiReceiptPerson = { id: generateId(), name: name.trim() }
      setPeople(prev => [...prev, newPerson])
    }
  }, [])

  const removePerson = useCallback((personId: string) => {
    setPeople(prev => prev.filter(p => p.id !== personId))
    setItems(prev => prev.map(item => ({
      ...item,
      sharedWith: item.sharedWith.filter(id => id !== personId),
    })))
  }, [])

  useEffect(() => {
    const allIds = people.map(p => p.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(prev => prev.map(item =>
      item.classification === 'everyone' ? { ...item, sharedWith: allIds } : item
    ))
  }, [people])

  const toggleSharedWith = useCallback((itemId: string, personId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item
      const has = item.sharedWith.includes(personId)
      return {
        ...item,
        sharedWith: has
          ? item.sharedWith.filter(id => id !== personId)
          : [...item.sharedWith, personId],
      }
    }))
  }, [])

  const bulkSet = useCallback((classification: GeminiClassification) => {
    setItems(prev => prev.map(item => {
      const next = { ...item, classification }
      if (classification === 'everyone') {
        next.sharedWith = people.map(p => p.id)
      } else if (classification === 'person') {
        next.sharedWith = people.length > 0 ? [people[0].id] : []
      } else {
        next.sharedWith = []
      }
      return next
    }))
  }, [people])

  const [bulkCategory, setBulkCategory] = useState('')
  const bulkSetCategory = useCallback(() => {
    if (!bulkCategory) return
    setItems(prev => prev.map(item => ({ ...item, category: bulkCategory })))
  }, [bulkCategory])

  const splitTotals = useMemo(() => {
    let personalTotal = 0
    let sharedTotal = 0
    let personTotal = 0
    let everyoneTotal = 0

    for (const item of items) {
      switch (item.classification) {
        case 'mine': personalTotal += item.finalPrice; break
        case 'shared': sharedTotal += item.finalPrice; break
        case 'person': personTotal += item.finalPrice; break
        case 'everyone': everyoneTotal += item.finalPrice; break
      }
    }

    let mySharedPortion = 0
    const personOwes: Record<string, number> = {}
    for (const person of people) {
      personOwes[person.id] = 0
    }

    for (const item of items) {
      if (item.classification === 'shared' && item.sharedWith.length > 0) {
        const shareCount = item.sharedWith.length + 1
        const perPerson = item.finalPrice / shareCount
        mySharedPortion += perPerson
        for (const pid of item.sharedWith) {
          personOwes[pid] = (personOwes[pid] || 0) + perPerson
        }
      } else if (item.classification === 'everyone' && people.length > 0) {
        const perPerson = item.finalPrice / (people.length + 1)
        mySharedPortion += perPerson
        for (const pid of people.map(p => p.id)) {
          personOwes[pid] = (personOwes[pid] || 0) + perPerson
        }
      } else if (item.classification === 'person' && item.sharedWith[0]) {
        const pid = item.sharedWith[0]
        personOwes[pid] = (personOwes[pid] || 0) + item.finalPrice
      }
    }

    const myShare = personalTotal + mySharedPortion
    const theyOwe = sharedTotal + personTotal + everyoneTotal - mySharedPortion

    if (result?.summary.tax != null && includeTax) {
      const taxableTotal = items.reduce((s, i) =>
        i.classification !== 'ignore' ? s + i.finalPrice : s, 0
      )
      if (taxableTotal > 0) {
        const taxRatio = result.summary.tax / taxableTotal
        const myTax = myShare * taxRatio
        return { personalTotal, sharedTotal, myShare: myShare + myTax, theyOwe: theyOwe + (result.summary.tax - myTax), taxAllocation: myTax, personOwes }
      }
    }

    return { personalTotal, sharedTotal, myShare, theyOwe, personOwes }
  }, [items, people, includeTax, result])

  const groupPreviews = useMemo(() => {
    const nonIgnore = items.filter(i => i.classification !== 'ignore')
    const taxableTotal = nonIgnore.reduce((s, i) => s + i.finalPrice, 0)
    const totalTax = (result?.summary.tax != null && includeTax) ? result.summary.tax : 0
    const taxRatio = taxableTotal > 0 ? totalTax / taxableTotal : 0

    const groups = new Map<string, { items: GeminiReceiptItem[]; subtotal: number; tax: number }>()
    for (const item of nonIgnore) {
      const cat = item.category || 'Uncategorized'
      if (!groups.has(cat)) groups.set(cat, { items: [], subtotal: 0, tax: 0 })
      const g = groups.get(cat)!
      g.items.push(item)
      g.subtotal += item.finalPrice
      g.tax += item.finalPrice * taxRatio
    }

    const previews: { category: string; itemCount: number; paidAmount: number; myShare: number }[] = []
    for (const [cat, g] of groups) {
      const paidAmount = g.subtotal + g.tax
      const effectiveItems: SplitItem[] = g.items.map(item => ({
        name: item.name,
        price: item.finalPrice * (1 + taxRatio),
        assignment: item.classification as SplitItem['assignment'],
        sharedWith: item.sharedWith,
        category: item.category,
      }))
      const result_ = calculateReceiptSplit(effectiveItems, paidAmount, people)
      previews.push({ category: cat, itemCount: g.items.length, paidAmount, myShare: result_.myShare })
    }
    return previews
  }, [items, people, includeTax, result])

  const validationWarnings = useMemo(() => {
    const warnings: string[] = []
    const noCat = items.filter(i => i.classification !== 'ignore' && !i.category)
    if (noCat.length > 0) warnings.push(`${noCat.length} item(s) without category: "${noCat[0].name}"`)

    const noOwner = items.filter(i => i.classification !== 'ignore' && !i.classification)
    if (noOwner.length > 0) warnings.push(`${noOwner.length} item(s) without ownership`)

    const personNoPerson = items.filter(i => i.classification === 'person' && i.sharedWith.length === 0)
    if (personNoPerson.length > 0) warnings.push(`${personNoPerson.length} person-assigned item(s) without a person selected`)

    const sharedNoPeople = items.filter(i => i.classification === 'shared' && i.sharedWith.length === 0 && people.length > 0)
    if (sharedNoPeople.length > 0) warnings.push(`${sharedNoPeople.length} shared item(s) without people selected — they will be split among everyone`)

    if (items.filter(i => i.classification !== 'ignore').length === 0) {
      warnings.push('No non-ignored items — transaction would be empty')
    }
    return warnings
  }, [items, people])

  const handleCreate = useCallback(async () => {
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

      const nonIgnoreItems = items.filter(i => i.classification !== 'ignore')

      const uncategorized = nonIgnoreItems.filter(i => !i.category)
      if (uncategorized.length > 0) {
        throw new Error(`Set a category for each item before saving. Missing: "${uncategorized[0].name}"`)
      }

      const taxableTotal = nonIgnoreItems.reduce((sum, i) => sum + i.finalPrice, 0)
      const totalTax = (result?.summary.tax != null && includeTax) ? result.summary.tax : 0
      const taxRatio = taxableTotal > 0 ? totalTax / taxableTotal : 0

      const categoryGroups = new Map<string, GeminiReceiptItem[]>()
      for (const item of nonIgnoreItems) {
        const key = item.category || 'Uncategorized'
        if (!categoryGroups.has(key)) categoryGroups.set(key, [])
        categoryGroups.get(key)!.push(item)
      }

      let firstError: string | null = null
      let createdCount = 0

      for (const [catName, groupItems] of categoryGroups.entries()) {
        const catOption = categoryOptions.find(o => o.name === catName)
        const catId = categoryType === 'relation' ? catOption?.id : undefined

        const splitItems: SplitItem[] = groupItems.map(item => ({
          name: item.name,
          price: item.finalPrice,
          assignment: item.classification,
          sharedWith: item.sharedWith,
          category: item.category,
          categoryId: catId,
        }))

        const groupItemPrice = groupItems.reduce((s, i) => s + i.finalPrice, 0)
        const groupTax = groupItemPrice * taxRatio
        const groupPaidAmount = groupItemPrice + groupTax

        const effectiveItems: SplitItem[] = splitItems.map(item => ({
          ...item,
          price: item.price * (1 + taxRatio),
        }))

        const groupResult = calculateReceiptSplit(effectiveItems, groupPaidAmount, people)

        const groupTitle = `${merchant || 'Receipt'} - ${catName}`

        const receiptMeta: ReceiptScanMetadata = {
          source: 'gemini-v1',
          merchant: merchant || null,
          itemCount: groupItems.length,
          originalTotal: result?.summary.total ?? result?.summary.totalCharged ?? null,
          groupCategory: catName,
          groupCategoryId: catId ?? null,
          groupSubtotal: groupItemPrice,
          groupTax,
          originalReceiptTotal: result?.summary.totalCharged ?? result?.summary.total ?? null,
        }

        const groupSplitMetadata: SplitMetadata = {
          version: 2,
          split: {
            enabled: true,
            paidAmount: groupPaidAmount,
            myShare: groupResult.myShare,
            theyOwe: groupResult.theyOwe,
            type: 'receiptMultiPerson',
            status: 'pending',
            participants: groupResult.participants.map(p => ({
              id: p.id,
              name: p.name,
              owes: p.owes,
              status: 'pending' as const,
              settledAt: null,
            })),
            items: splitItems,
            inputs: { includeTax },
          },
          receipt: receiptMeta,
        }

        const properties = buildNotionProperties(
          config, 'expense',
          {
            title: groupTitle,
            amount: groupResult.myShare,
            date,
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
  }, [merchant, date, categoryOptions, categoryType, items, people, includeTax, result, router])

  const handleRetake = useCallback(() => {
    setPhase('upload')
    setResult(null)
    setPreviewUrl(null)
    setError(null)
    setMerchant('')
    setDate(todayString())
    setItems([])
    setPeople([])
  }, [])

  if (!isSetupComplete()) return null

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
                      capture="environment"
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
                        capture="environment"
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

  const itemCount = items.length
  const mineCount = items.filter(i => i.classification === 'mine').length
  const sharedCount = items.filter(i => i.classification === 'shared').length
  const ignoreCount = items.filter(i => i.classification === 'ignore').length
  const summaryData = result?.summary
  const showSummary = !!(summaryData && (summaryData.itemsSubtotal != null ||
    summaryData.tax != null || summaryData.serviceFee != null ||
    summaryData.deliveryFee != null || summaryData.tip != null ||
    summaryData.discount != null || summaryData.total != null ||
    summaryData.totalCharged != null))

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
                value={merchant}
                onChange={e => setMerchant(e.target.value)}
                className="w-full bg-[#1B120E] text-[#F4EDE3] border border-[#5A4638] rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:border-[#D49A4A]"
                placeholder="Store name"
              />
            </div>
            <div>
              <label className="text-xs text-[#9B8778] font-semibold uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
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
                  selected={people.some(p => p.id === sp.id)}
                  onClick={() => {
                    setPeople(prev =>
                      prev.some(p => p.id === sp.id)
                        ? prev.filter(p => p.id !== sp.id)
                        : [...prev, { id: sp.id, name: sp.name }]
                    )
                  }}
                >{sp.name}</Chip>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#F4EDE3]">Items ({itemCount})</h2>
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
                <select
                  onChange={e => { if (e.target.value) applyCategoryToSelected(e.target.value) }}
                  className="bg-[#1B120E] text-[#F4EDE3] text-[10px] rounded px-1.5 py-0.5 border border-[#5A4638] focus:outline-none focus:border-[#D49A4A]"
                  defaultValue=""
                >
                  <option value="" disabled>Set category</option>
                  {categoryOptions.map(opt => (
                    <option key={opt.id || opt.name} value={opt.name}>{opt.name}</option>
                  ))}
                </select>
              )}
              {people.length > 0 && (
                <select
                  onChange={e => { if (e.target.value) assignPersonToSelected(e.target.value) }}
                  className="bg-[#1B120E] text-[#F4EDE3] text-[10px] rounded px-1.5 py-0.5 border border-[#5A4638] focus:outline-none focus:border-[#D49A4A]"
                  defaultValue=""
                >
                  <option value="" disabled>Assign person</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {categoryOptions.length > 0 && (
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-[#3A2A22]">
              <select
                value={bulkCategory}
                onChange={e => setBulkCategory(e.target.value)}
                className="bg-[#2A1F18] text-[#F4EDE3] text-xs rounded px-2 py-1.5 border border-[#5A4638] focus:outline-none focus:border-[#D49A4A]"
              >
                <option value="">Set category for all...</option>
                {categoryOptions.map(opt => (
                  <option key={opt.id || opt.name} value={opt.name}>{opt.name}</option>
                ))}
              </select>
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
            const catGroups = new Map<string, GeminiReceiptItem[]>()
            const uncategorized: GeminiReceiptItem[] = []
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
                                      onChange={e => updateItem(item.id, { name: e.target.value })}
                                      className="flex-1 bg-transparent text-[#F4EDE3] text-sm focus:outline-none min-w-0"
                                    />
                                    <span className="text-[#D49A4A] text-sm font-semibold shrink-0">{formatPrice(item.finalPrice)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {item.quantity != null && (
                                      <span className="text-[#6A5140] text-xs">x {item.quantity}</span>
                                    )}
                                    {item.unitPrice != null && (
                                      <span className="text-[#6A5140] text-xs">{formatPrice(item.unitPrice)} ea</span>
                                    )}
                                    {item.categoryHint && item.category === item.categoryHint && (
                                      <span className="text-[#6A5140] text-[10px]">(auto-detected)</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                <Chip
                                  selected={item.classification === 'mine'}
                                  onClick={() => updateItem(item.id, { classification: 'mine' })}
                                  variant={item.classification === 'mine' ? 'settled' : 'default'}
                                >Mine</Chip>
                                <Chip
                                  selected={item.classification === 'person'}
                                  onClick={() => updateItem(item.id, { classification: 'person' })}
                                  variant={item.classification === 'person' ? 'settled' : 'default'}
                                  className={item.classification === 'person' ? '!bg-[#6FC2D0] !text-white' : ''}
                                >Person</Chip>
                                <Chip
                                  selected={item.classification === 'shared'}
                                  onClick={() => updateItem(item.id, { classification: 'shared' })}
                                  variant={item.classification === 'shared' ? 'pending' : 'default'}
                                >Shared</Chip>
                                <Chip
                                  selected={item.classification === 'everyone'}
                                  onClick={() => updateItem(item.id, { classification: 'everyone' })}
                                  variant={item.classification === 'everyone' ? 'pending' : 'default'}
                                  className={item.classification === 'everyone' ? '!bg-[#8B7EF6] !text-white' : ''}
                                >Everyone</Chip>
                                <Chip
                                  selected={item.classification === 'ignore'}
                                  onClick={() => updateItem(item.id, { classification: 'ignore' })}
                                  variant="default"
                                  className={item.classification === 'ignore' ? '!bg-[#5A4638] !text-[#9B8778]' : ''}
                                >Ignore</Chip>

                                <span className="text-[#6A5140] text-[10px] mx-1">|</span>

                                <span className="text-[#6A5140] text-[10px]">Cat:</span>
                                {categoryOptionsLoading ? (
                                  <span className="text-[#6A5140] text-[10px]">...</span>
                                ) : categoryOptions.length > 0 ? (
                                  <select
                                    value={item.category || ''}
                                    onChange={e => updateItem(item.id, { category: e.target.value || null })}
                                    className="bg-[#2A1F18] text-[#F4EDE3] text-[10px] rounded px-1 py-0.5 border border-[#5A4638] focus:outline-none focus:border-[#D49A4A] max-w-[100px]"
                                  >
                                    <option value="">--</option>
                                    {categoryOptions.map(opt => (
                                      <option key={opt.id || opt.name} value={opt.name}>{opt.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={item.category || ''}
                                    onChange={e => updateItem(item.id, { category: e.target.value || null })}
                                    placeholder="cat"
                                    className="bg-[#2A1F18] text-[#F4EDE3] text-[10px] rounded px-1 py-0.5 border border-[#5A4638] focus:outline-none focus:border-[#D49A4A] placeholder-[#6A5140] w-16"
                                  />
                                )}

                                {(item.classification === 'shared' || item.classification === 'person') && people.length > 0 && (
                                  <>
                                    <span className="text-[#6A5140] text-[10px] ml-1">
                                      {item.classification === 'shared' ? 'with:' : '→'}
                                    </span>
                                    {people.map(person => (
                                      <Chip
                                        key={person.id}
                                        selected={item.sharedWith.includes(person.id)}
                                        onClick={() => {
                                          if (item.classification === 'person') {
                                            updateItem(item.id, { sharedWith: [person.id] })
                                          } else {
                                            toggleSharedWith(item.id, person.id)
                                          }
                                        }}
                                      >{person.name}</Chip>
                                    ))}
                                  </>
                                )}
                                {item.classification === 'everyone' && people.length > 0 && (
                                  <span className="text-[#6A5140] text-[10px]">with all ({people.length})</span>
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

        {showSummary && <Card>
            <h2 className="text-sm font-semibold text-[#F4EDE3] mb-2">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {result.summary.itemsSubtotal != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Subtotal</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(result.summary.itemsSubtotal)}</p>
                </div>
              )}
              {result.summary.tax != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Tax</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(result.summary.tax)}</p>
                </div>
              )}
              {result.summary.deliveryFee != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Delivery</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(result.summary.deliveryFee)}</p>
                </div>
              )}
              {result.summary.tip != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Tip</span>
                  <p className="text-[#F4EDE3] font-semibold">{formatPrice(result.summary.tip)}</p>
                </div>
              )}
              {result.summary.discount != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Discount</span>
                  <p className="text-[#93B889] font-semibold">-{formatPrice(Math.abs(result.summary.discount))}</p>
                </div>
              )}
              {result.summary.total != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Total</span>
                  <p className="text-[#D49A4A] font-semibold">{formatPrice(result.summary.total)}</p>
                </div>
              )}
              {result.summary.totalCharged != null && (
                <div>
                  <span className="text-[#9B8778] text-xs">Charged</span>
                  <p className="text-[#D49A4A] font-semibold">{formatPrice(result.summary.totalCharged)}</p>
                </div>
              )}
            </div>
          </Card>
        }

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#F4EDE3]">People ({people.length})</h2>
            <button
              onClick={addPerson}
              className="flex items-center gap-1 text-xs text-[#D49A4A] hover:text-[#C1883A] transition-colors"
            >
              <Plus size={14} />
              Add Person
            </button>
          </div>

          {people.length === 0 ? (
            <p className="text-[#6A5140] text-sm">Add people to split shared items with them.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {people.map(person => (
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
              <p className="text-[#F4EDE3] font-semibold text-base">{formatPrice(splitTotals.myShare)}</p>
            </div>
            <div>
              <span className="text-[#9B8778] text-xs">They Owe</span>
              <p className="text-[#D49A4A] font-semibold text-base">{formatPrice(splitTotals.theyOwe)}</p>
            </div>
            <div>
              <span className="text-[#9B8778] text-xs">Personal</span>
              <p className="text-[#93B889] font-semibold">{formatPrice(splitTotals.personalTotal)}</p>
            </div>
            <div>
              <span className="text-[#9B8778] text-xs">Ignored</span>
              <p className="text-[#5A4638] font-semibold">{formatPrice(items.filter(i => i.classification === 'ignore').reduce((s, i) => s + i.finalPrice, 0))}</p>
            </div>
          </div>

          {people.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mb-2">
              {people.map(person => {
                const owes = splitTotals.personOwes?.[person.id] ?? 0
                return (
                  <span key={person.id} className="text-[#B8A99A]">
                    {person.name}: <span className="text-[#D49A4A] font-semibold">{formatPrice(owes)}</span>
                  </span>
                )
              })}
            </div>
          )}

          {groupPreviews.length > 0 && (
            <div className="pt-2 border-t border-[#3A2A22]">
              <p className="text-xs text-[#93B889] font-semibold mb-1">
                Will create {groupPreviews.length} expense{groupPreviews.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-0.5 text-xs">
                {groupPreviews.map(p => (
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
            {creating ? 'Creating...' : `Create ${groupPreviews.length > 0 ? groupPreviews.length + ' ' : ''}Expense${groupPreviews.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
