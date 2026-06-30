import { DatabaseMappingData, ColumnMapping, CategoryValue, SetupState } from './setup-state'

export interface NotraConfig {
  notionToken: string
  selectedPageId: string
  selectedPageTitle: string
  databaseMappings: Record<string, DatabaseMappingData>
  categoryValues?: Record<string, CategoryValue[]>
  geminiKey?: string
}

const STORAGE_KEY = 'notra-config'

export function getGeminiKey(): string | null {
  const config = loadConfig()
  return config?.geminiKey ?? null
}

export function saveGeminiKey(key: string): void {
  const config = loadConfig() || {
    notionToken: '',
    selectedPageId: '',
    selectedPageTitle: '',
    databaseMappings: {},
  }
  config.geminiKey = key
  saveConfig(config)
}

export function loadConfig(): NotraConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as NotraConfig
  } catch {
    return null
  }
}

export function saveConfig(config: NotraConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearConfig(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function isSetupComplete(): boolean {
  const config = loadConfig()
  if (!config) return false
  return (
    config.notionToken.length > 0 &&
    Object.values(config.databaseMappings).some(m => m.columnMapping !== null)
  )
}

export function getNotionToken(): string | null {
  const config = loadConfig()
  return config?.notionToken ?? null
}

export function buildConfigFromSetupState(state: SetupState): NotraConfig {
  return {
    notionToken: state.notionToken,
    selectedPageId: state.selectedPageId || '',
    selectedPageTitle: state.selectedPageTitle || '',
    databaseMappings: state.databaseMappings,
  }
}

// Backward-compatible helpers to extract flat config from the mappings dict

export function getExpenseMapping(config: NotraConfig): DatabaseMappingData | undefined {
  return Object.values(config.databaseMappings).find(m => m.role === 'expense')
}

export function getIncomeMapping(config: NotraConfig): DatabaseMappingData | undefined {
  return Object.values(config.databaseMappings).find(m => m.role === 'income')
}

export function getExpenseConfig(config: NotraConfig) {
  const mapping = getExpenseMapping(config)
  const cm = mapping?.columnMapping
  return {
    databaseId: mapping?.databaseId || '',
    titleColumn: cm?.titleColumn || '',
    amountColumn: cm?.amountColumn || '',
    dateColumn: cm?.dateColumn || '',
    categoryColumn: cm?.categoryColumn || '',
    metadataColumn: cm?.expenseAppMetadataProperty || '',
    monthClassificationColumn: cm?.monthClassificationColumn || '',
    monthClassificationType: cm?.monthClassificationType || '',
    monthClassificationRelationDataSourceId: cm?.monthClassificationRelationDataSourceId || '',
  }
}

export function getIncomeConfig(config: NotraConfig) {
  const mapping = getIncomeMapping(config)
  const cm = mapping?.columnMapping
  return {
    databaseId: mapping?.databaseId || '',
    titleColumn: cm?.titleColumn || '',
    amountColumn: cm?.amountColumn || '',
    dateColumn: cm?.dateColumn || '',
    categoryColumn: cm?.categoryColumn || '',
    metadataColumn: '',
    monthClassificationColumn: cm?.monthClassificationColumn || '',
    monthClassificationType: cm?.monthClassificationType || '',
    monthClassificationRelationDataSourceId: cm?.monthClassificationRelationDataSourceId || '',
  }
}
