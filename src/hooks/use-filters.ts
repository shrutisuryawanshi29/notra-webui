'use client'

import { useState, useMemo, useCallback } from 'react'
import { NormalizedTransaction } from '@/types/transaction'
import { ColumnFilter, FilterDraft, ActiveFilters, FilterableColumn, FilterOption } from '@/types/filters'
import { applyFilters, FilterResult } from '@/lib/filter-engine'
import { useCache } from './use-notra-cache'

let nextFilterId = 1
function genId() {
  return `cf_${nextFilterId++}`
}

export interface UseFiltersReturn {
  draft: FilterDraft
  sheetOpen: boolean
  active: ActiveFilters
  result: FilterResult
  activeCount: number
  filteredColumns: FilterableColumn[]
  columnOptions: Record<string, FilterOption[]>

  openSheet: () => void
  closeSheet: () => void
  setDraft: (draft: FilterDraft) => void
  applyFilters: () => void
  clearAll: () => void
  removeColumnFilter: (id: string) => void
  removeActiveFilter: (id: string) => void
  clearDateRange: () => void
  addColumnFilter: (columnName: string, columnType: string) => void
  updateColumnFilter: (id: string, updates: Partial<ColumnFilter>) => void
  updateDateFrom: (value: string | null) => void
  updateDateTo: (value: string | null) => void
  updateSearch: (query: string) => void
}

