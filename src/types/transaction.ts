import { NotionPropertyValue } from './notion'

export interface NormalizedTransaction {
  id: string
  title: string
  amount: number
  paidAmount: number | null
  category: string | null
  date: string
  databaseId: string
  databaseRole: 'expense' | 'income'
  rawProperties: Record<string, NotionPropertyValue> | null
  splitMetadata: SplitMetadata | null
}

export interface SplitMetadata {
  version: 1 | 2
  split: SplitData
  receipt?: ReceiptScanMetadata
}

export interface SplitData {
  enabled: boolean
  paidAmount: number
  myShare: number
  theyOwe: number
  type: string
  status: 'pending' | 'settled'
  participants: SplitParticipant[]
  splitWith?: string
  inputs: Record<string, unknown>
  items?: SplitItem[]
}

export interface SplitParticipant {
  id: string
  name: string
  owes: number
  status: 'pending' | 'settled'
  settledAt: string | null
}

export type SplitItemAssignment = 'mine' | 'person' | 'shared' | 'everyone' | 'ignore'

export interface SplitItem {
  name: string
  price: number
  assignment: SplitItemAssignment
  sharedWith: string[]
  category?: string | null
  categoryId?: string | null
}

export interface ReceiptScanMetadata {
  source: string
  merchant: string | null
  itemCount: number
  originalTotal: number | null
  groupCategory?: string | null
  groupCategoryId?: string | null
  groupSubtotal?: number | null
  groupTax?: number | null
  originalReceiptTotal?: number | null
}

export interface SplitPerson {
  id: string
  name: string
}

export interface SplitTrackerEntry {
  transactionId: string
  transactionTitle: string
  date: string
  category: string | null
  amountOwed: number
  status: 'pending' | 'settled'
  settledAt: string | null
  participantId: string
  splitMetadata: SplitMetadata
  transaction: NormalizedTransaction
}

export interface SplitTrackerPersonGroup {
  personId: string
  personName: string
  pendingTotal: number
  settledTotal: number
  entries: SplitTrackerEntry[]
}

export interface GroupedTransactionSection {
  date: string
  displayDate: string
  transactions: NormalizedTransaction[]
  totalAmount: number
}

export interface DatabaseMappingData {
  databaseId: string
  databaseTitle: string
  role: 'expense' | 'income' | 'ignore'
  columnMapping: ColumnMapping | null
  categoryType: string | null
  categoryValuesJSON: string | null
}

export interface ColumnMapping {
  titleColumn: string | null
  amountColumn: string | null
  categoryColumn: string | null
  dateColumn: string | null
  expenseAppMetadataProperty: string | null
  categoryRelationDataSourceId: string | null
}

export interface CategoryValue {
  id: string
  name: string
  sourceType: string
}

export interface MonthMetadata {
  year: number
  month: number
  monthKey: string
}

export interface ExpenseAnalytics {
  totalSpend: number
  totalIncome: number
  netBalance: number
}
