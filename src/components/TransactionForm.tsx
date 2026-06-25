'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { NormalizedTransaction, SplitPerson } from '@/types/transaction'
import { loadConfig, getExpenseConfig, getIncomeConfig, getExpenseMapping, getIncomeMapping } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { stablePersonId, safeExtractText } from '@/lib/notion-properties'
import {
  calculateSplit,
  inferMethodFromType,
  legacyTypeToMethod,
  SplitMethodType,
  ManualSplitInput,
} from '@/lib/split-calc'
import { buildNotionProperties, buildSplitDetailsJson } from '@/lib/notion-payload'
import Card from '@/components/Card'
import Chip from '@/components/Chip'

interface TransactionFormProps {
  existing?: NormalizedTransaction
  defaultRole?: 'expense' | 'income'
}

interface SplitCalcState {
  myShare: number
  theyOwe: number
  participants: Array<{ id: string; name: string; owes: number }>
}

interface FieldOption {
  name: string
  id?: string
}

export default function TransactionForm({ existing, defaultRole }: TransactionFormProps) {
  const router = useRouter()
  const { loadData } = useCache()
  const isEdit = !!existing

  const [role, setRole] = useState<'expense' | 'income'>(existing?.databaseRole || defaultRole || 'expense')
  const [showSuccess, setShowSuccess] = useState(false)
  const [title, setTitle] = useState(existing?.title || '')
  const [amount, setAmount] = useState(() => {
    if (!existing) return ''
    if (existing.splitMetadata?.split.enabled) {
      return String(existing.splitMetadata.split.paidAmount)
    }
    return String(existing.amount)
  })
  const [date, setDate] = useState(existing?.date || new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState(existing?.category || '')

  const [categoryOptions, setCategoryOptions] = useState<FieldOption[]>([])
  const [categoryOptionsLoading, setCategoryOptionsLoading] = useState(false)
  const [categoryOptionsError, setCategoryOptionsError] = useState<string | null>(null)
  const [categoryOption, setCategoryOption] = useState<FieldOption | null>(null)

  const [monthClassificationOptions, setMonthClassificationOptions] = useState<FieldOption[]>([])
  const [monthClassificationLoading, setMonthClassificationLoading] = useState(false)
  const [monthClassificationValue, setMonthClassificationValue] = useState<FieldOption | null>(null)
  const [monthClassificationOptionsError, setMonthClassificationOptionsError] = useState<string | null>(null)
  const [monthClassificationActiveColumn, setMonthClassificationActiveColumn] = useState<string | null>(null)

  const categoryLoadRef = useRef(0)
  const monthClassificationLoadRef = useRef(0)

  const [isSplit, setIsSplit] = useState(!!existing?.splitMetadata?.split.enabled)
  const [people, setPeople] = useState<SplitPerson[]>(() => {
    if (existing?.splitMetadata?.split.enabled) {
      return existing.splitMetadata.split.participants.map(p => ({
        id: p.id,
        name: p.name,
      }))
    }
    return []
  })
  const [newPersonName, setNewPersonName] = useState('')

  const [splitMethod, setSplitMethod] = useState<SplitMethodType>(() => {
    if (existing?.splitMetadata?.split.enabled) {
      console.log(`[SplitEditPrefill] parsed=true type=${existing.splitMetadata.split.type} mappedMethod=${inferMethodFromType(existing.splitMetadata.split.type || '')} paidAmount=${existing.splitMetadata.split.paidAmount} inputs=${JSON.stringify(existing.splitMetadata.split.inputs || {})} selectedPersonIds=${JSON.stringify((existing.splitMetadata.split.participants || []).map(p => p.id))} myShare=${existing.splitMetadata.split.myShare} theyOwe=${existing.splitMetadata.split.theyOwe}`)
      return inferMethodFromType(existing.splitMetadata.split.type)
    }
    return 'equal'
  })

  const [percentMode, setPercentMode] = useState<'myPercent' | 'theirPercent'>(
    () => (existing?.splitMetadata?.split.inputs?.entryMode as 'myPercent' | 'theirPercent') || 'myPercent'
  )
  const [myPercent, setMyPercent] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.myPercent === 'number' ? String(inp.myPercent) : ''
  })
  const [theirPercent, setTheirPercent] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.theirPercent === 'number' ? String(inp.theirPercent) : ''
  })

  const [exactMode, setExactMode] = useState<'theyOwe' | 'myShare'>(
    () => (existing?.splitMetadata?.split.inputs?.entryMode as 'theyOwe' | 'myShare') || 'theyOwe'
  )
  const [customAmount, setCustomAmount] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.customAmount === 'number' ? String(inp.customAmount) : ''
  })

  const [hhsMode, setHhsMode] = useState<'iPayExtra' | 'extraTheyPay'>(
    () => (existing?.splitMetadata?.split.inputs?.entryMode as 'iPayExtra' | 'extraTheyPay') || 'iPayExtra'
  )
  const [extraAmount, setExtraAmount] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.extraAmount === 'number' ? String(inp.extraAmount) : ''
  })

  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const paidAmount = parseFloat(amount) || 0

  const splitInput: ManualSplitInput = useMemo(() => ({
    paidAmount,
    selectedPeople: people,
  }), [paidAmount, people])

  const splitExtra = useMemo(() => {
    switch (splitMethod) {
      case 'percent':
        return {
          entryMode: percentMode,
          myPercent: parseFloat(myPercent) || 0,
          theirPercent: parseFloat(theirPercent) || 0,
        }
      case 'exact':
        return {
          entryMode: exactMode,
          customAmount: parseFloat(customAmount) || 0,
        }
      case 'hhs':
        return {
          entryMode: hhsMode,
          extraAmount: parseFloat(extraAmount) || 0,
        }
      default:
        return {}
    }
  }, [splitMethod, percentMode, myPercent, theirPercent, exactMode, customAmount, hhsMode, extraAmount])

  const splitResult = useMemo<SplitCalcState>(() => {
    if (!isSplit || people.length === 0 || paidAmount <= 0) {
      return { myShare: 0, theyOwe: 0, participants: [] }
    }
    return calculateSplit(splitMethod, splitInput, splitExtra as Record<string, unknown>)
  }, [isSplit, splitMethod, splitInput, splitExtra, people.length, paidAmount])

  const notionAmount = isSplit ? splitResult.myShare : paidAmount

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

  function extractTitle(page: Record<string, unknown>): string {
    if (!page?.properties) return 'Untitled'
    const props = page.properties as Record<string, Record<string, unknown>>
    const titleProp = Object.values(props).find(v => (v as Record<string, unknown>).type === 'title')
    return safeExtractText((titleProp as Record<string, unknown>)?.title).trim() || 'Untitled'
  }

  async function loadSelectOptions(databaseId: string, columnName: string): Promise<{options: FieldOption[]; error?: string}> {
    const schema = await fetchSchema(databaseId)
    const props = schema.properties || {}
    const entries = Object.values(props) as Record<string, unknown>[]
    const prop = entries.find(p => p.name === columnName) as Record<string, unknown> | undefined
    if (!prop) return { options: [], error: `Column "${columnName}" not found in schema` }
    const typeKey = prop.type === 'multi_select' ? 'multi_select' : 'select'
    const options = (prop[typeKey] as Record<string, unknown>)?.options as Array<Record<string, unknown>> | undefined
    if (!options) return { options: [], error: `No options for ${String(prop.type)} "${columnName}"` }
    return { options: options.map(o => ({ name: String(o.name), id: o.id ? String(o.id) : undefined })) }
  }

  async function loadRelationOptions(dataSourceId?: string): Promise<{options: FieldOption[]; error?: string}> {
    if (!dataSourceId) return { options: [], error: 'No relation data source ID' }

    const config = loadConfig()
    const token = config?.notionToken

    console.log(`[CategoryDropdown] querying data-source ${dataSourceId}`)
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
    } catch (e) {
      console.warn('[CategoryDropdown] data-sources/query failed, trying databases/query:', e)
    }

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
    } catch (e) {
      console.warn('[CategoryDropdown] databases/query fallback also failed:', e)
    }

    return { options: [], error: 'Failed to load relation options' }
  }

  async function loadCategoryOptions(role: 'expense' | 'income') {
    const loadId = ++categoryLoadRef.current
    setCategoryOptionsLoading(true)
    setCategoryOptionsError(null)
    setCategoryOption(null)
    setCategory('')

    try {
      const config = loadConfig()
      if (!config) { if (loadId === categoryLoadRef.current) setCategoryOptionsLoading(false); return }

      const mapping = role === 'expense' ? getExpenseMapping(config) : getIncomeMapping(config)
      const cm = mapping?.columnMapping
      const columnName = cm?.categoryColumn
      const type = mapping?.categoryType
      const relationDSId = cm?.categoryRelationDataSourceId
      const dbId = role === 'expense' ? getExpenseConfig(config).databaseId : getIncomeConfig(config).databaseId

      console.log(`[CategoryDropdown] Mapped column: "${columnName}", type: "${type}", relationDSId: "${relationDSId}"`)

      if (!columnName || !type) {
        console.log('[CategoryDropdown] No category column mapping')
        if (loadId === categoryLoadRef.current) {
          setCategoryOptions([])
          setCategoryOptionsLoading(false)
        }
        return
      }

      console.log(`[CategoryDropdown] Loading ${type} options...`)

      let loaded: FieldOption[] = []
      let loadError: string | undefined

      if (type === 'relation') {
        const { options, error } = await loadRelationOptions(relationDSId || undefined)
        loadError = error
        loaded = options
      } else if (type === 'select' || type === 'multi_select') {
        const { options, error } = await loadSelectOptions(dbId, columnName)
        loadError = error
        loaded = options
      }

      if (loadId !== categoryLoadRef.current) return

      if (loadError) {
        console.log(`[CategoryDropdown] Error: ${loadError}`)
        setCategoryOptionsError(loadError)
      } else {
        console.log(`[CategoryDropdown] Loaded ${loaded.length} options`)
        setCategoryOptions(loaded)
        if (existing && existing.category) {
          const matched = loaded.find(o => o.name === existing.category)
          if (matched) {
            setCategoryOption(matched)
            setCategory(matched.name)
          }
        }
      }
    } catch (e) {
      if (loadId !== categoryLoadRef.current) return
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`[CategoryDropdown] Error: ${msg}`)
      setCategoryOptionsError(msg)
    } finally {
      if (loadId === categoryLoadRef.current) setCategoryOptionsLoading(false)
    }
  }

  function autoSelectMonth(dateStr: string, options: FieldOption[]): FieldOption | null {
    if (!dateStr || options.length === 0) return null

    const d = new Date(dateStr + 'T12:00:00')
    if (isNaN(d.getTime())) return null

    const month = d.getMonth()
    const year = d.getFullYear()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const shortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthName = monthNames[month]
    const shortName = shortNames[month]
    const yearStr = String(year)
    const monthPadded = String(month + 1).padStart(2, '0')

    const candidates = [
      `${monthName} ${year}`,
      `${shortName} ${year}`,
      `${monthName}, ${year}`,
      `${shortName}, ${year}`,
      `${year}-${monthPadded}`,
      `${monthPadded}-${year}`,
      `${monthName} ${yearStr}`,
      `${shortName} ${yearStr}`,
      `${monthName.toUpperCase()} ${year}`,
      `${shortName.toUpperCase()} ${year}`,
      monthName,
      shortName,
      monthName.toUpperCase(),
    ]

    for (const candidate of candidates) {
      const match = options.find(o => o.name.trim().toLowerCase() === candidate.trim().toLowerCase())
      if (match) return match
    }

    for (const option of options) {
      const title = option.name
      if (title.toLowerCase().includes(monthName.toLowerCase()) && title.includes(yearStr)) {
        return option
      }
      if (title.toLowerCase().includes(shortName.toLowerCase()) && title.includes(yearStr)) {
        return option
      }
    }

    return null
  }

  function getMonthClassificationColumn(schema: Record<string, unknown>): { columnName: string; fieldType: string; relationDSId: string | null } | null {
    const props = Object.values((schema.properties || {})) as Record<string, unknown>[]
    const mcProp = props.find(
      p => String(p.name ?? '').toLowerCase().includes('month classification') && p.type === 'relation'
    ) as Record<string, unknown> | undefined
    if (!mcProp) return null
    const relation = mcProp.relation as Record<string, unknown> | undefined
    const dsId = (relation?.database_id ?? relation?.data_source_id) as string | null
    return { columnName: String(mcProp.name), fieldType: 'relation', relationDSId: dsId }
  }

  async function loadMonthClassificationOptions(role: 'expense' | 'income') {
    const loadId = ++monthClassificationLoadRef.current
    setMonthClassificationLoading(true)
    setMonthClassificationValue(null)
    setMonthClassificationOptionsError(null)
    setMonthClassificationOptions([])
    setMonthClassificationActiveColumn(null)

    try {
      const config = loadConfig()
      if (!config) { if (loadId === monthClassificationLoadRef.current) setMonthClassificationLoading(false); return }

      const mapping = role === 'expense' ? getExpenseMapping(config) : getIncomeMapping(config)
      const cm = mapping?.columnMapping

      let columnName = cm?.monthClassificationColumn || null
      let fieldType = cm?.monthClassificationType || null
      let relationDSId = cm?.monthClassificationRelationDataSourceId || null

      if (!columnName || !fieldType) {
        const dbId = role === 'expense' ? getExpenseConfig(config).databaseId : getIncomeConfig(config).databaseId
        if (dbId) {
          const schema = await fetchSchema(dbId)
          const detected = getMonthClassificationColumn(schema)
          if (detected) {
            columnName = detected.columnName
            fieldType = detected.fieldType
            relationDSId = detected.relationDSId
            console.log(`[MonthClassification] Auto-detected: column=${columnName} type=${fieldType} dsId=${relationDSId}`)
          }
        }
      }

      if (!columnName || !fieldType) {
        console.log('[MonthClassification] No month classification column')
        if (loadId === monthClassificationLoadRef.current) {
          setMonthClassificationLoading(false)
        }
        return
      }

      setMonthClassificationActiveColumn(columnName)

      if (fieldType !== 'relation') {
        console.log(`[MonthClassification] Unsupported type: ${fieldType} — only relation supported`)
        if (loadId === monthClassificationLoadRef.current) {
          setMonthClassificationLoading(false)
        }
        return
      }

      const { options, error } = await loadRelationOptions(relationDSId || undefined)

      if (error) {
        console.log(`[MonthClassification] Error: ${error}`)
        if (loadId === monthClassificationLoadRef.current) {
          setMonthClassificationOptionsError(error)
          setMonthClassificationLoading(false)
        }
        return
      }

      if (loadId !== monthClassificationLoadRef.current) return
      console.log(`[MonthClassification] Loaded ${options.length} options`)
      setMonthClassificationOptions(options)

      let preselected: FieldOption | null = null

      if (existing && existing.rawProperties && columnName) {
        const mcRawProp = (existing.rawProperties as Record<string, unknown>)[columnName] as Record<string, unknown> | undefined
        const relationArr = mcRawProp?.relation as Array<{ id: string }> | undefined
        const relationIds = relationArr?.map(r => r.id) || []
        preselected = options.find(o => relationIds.includes(o.id || '')) || null
      }

      if (!preselected) {
        preselected = autoSelectMonth(date, options)
      }

      if (loadId !== monthClassificationLoadRef.current) return
      if (preselected) setMonthClassificationValue(preselected)
    } catch (e) {
      if (loadId !== monthClassificationLoadRef.current) return
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[MonthClassification] Failed to load:', msg)
      setMonthClassificationOptionsError(msg)
      setMonthClassificationOptions([])
    } finally {
      if (loadId === monthClassificationLoadRef.current) setMonthClassificationLoading(false)
    }
  }

  const addPerson = useCallback(() => {
    const name = newPersonName.trim()
    if (!name) return
    const id = stablePersonId(name)
    if (people.some(p => p.id === id)) return
    setPeople(prev => [...prev, { id, name }])
    setNewPersonName('')
  }, [newPersonName, people])

  const removePerson = useCallback((id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id))
  }, [])

  useEffect(() => {
    loadCategoryOptions(role)
    loadMonthClassificationOptions(role)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  useEffect(() => {
    if (monthClassificationOptions.length > 0) {
      const matched = autoSelectMonth(date, monthClassificationOptions)
      if (matched && matched.id !== monthClassificationValue?.id) {
        setMonthClassificationValue(matched)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, monthClassificationOptions])

  const resetForm = () => {
    setTitle('')
    setAmount('')
    setDate(new Date().toISOString().split('T')[0])
    setCategory('')
    setCategoryOption(null)
    setMonthClassificationValue(null)
    setIsSplit(false)
    setPeople([])
    setNewPersonName('')
    setSplitMethod('equal')
    setPercentMode('myPercent')
    setMyPercent('')
    setTheirPercent('')
    setExactMode('theyOwe')
    setCustomAmount('')
    setHhsMode('iPayExtra')
    setExtraAmount('')
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 3000)
  }

  const handleSubmit = async () => {
    const config = loadConfig()
    if (!config) return
    const expenseCfg = getExpenseConfig(config)
    const incomeCfg = getIncomeConfig(config)

    setSaving(true)
    try {
      let splitMetadata = null
      let finalAmount = parseFloat(amount) || 0

      if (isSplit && people.length > 0) {
        splitMetadata = buildSplitDetailsJson(
          paidAmount,
          splitResult.myShare,
          splitResult.theyOwe,
          legacyTypeToMethod(splitMethod),
          splitResult.participants,
          splitExtra as Record<string, unknown>
        )
        finalAmount = splitResult.myShare
      }

      const mapping = role === 'expense' ? getExpenseMapping(config) : getIncomeMapping(config)
      const categoryType = mapping?.categoryType
      const categoryId = categoryType === 'relation' ? categoryOption?.id : undefined
      const categoryName = categoryOption?.name || category || null
      console.log(`[CategoryDropdown] Selected: ${categoryName}, ID: ${categoryId}, type: ${categoryType}`)

      const mcColumnName = monthClassificationActiveColumn || null
      const mcFieldType = mcColumnName ? 'relation' : null
      const mcId = monthClassificationValue?.id || undefined
      console.log(`[MonthClassification] selected=${monthClassificationValue?.name} column=${mcColumnName}`)

      const properties = buildNotionProperties(config, role, {
        title: title || `${role === 'expense' ? 'Expense' : 'Income'} - ${date}`,
        amount: finalAmount,
        date,
        category: categoryName,
        splitMetadata,
        monthClassification: {
          columnName: mcColumnName,
          fieldType: mcFieldType,
          relationId: mcId,
          name: null,
        },
      }, categoryType, categoryId)

      if (isEdit && existing) {
        const res = await fetch(`/api/notion/pages/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: config.notionToken, properties }),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        const res = await fetch('/api/notion/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: config.notionToken,
            databaseId: role === 'expense' ? expenseCfg.databaseId : incomeCfg.databaseId,
            properties,
          }),
        })
        if (!res.ok) throw new Error('Failed to create')
      }

      // Refresh cache in background
      await loadData()

      if (isEdit && existing) {
        router.push(existing.databaseRole === 'expense' ? '/expenses' : '/income')
      } else {
        // Stay on form after add, reset fields
        resetForm()
      }
    } catch (e) {
      alert('Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const config = loadConfig()
    if (!config || !existing) return

    setSaving(true)
    try {
      const res = await fetch(`/api/notion/pages/${existing.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: config.notionToken }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      await loadData()
      router.push(existing.databaseRole === 'expense' ? '/expenses' : '/income')
    } catch {
      alert('Failed to delete transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      {showSuccess && (
        <div className="mb-4 p-3 bg-[#93B889]/20 border border-[#93B889] rounded-xl text-[#93B889] text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          Transaction saved successfully
        </div>
      )}
      <Card className="p-6 space-y-5">
        {!isEdit && (
          <div>
            <label className="text-[#B8A99A] text-xs font-medium block mb-2">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setRole('expense'); setIsSplit(false) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  role === 'expense'
                    ? 'bg-[#D8755D] text-white'
                    : 'bg-[#403027] text-[#B8A99A]'
                }`}
              >
                Expense
              </button>
              <button
                onClick={() => { setRole('income'); setIsSplit(false) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  role === 'income'
                    ? 'bg-[#93B889] text-white'
                    : 'bg-[#403027] text-[#B8A99A]'
                }`}
              >
                Income
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="text-[#B8A99A] text-xs font-medium block mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={role === 'expense' ? 'Lunch at Cafe' : 'Freelance Payment'}
            className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A] placeholder-[#9B8778]"
          />
        </div>

        <div>
          <label className="text-[#B8A99A] text-xs font-medium block mb-1.5">
            Amount {isSplit ? '(paid amount)' : ''}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A] placeholder-[#9B8778]"
          />
          {isSplit && people.length > 0 && paidAmount > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              <p className="text-[#93B889]">My share: ${splitResult.myShare.toFixed(2)}</p>
              <p className="text-[#D8755D]">They owe: ${splitResult.theyOwe.toFixed(2)}</p>
              {splitResult.participants.map(p => (
                <p key={p.id} className="text-[#B8A99A] pl-3">
                  {p.name}: ${p.owes.toFixed(2)}
                </p>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[#B8A99A] text-xs font-medium block mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A]"
          />
        </div>

        <div>
          <label className="text-[#B8A99A] text-xs font-medium block mb-1.5">Category</label>
          {categoryOptionsLoading ? (
            <div className="w-full bg-[#403027] text-[#B8A99A] rounded-lg px-3 py-2.5 text-sm">
              Loading categories...
            </div>
          ) : categoryOptionsError ? (
            <div className="w-full bg-[#403027] text-[#D8755D] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847]">
              Failed to load: {categoryOptionsError}
              <button onClick={() => loadCategoryOptions(role)} className="ml-2 underline text-[#D49A4A]">
                Retry
              </button>
            </div>
          ) : categoryOptions.length > 0 ? (
            <select
              value={categoryOption?.name || ''}
              onChange={(e) => {
                const selected = categoryOptions.find(o => o.name === e.target.value) || null
                setCategoryOption(selected)
                setCategory(selected?.name || e.target.value)
              }}
              className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A]"
            >
              <option value="">Select a category</option>
              {categoryOptions.map(opt => (
                <option key={opt.id || opt.name} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={categoryOption?.name || category}
              onChange={e => {
                setCategoryOption({ name: e.target.value })
                setCategory(e.target.value)
              }}
              placeholder="e.g. Food, Transport"
              className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A] placeholder-[#9B8778]"
            />
          )}
        </div>

        {monthClassificationOptionsError ? (
          <div>
            <label className="text-[#B8A99A] text-xs font-medium block mb-1.5">Month Classification</label>
            <div className="w-full bg-[#403027] text-[#D8755D] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847]">
              Failed to load: {monthClassificationOptionsError}
              <button onClick={() => loadMonthClassificationOptions(role)} className="ml-2 underline text-[#D49A4A]">
                Retry
              </button>
            </div>
          </div>
        ) : monthClassificationLoading ? (
          <div>
            <label className="text-[#B8A99A] text-xs font-medium block mb-1.5">Month Classification</label>
            <div className="w-full bg-[#403027] text-[#B8A99A] rounded-lg px-3 py-2.5 text-sm">
              Loading months...
            </div>
          </div>
        ) : monthClassificationOptions.length > 0 ? (
          <div>
            <label className="text-[#B8A99A] text-xs font-medium block mb-1.5">Month Classification</label>
            <select
              value={monthClassificationValue?.name || ''}
              onChange={(e) => {
                const selected = monthClassificationOptions.find(o => o.name === e.target.value) || null
                setMonthClassificationValue(selected)
              }}
              className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2.5 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A]"
            >
              <option value="">Select a month</option>
              {monthClassificationOptions.map(opt => (
                <option key={opt.id || opt.name} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {role === 'expense' && (
          <>
            <div className="border-t border-[#6B5847] pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsSplit(!isSplit)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    isSplit ? 'bg-[#D49A4A]' : 'bg-[#403027]'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 bg-[#35281F] rounded-full absolute top-0.5 transition-transform ${
                      isSplit ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </div>
                <span className="text-[#B8A99A] text-sm">Split expense</span>
              </label>
            </div>

            {isSplit && (
              <div className="space-y-4 border-t border-[#6B5847] pt-4">
                <div>
                  <label className="text-[#B8A99A] text-xs font-medium block mb-2">People</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {people.map(p => (
                      <Chip
                        key={p.id}
                        selected
                        onClick={() => removePerson(p.id)}
                        variant="pending"
                      >
                        {p.name} ✕
                      </Chip>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPersonName}
                      onChange={e => setNewPersonName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPerson() } }}
                      placeholder="Add person..."
                      className="flex-1 bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A] placeholder-[#9B8778]"
                    />
                    <button
                      onClick={addPerson}
                      disabled={!newPersonName.trim()}
                      className="bg-[#D49A4A] text-white px-3 rounded-lg text-sm disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[#B8A99A] text-xs font-medium block mb-2">Split Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['equal', 'percent', 'exact', 'hhs'] as SplitMethodType[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setSplitMethod(m)}
                        className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                          splitMethod === m
                            ? 'bg-[#D49A4A] text-white'
                            : 'bg-[#403027] text-[#B8A99A]'
                        }`}
                      >
                        {m === 'equal' ? 'Equal' : m === 'percent' ? 'Percent' : m === 'exact' ? 'Exact' : 'Adjust'}
                      </button>
                    ))}
                  </div>
                </div>

                {splitMethod === 'percent' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Chip selected={percentMode === 'myPercent'} onClick={() => setPercentMode('myPercent')}>My %</Chip>
                      <Chip selected={percentMode === 'theirPercent'} onClick={() => setPercentMode('theirPercent')}>Their %</Chip>
                    </div>
                    {percentMode === 'myPercent' ? (
                      <div>
                        <label className="text-[#B8A99A] text-xs block mb-1">My percent</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={myPercent}
                          onChange={e => setMyPercent(e.target.value)}
                          className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A]"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[#B8A99A] text-xs block mb-1">Their total percent</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={theirPercent}
                          onChange={e => setTheirPercent(e.target.value)}
                          className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {splitMethod === 'exact' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Chip selected={exactMode === 'theyOwe'} onClick={() => setExactMode('theyOwe')}>They owe</Chip>
                      <Chip selected={exactMode === 'myShare'} onClick={() => setExactMode('myShare')}>My share</Chip>
                    </div>
                    <div>
                      <label className="text-[#B8A99A] text-xs block mb-1">
                        {exactMode === 'theyOwe' ? 'Total they owe' : 'My share amount'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value)}
                        className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A]"
                      />
                    </div>
                  </div>
                )}

                {splitMethod === 'hhs' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Chip selected={hhsMode === 'iPayExtra'} onClick={() => setHhsMode('iPayExtra')}>I pay extra</Chip>
                      <Chip selected={hhsMode === 'extraTheyPay'} onClick={() => setHhsMode('extraTheyPay')}>They pay extra</Chip>
                    </div>
                    <div>
                      <label className="text-[#B8A99A] text-xs block mb-1">Extra amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={extraAmount}
                        onChange={e => setExtraAmount(e.target.value)}
                        className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2 text-sm border border-[#6B5847] focus:outline-none focus:border-[#D49A4A]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="pt-2 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={saving || !amount || parseFloat(amount) <= 0 || (isSplit && people.length === 0)}
            className="w-full bg-[#D49A4A] text-white rounded-xl py-3 text-base font-semibold hover:bg-[#C1883A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : isEdit ? 'Update' : `Add ${role === 'expense' ? 'Expense' : 'Income'}`}
          </button>

          {isEdit && (
            <>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full bg-[#403027] text-[#D8755D] rounded-xl py-3 text-sm font-semibold border border-[#6B5847] hover:bg-[#D8755D] hover:text-white transition-colors"
                >
                  Delete
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 bg-[#403027] text-[#B8A99A] rounded-xl py-2.5 text-sm border border-[#6B5847]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 bg-[#D8755D] text-white rounded-xl py-2.5 text-sm font-semibold"
                  >
                    Confirm Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