export function useFilters(
  transactions: NormalizedTransaction[],
  role: 'expense' | 'income',
): UseFiltersReturn {
  const { state } = useCache()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>({ columnFilters: [], dateFrom: null, dateTo: null })
  const [active, setActive] = useState<ActiveFilters>({
    columnFilters: [],
    dateFrom: null,
    dateTo: null,
    search: '',
  })

  const relationLookup = useMemo(() => {
    const cat = role === 'expense'
      ? (state.expenseRelationCategoryLookup || {})
      : (state.incomeRelationCategoryLookup || {})
    const mc = role === 'expense'
      ? (state.expenseMonthClassificationLookup || {})
      : (state.incomeMonthClassificationLookup || {})
    return { ...cat, ...mc }
  }, [
    role,
    state.expenseRelationCategoryLookup,
    state.incomeRelationCategoryLookup,
    state.expenseMonthClassificationLookup,
    state.incomeMonthClassificationLookup,
  ])

  const result = useMemo<FilterResult>(
    () => applyFilters(transactions, active, relationLookup),
    [transactions, active, relationLookup],
  )

  const activeCount = useMemo(() => {
    let count = 0
    if (active.columnFilters.length > 0) count += active.columnFilters.length
    if (active.dateFrom || active.dateTo) count++
    if (active.search) count++
    return count
  }, [active])

  const filteredColumns = useMemo<FilterableColumn[]>(() => {
    const cols: FilterableColumn[] = [
      { name: 'Category', type: 'select', label: 'Category' },
      { name: 'Amount', type: 'number', label: 'Amount' },
      { name: 'Title', type: 'title', label: 'Title' },
    ]

    if (transactions.length > 0) {
      const seen = new Set<string>(cols.map((c) => c.name))
      for (const t of transactions) {
        if (t.rawProperties) {
          for (const [key] of Object.entries(t.rawProperties)) {
            if (!seen.has(key)) {
              seen.add(key)
              const propType = t.rawProperties[key]?.type || 'rich_text'
              cols.push({ name: key, type: propType, label: key })
            }
          }
        }
      }
    }

    return cols
  }, [transactions])

  const columnOptions = useMemo<Record<string, FilterOption[]>>(() => {
    const opts: Record<string, FilterOption[]> = {}

    for (const col of filteredColumns) {
      if (col.name === 'Category') {
        const cats = new Set<string>()
        for (const t of transactions) {
          if (t.category) cats.add(t.category)
        }
        opts[col.name] = [...cats].sort().map((c) => ({ value: c, label: c }))
        continue
      }

      if (col.type === 'relation') {
        const seen = new Set<string>()
        const items: FilterOption[] = []
        for (const t of transactions) {
          const prop = t.rawProperties?.[col.name]
          if (prop?.type === 'relation') {
            for (const rel of prop.relation || []) {
              if (seen.has(rel.id)) continue
              seen.add(rel.id)
              const name = relationLookup[rel.id]
              items.push({ value: rel.id, label: name || rel.id })
            }
          }
        }
        items.sort((a, b) => a.label.localeCompare(b.label))
        opts[col.name] = items
        continue
      }

      if (col.type === 'select' || col.type === 'status') {
        const options = new Set<string>()
        for (const t of transactions) {
          const prop = t.rawProperties?.[col.name]
          if (!prop) continue
          if (prop.type === 'select' && prop.select?.name) options.add(prop.select.name)
          if (prop.type === 'status' && prop.status?.name) options.add(prop.status.name)
        }
        opts[col.name] = [...options].sort().map((c) => ({ value: c, label: c }))
        continue
      }

      if (col.type === 'multi_select') {
        const options = new Set<string>()
        for (const t of transactions) {
          const prop = t.rawProperties?.[col.name]
          if (prop?.type === 'multi_select') {
            for (const s of prop.multi_select || []) {
              if (s.name) options.add(s.name)
            }
          }
        }
        opts[col.name] = [...options].sort().map((c) => ({ value: c, label: c }))
        continue
      }
    }

    return opts
  }, [filteredColumns, transactions, relationLookup])

  const openSheet = useCallback(() => {
    setDraft({
      columnFilters: active.columnFilters.map((cf) => ({ ...cf })),
      dateFrom: active.dateFrom,
      dateTo: active.dateTo,
    })
    setSheetOpen(true)
  }, [active])

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
  }, [])

  const handleApply = useCallback(() => {
    setActive((prev) => ({
      ...prev,
      columnFilters: draft.columnFilters,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
    }))
    setSheetOpen(false)
  }, [draft])

  const handleClearAll = useCallback(() => {
    setDraft({ columnFilters: [], dateFrom: null, dateTo: null })
  }, [])

  const removeColumnFilter = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      columnFilters: prev.columnFilters.filter((cf) => cf.id !== id),
    }))
  }, [])

  const removeActiveFilter = useCallback((id: string) => {
    setActive((prev) => ({
      ...prev,
      columnFilters: prev.columnFilters.filter((cf) => cf.id !== id),
    }))
  }, [])

  const clearDateRange = useCallback(() => {
    setActive((prev) => ({ ...prev, dateFrom: null, dateTo: null }))
    setDraft((prev) => ({ ...prev, dateFrom: null, dateTo: null }))
  }, [])

  const addColumnFilter = useCallback((columnName: string, columnType: string) => {
    const operator = columnType === 'number' ? 'equals' : 'equals'
    setDraft((prev) => ({
      ...prev,
      columnFilters: [
        ...prev.columnFilters,
        { id: genId(), columnName, columnType, operator, value: '' },
      ],
    }))
  }, [])

  const updateColumnFilter = useCallback((id: string, updates: Partial<ColumnFilter>) => {
    setDraft((prev) => ({
      ...prev,
      columnFilters: prev.columnFilters.map((cf) =>
        cf.id === id ? { ...cf, ...updates } : cf,
      ),
    }))
  }, [])

  const updateDateFrom = useCallback((value: string | null) => {
    setDraft((prev) => ({ ...prev, dateFrom: value }))
  }, [])

  const updateDateTo = useCallback((value: string | null) => {
    setDraft((prev) => ({ ...prev, dateTo: value }))
  }, [])

  const updateSearch = useCallback((query: string) => {
    setActive((prev) => ({ ...prev, search: query }))
  }, [])

  return {
    draft,
    sheetOpen,
    active,
    result,
    activeCount,
    filteredColumns,
    columnOptions,
    openSheet,
    closeSheet,
    setDraft,
    applyFilters: handleApply,
    clearAll: handleClearAll,
    removeColumnFilter,
    removeActiveFilter,
    clearDateRange,
    addColumnFilter,
    updateColumnFilter,
    updateDateFrom,
    updateDateTo,
    updateSearch,
  }
}
