import { NormalizedTransaction } from '@/types/transaction'
import { ColumnFilter, ActiveFilters, FilterOperator } from '@/types/filters'

let filterLogId = 0

function log(step: string, data: Record<string, unknown>) {
  filterLogId++
  console.log(`[FilterEngine #${filterLogId}] ${step}`, data)
}

function getPropertyValue(t: NormalizedTransaction, columnName: string): string | null {
  if (columnName === 'title' || columnName === 'Name') return t.title
  if (columnName === 'amount' || columnName === 'Amount') return t.amount.toString()
  if (columnName === 'category' || columnName === 'Category') return t.category ?? ''

  const raw = t.rawProperties?.[columnName]
  if (!raw) return null

  switch (raw.type) {
    case 'title':
      return raw.title?.map((r) => r.plain_text).join(' ') ?? null
    case 'rich_text':
      return raw.rich_text?.map((r) => r.plain_text).join(' ') ?? null
    case 'number':
      return raw.number?.toString() ?? null
    case 'select':
      return raw.select?.name ?? null
    case 'status':
      return raw.status?.name ?? null
    case 'multi_select':
      return raw.multi_select?.map((s) => s.name).join(', ') ?? null
    case 'date':
      return raw.date?.start ?? null
    case 'relation':
      return raw.relation?.map((r) => r.id).join(',') ?? null
    case 'checkbox':
      return raw.checkbox ? 'true' : 'false'
    case 'email':
      return raw.email ?? null
    case 'phone_number':
      return raw.phone_number ?? null
    case 'url':
      return raw.url ?? null
    default:
      return null
  }
}

function matchValue(
  value: string | null,
  filterValue: string,
  operator: FilterOperator,
): boolean {
  if (value === null) return false
  const v = value.toLowerCase().trim()
  const fv = filterValue.toLowerCase().trim()

  switch (operator) {
    case 'equals':
      return v === fv
    case 'contains':
      return v.includes(fv)
    case 'greater_than': {
      const numV = parseFloat(value)
      const numF = parseFloat(filterValue)
      if (isNaN(numV) || isNaN(numF)) return false
      return numV > numF
    }
    case 'less_than': {
      const numV = parseFloat(value)
      const numF = parseFloat(filterValue)
      if (isNaN(numV) || isNaN(numF)) return false
      return numV < numF
    }
    default:
      return false
  }
}

function matchesColumnFilter(
  t: NormalizedTransaction,
  filter: ColumnFilter,
  relationLookup: Record<string, string>,
): boolean {
  const rawValue = getPropertyValue(t, filter.columnName)

  if (filter.columnType === 'relation') {
    if (!rawValue) return false
    const txIds = rawValue.split(',').filter(Boolean)
    const txNames = txIds.map((id) => relationLookup[id] || id).filter(Boolean)
    const fvLower = filter.value.toLowerCase().trim()

    if (filter.operator === 'equals') {
      return txIds.includes(filter.value) ||
        txNames.some((n) => n.toLowerCase().trim() === fvLower)
    }
    if (filter.operator === 'contains') {
      return txNames.some((name) => name.toLowerCase().trim().includes(fvLower)) ||
        txIds.some((id) => id.toLowerCase().trim().includes(fvLower))
    }
    return false
  }

  return matchValue(rawValue, filter.value, filter.operator)
}

function matchesDateRange(
  t: NormalizedTransaction,
  dateFrom: string | null,
  dateTo: string | null,
): boolean {
  if (!dateFrom && !dateTo) return true
  if (dateFrom && t.date < dateFrom) return false
  if (dateTo && t.date > dateTo) return false
  return true
}

function matchesSearch(t: NormalizedTransaction, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const searchable = [
    t.title,
    t.category,
    t.amount.toString(),
    t.date,
  ].filter(Boolean).join(' ').toLowerCase()
  return searchable.includes(q)
}

export interface FilterResult {
  filtered: NormalizedTransaction[]
  total: number
  activeCount: number
}

export function applyFilters(
  transactions: NormalizedTransaction[],
  active: ActiveFilters,
  relationLookup: Record<string, string>,
): FilterResult {
  log('applyFilters', {
    totalInput: transactions.length,
    columnFilters: active.columnFilters.length,
    dateActive: !!(active.dateFrom || active.dateTo),
    search: active.search || null,
  })

  const filtered = transactions.filter((t) => {
    for (const cf of active.columnFilters) {
      if (!matchesColumnFilter(t, cf, relationLookup)) {
        return false
      }
    }
    if (!matchesDateRange(t, active.dateFrom, active.dateTo)) {
      return false
    }
    if (!matchesSearch(t, active.search)) {
      return false
    }
    return true
  })

  const total = filtered.reduce((sum, t) => sum + t.amount, 0)

  let activeCount = active.columnFilters.length
  if (active.dateFrom || active.dateTo) activeCount++
  if (active.search) activeCount++

  log('applyFilters result', {
    filtered: filtered.length,
    total,
    activeCount,
  })

  return { filtered, total, activeCount }
}

export function operatorsForType(type: string): { value: FilterOperator; label: string }[] {
  switch (type) {
    case 'number':
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greater_than', label: 'Greater than' },
        { value: 'less_than', label: 'Less than' },
      ]
    case 'title':
    case 'rich_text':
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'equals', label: 'Equals' },
      ]
    case 'select':
    case 'status':
      return [
        { value: 'equals', label: 'Is' },
      ]
    case 'relation':
    case 'multi_select':
      return [
        { value: 'equals', label: 'Is' },
        { value: 'contains', label: 'Contains' },
      ]
    case 'date':
      return [
        { value: 'equals', label: 'On' },
        { value: 'greater_than', label: 'After' },
        { value: 'less_than', label: 'Before' },
      ]
    default:
      return [
        { value: 'contains', label: 'Contains' },
        { value: 'equals', label: 'Equals' },
      ]
  }
}

export function chipLabel(filter: ColumnFilter, relationLookup: Record<string, string>): string {
  const opLabels: Record<string, string> = {
    equals: '=',
    contains: 'contains',
    greater_than: '>',
    less_than: '<',
  }
  const opLabel = opLabels[filter.operator] || filter.operator
  let displayValue = filter.value
  if (filter.columnType === 'relation') {
    displayValue = relationLookup[filter.value] || filter.value
  }
  return `${filter.columnName} ${opLabel} ${displayValue}`
}
