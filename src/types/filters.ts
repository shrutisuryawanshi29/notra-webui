export type FilterOperator = 'equals' | 'contains' | 'greater_than' | 'less_than'

export interface FilterOption {
  value: string
  label: string
}

export interface ColumnFilter {
  id: string
  columnName: string
  columnType: string
  operator: FilterOperator
  value: string
}

export interface FilterDraft {
  columnFilters: ColumnFilter[]
  dateFrom: string | null
  dateTo: string | null
}

export interface ActiveFilters {
  columnFilters: ColumnFilter[]
  dateFrom: string | null
  dateTo: string | null
  search: string
}

export interface FilterableColumn {
  name: string
  type: string
  label: string
}
