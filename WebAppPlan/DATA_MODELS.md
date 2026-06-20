# Data Models (TypeScript)

All types mirror iOS Swift structs exactly. No `convertFromSnakeCase` — manual mapping everywhere.

## NormalizedTransaction

```typescript
interface NormalizedTransaction {
  id: string                    // Notion page ID
  title: string
  amount: number                // abs()'d
  paidAmount: number | null     // from split metadata (full paid amount)
  category: string | null
  date: Date
  databaseId: string
  databaseRole: 'expense' | 'income'
  rawProperties: Record<string, NotionPropertyValue> | null
  splitMetadata: SplitMetadata | null
}

// Computed:
function isSplit(t: NormalizedTransaction): boolean  // t.splitMetadata?.enabled === true
function effectiveAmount(t: NormalizedTransaction): number  // split.myShare or amount
```

## DatabaseMapping

```typescript
interface DatabaseMappingData {
  databaseId: string
  databaseTitle: string
  role: 'expense' | 'income' | 'ignore'
  columnMapping: ColumnMapping | null
  categoryType: 'select' | 'multi_select' | 'relation' | null
  categoryValuesJSON: string | null
}

interface ColumnMapping {
  titleColumn: string | null
  amountColumn: string | null
  categoryColumn: string | null
  dateColumn: string | null
  expenseAppMetadataProperty: string | null  // rich_text for Split Details JSON
  categoryRelationDataSourceId: string | null
}
```

## SplitMetadata (v1 + v2)

```typescript
interface SplitMetadata {
  version: 1 | 2
  split: {
    enabled: boolean
    paidAmount: number
    myShare: number
    theyOwe: number
    type: SplitType  // see below
    status: 'pending' | 'settled'
    participants: SplitParticipant[]       // v2 only
    splitWith?: string                     // v1 only
    inputs: Record<string, any>            // method-specific
    items?: SplitItem[]                    // receipt scan only
  }
  receipt?: ReceiptScanMetadata            // receipt scan only
}

type SplitType =
  | 'manualEqual'
  | 'manualPercent'
  | 'manualCustom'
  | 'manualHHS'
  | 'receiptMultiPerson'
  // Legacy v1 types:
  | 'half' | '50/50' | 'Split Equally' | 'Custom Amount' | 'shares'

interface SplitParticipant {
  id: string         // stable person ID
  name: string
  owes: number
  status: 'pending' | 'settled'
  settledAt: string | null  // ISO8601
}

interface SplitItem {
  name: string
  price: number
  assignment: 'mine' | 'shared' | 'ignore'
  sharedWith: string[]  // person IDs
}

interface SplitInputs {
  myShare?: number
  myPercent?: number
  theirPercent?: number
  adjustmentAmount?: number
  adjustmentMode?: 'iPayExtra' | 'extraTheyPay'
  entryMode?: 'theyOwe' | 'myShare' | 'myPercent' | 'theirPercent' | 'iPayExtra' | 'extraTheyPay'
  extraAmount?: number
  baseShare?: number
  customAmount?: number
}
```

## SplitPerson

```typescript
interface SplitPerson {
  id: string    // stablePersonId — lowercase, no diacritics, spaces→hyphens
  name: string
}
```

## SplitTrackerEntry & SplitTrackerPersonGroup

```typescript
interface SplitTrackerEntry {
  transactionId: string
  transactionTitle: string
  date: Date
  category: string | null
  amountOwed: number
  status: 'pending' | 'settled'
  settledAt: string | null
  participantId: string
  splitMetadata: SplitMetadata
  transaction: NormalizedTransaction
}

interface SplitTrackerPersonGroup {
  personId: string
  personName: string
  pendingTotal: number
  settledTotal: number
  entries: SplitTrackerEntry[]
}
```

## GroupedTransactionSection

```typescript
interface GroupedTransactionSection {
  date: string        // "2026-06-15"
  displayDate: string // "Jun 15, 2026"
  transactions: NormalizedTransaction[]
  totalAmount: number
}
```

## Receipt Models (Gemini Parsing)

```typescript
interface GeminiReceiptResult {
  merchant: string | null
  platform: string | null          // avoid "Walmart via Walmart" display
  date: string | null              // "2026-06-15"
  orderNumber: string | null
  currency: string                 // default "USD"
  items: GeminiReceiptItem[]
  summary: GeminiReceiptSummary
  adjustments: GeminiReceiptAdjustment[]
  warnings: string[]
  rawText: string
}

interface GeminiReceiptItem {
  id: string
  name: string
  quantity: number | null
  unitPrice: number | null
  finalPrice: number
  categoryHint: string | null
  rawText: string | null
  classification: 'mine' | 'shared' | 'ignore'
  isEditable: boolean
  sharedWith: string[]
}

interface GeminiReceiptSummary {
  itemsSubtotal: number | null
  tax: number | null
  serviceFee: number | null
  deliveryFee: number | null
  tip: number | null
  discount: number | null
  total: number | null
  totalCharged: number | null
}

interface GeminiReceiptAdjustment {
  name: string
  type: 'refund' | 'weightAdjustment' | 'substitution' | 'discount' | 'fee' | 'unknown'
  amount: number | null
  description: string | null
}
```

