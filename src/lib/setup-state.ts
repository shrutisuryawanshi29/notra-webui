export type DatabaseRole = 'expense' | 'income' | 'ignore'

export interface DatabaseProperty {
  name: string
  type: string
  relationDataSourceId?: string
}

export interface DiscoveredDatabase {
  id: string
  title: string
  properties: Record<string, DatabaseProperty>
}

export interface ColumnMapping {
  titleColumn: string | null
  amountColumn: string | null
  categoryColumn: string | null
  categoryRelationDataSourceId: string | null
  dateColumn: string | null
  expenseAppMetadataProperty: string | null
}

export interface CategoryValue {
  id: string
  name: string
  sourceType: string
}

export interface DatabaseMappingData {
  databaseId: string
  databaseTitle: string
  role: DatabaseRole
  columnMapping: ColumnMapping | null
  categoryType: string | null
  categoryValuesJSON: string | null
}

export interface SetupState {
  notionToken: string
  selectedPageId: string | null
  selectedPageTitle: string | null
  discoveredDatabases: DiscoveredDatabase[]
  databaseMappings: Record<string, DatabaseMappingData>
}

const STORAGE_KEY = 'notra-setup'

export function loadSetupState(): SetupState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SetupState
  } catch {
    return null
  }
}

export function saveSetupState(state: SetupState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearSetupState(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function getCurrentSetupStep(state: SetupState): 'token' | 'pages' | 'roles' | 'mapping' | 'complete' {
  if (!state.notionToken) return 'token'
  if (!state.selectedPageId) return 'pages'
  if (Object.keys(state.databaseMappings).length === 0) return 'roles'
  const allMapped = Object.values(state.databaseMappings).every(m => m.columnMapping !== null)
  if (!allMapped) return 'mapping'
  return 'complete'
}

export function getFirstUnmappedDatabase(state: SetupState): { mapping: DatabaseMappingData; discovered: DiscoveredDatabase } | null {
  const unmappedExpense = Object.values(state.databaseMappings).find(
    m => m.role === 'expense' && m.columnMapping === null
  )
  const target = unmappedExpense || Object.values(state.databaseMappings).find(
    m => m.role === 'income' && m.columnMapping === null
  )
  if (!target) return null
  const discovered = state.discoveredDatabases.find(d => d.id === target.databaseId)
  if (!discovered) return null
  return { mapping: target, discovered }
}

export const COMPATIBLE_TYPES: Record<string, string[]> = {
  title: ['title', 'rich_text'],
  amount: ['number'],
  date: ['date'],
  category: ['select', 'multi_select', 'relation', 'rich_text', 'status'],
  appMetadata: ['rich_text', 'text'],
}

export function autoSuggestMapping(properties: Record<string, DatabaseProperty>): ColumnMapping {
  const mapping: ColumnMapping = {
    titleColumn: null,
    amountColumn: null,
    categoryColumn: null,
    categoryRelationDataSourceId: null,
    dateColumn: null,
    expenseAppMetadataProperty: null,
  }

  for (const [colName, prop] of Object.entries(properties)) {
    const lowerName = colName.toLowerCase()

    if (!mapping.titleColumn && (prop.type === 'title' || prop.type === 'rich_text')) {
      mapping.titleColumn = colName
    }

    if (!mapping.amountColumn && (
      lowerName.includes('amount') ||
      lowerName.includes('total') ||
      lowerName.includes('price') ||
      lowerName.includes('cost') ||
      prop.type === 'number'
    )) {
      mapping.amountColumn = colName
    }

    if (!mapping.categoryColumn && (
      lowerName.includes('category') ||
      lowerName.includes('type') ||
      lowerName.includes('expense') ||
      lowerName.includes('source')
    )) {
      mapping.categoryColumn = colName
      if (prop.type === 'relation') {
        mapping.categoryRelationDataSourceId = prop.relationDataSourceId || null
      }
    }

    if (!mapping.dateColumn && (
      lowerName.includes('date') ||
      lowerName.includes('created') ||
      lowerName.includes('purchase') ||
      lowerName.includes('time') ||
      prop.type === 'date'
    )) {
      mapping.dateColumn = colName
    }

    if (!mapping.expenseAppMetadataProperty && (prop.type === 'rich_text' || prop.type === 'text')) {
      const candidates = ['split details', 'app metadata', 'metadata', 'notra metadata', 'split metadata', 'app data', 'notra data']
      if (candidates.includes(lowerName)) {
        mapping.expenseAppMetadataProperty = colName
      }
    }
  }

  return mapping
}