## ReceiptScanMetadata

```typescript
interface ReceiptScanMetadata {
  source: string       // "geminiReceiptScan"
  merchant: string | null
  itemCount: number
  originalTotal: number | null
}
```

## Budget Models

```typescript
interface BudgetCategoryItem {
  categoryPageId: string
  categoryName: string
  iconEmoji: string | null
  spent: number
  budget: number | null
  // utilizationPercent = (spent / budget) * 100
  // status: overBudget (pct > 1.0), warning (>= 0.8), safe, noBudget
}

type BudgetStatus = 'overBudget' | 'warning' | 'safe' | 'noBudget'
```

## Notion API Models

```typescript
interface NotionPage {
  id: string
  createdTime: string
  lastEditedTime: string
  parent: { type: string; databaseId?: string; pageId?: string }
  url: string
  properties: Record<string, NotionPropertyValue> | null
  archived: boolean
}

// Discriminated union based on `type` field
type NotionPropertyValue =
  | { type: 'title'; title: Array<{ plain_text: string }> }
  | { type: 'rich_text'; rich_text: Array<{ plain_text: string }> }
  | { type: 'number'; number: number | null }
  | { type: 'select'; select: { name: string; id: string } | null }
  | { type: 'multi_select'; multi_select: Array<{ name: string; id: string }> }
  | { type: 'date'; date: { start: string; end: string | null } | null }
  | { type: 'relation'; relation: Array<{ id: string }> }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'url'; url: string | null }
  | { type: 'email'; email: string | null }
  | { type: 'phone_number'; phone_number: string | null }
  | { type: 'status'; status: { name: string } | null }
```

## Filter Models

```typescript
type FilterCondition =
  | 'contains' | 'equals' | 'notEquals'
  | 'isEmpty' | 'isNotEmpty'
  | 'greaterThan' | 'lessThan' | 'between'
  | 'before' | 'after'
  | 'isChecked' | 'isUnchecked'

type FilterValue =
  | { type: 'text'; value: string }
  | { type: 'number'; value: number }
  | { type: 'numberRange'; from: number; to: number }
  | { type: 'date'; value: Date }
  | { type: 'dateRange'; from?: Date; to?: Date }
  | { type: 'select'; value: string }
  | { type: 'multiSelect'; value: string }
  | { type: 'relation'; id: string; title: string }
  | { type: 'checkbox'; value: boolean }

interface TransactionFilter {
  id: string
  propertyName: string
  propertyType: NotionPropertyType
  condition: FilterCondition
  value: FilterValue | null
}

interface DateRangeFilter {
  fromDate: Date | null
  toDate: Date | null
}
```

## CategoryValue

```typescript
interface CategoryValue {
  id: string
  name: string
  sourceType: 'select' | 'multi_select' | 'relation'
}
```

## Stable Person ID Algorithm

Must match iOS exactly:

```typescript
function stablePersonId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/\s+/g, '-')                                 // spaces → hyphens
    .replace(/[^a-z0-9-]/g, '')                           // strip unsupported chars
}
// "Sandy" → "sandy"
// "José" → "jose"
// "John Doe" → "john-doe"
```

## Dynamic Form Value (form state)

```typescript
interface DynamicFormValue {
  propertyName: string
  propertyType: NotionPropertyType
  stringValue: string | null
  numberValue: number | null
  boolValue: boolean | null
  dateValue: string | null      // "2026-06-15"
  selectValue: string | null    // name
  multiSelectValues: string[]
  relationIds: string[]
}

// isEmpty: checkbox always returns false
function isEmpty(val: DynamicFormValue): boolean {
  if (val.propertyType === 'checkbox') return false
  // ... check all other values are null/empty
}
```

## NotionPropertyType

```typescript
type NotionPropertyType =
  | 'title' | 'rich_text' | 'number' | 'select'
  | 'multi_select' | 'date' | 'relation' | 'checkbox'
  | 'url' | 'email' | 'phone_number' | 'status'
```

## MonthMetadata

```typescript
interface MonthMetadata {
  year: number
  month: number
  monthKey: string  // "2026-06"
}
```
