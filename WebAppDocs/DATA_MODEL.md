# Data Models

## NormalizedTransaction

The universal transaction model used throughout the app (in `Models/GroupedTransactionSection.swift`):

```swift
struct NormalizedTransaction {
    id: String              // Notion page ID
    title: String
    amount: Double          // abs()'d amount
    paidAmount: Double?     // From split metadata (the full paid amount, not the share)
    category: String?
    date: Date
    databaseId: String
    databaseRole: DatabaseRole  // .expense, .income, or .ignore
    rawProperties: [String: NotionPropertyValue]?  // Original Notion properties
    splitMetadata: SplitMetadata?
}
```

Key computed properties:
- `isSplit`: `splitMetadata?.enabled == true`
- `effectiveAmount`: `split.myShare` if split, else `amount`
- `reimbursementAmount`: `split.theyOwe` or `paidAmount - amount`

## DatabaseRole

```swift
enum DatabaseRole {
    case expense
    case income
    case ignore
}
```

## DatabaseMappingData

```swift
struct DatabaseMappingData: Codable {
    let databaseId: String
    let databaseTitle: String
    let role: DatabaseRole
    var columnMapping: ColumnMapping?
    var categoryType: String?       // "select", "multi_select", "relation"
    var categoryValuesJSON: String? // serialized categories
}
```

## ColumnMapping

```swift
struct ColumnMapping: Codable {
    var titleColumn: String?
    var amountColumn: String?
    var categoryColumn: String?
    var dateColumn: String?
    var expenseAppMetadataProperty: String?  // rich_text column for Split Details JSON
    var categoryRelationDataSourceId: String?
}
```

Persistence: `ColumnMappingService` saves under UserDefaults keys `databaseMappings`/`columnMappings` as JSON.

## SplitMetadata

Stored as a JSON string in a rich_text Notion column. Two versions exist.

### Version 2 (current, for manual multi-person splits and receipt scan splits)

```json
{
  "version": 2,
  "split": {
    "enabled": true,
    "paidAmount": 100.00,
    "myShare": 40.00,
    "theyOwe": 60.00,
    "type": "manualEqual",
    "status": "pending",
    "participants": [
      {
        "id": "sandy",
        "name": "Sandy",
        "owes": 30.00,
        "status": "pending",
        "settledAt": null
      },
      {
        "id": "alex",
        "name": "Alex",
        "owes": 30.00,
        "status": "settled",
        "settledAt": "2026-06-15T10:30:00Z"
      }
    ],
    "inputs": {}
  }
}
```

For receipt scan multi-person splits, additionally includes:

```json
{
  "version": 2,
  "receipt": {
    "source": "geminiReceiptScan",
    "merchant": "Walmart",
    "itemCount": 5,
    "originalTotal": 120.50
  },
  "split": {
    "enabled": true,
    "paidAmount": 100.00,
    "myShare": 40.00,
    "theyOwe": 60.00,
    "type": "receiptMultiPerson",
    "status": "pending",
    "participants": [...],
    "items": [
      {"name": "Milk", "price": 4.99, "assignment": "shared", "sharedWith": ["sandy"]},
      {"name": "Bread", "price": 2.99, "assignment": "mine", "sharedWith": []}
    ],
    "inputs": {}
  }
}
```

Split type strings for v2:
| Type string | Method |
|------------|--------|
| `manualEqual` | Equal split |
| `manualPercent` | Percent split |
| `manualCustom` | Exact/Custom amount |
| `manualHHS` | HHS/Adjustment |
| `receiptMultiPerson` | Receipt scan multi-person |

Inputs by type:
- **Equal**: `{}` (empty)
- **Percent**: `{"entryMode": "myPercent", "myPercent": 50, "theirPercent": 50}`
- **Custom**: `{"entryMode": "theyOwe", "customAmount": 30.00}`
- **HHS**: `{"entryMode": "iPayExtra", "extraAmount": 10.00, "baseShare": 33.33}`

### Version 1 (legacy, 2-person only)

```json
{
  "version": 1,
  "split": {
    "enabled": true,
    "paidAmount": 100.00,
    "myShare": 50.00,
    "theyOwe": 50.00,
    "type": "half",
    "status": "pending",
    "splitWith": "Sandy",
    "inputs": {}
  }
}
```

V1 has no `participants` array — uses `splitWith` string + `theyOwe`. The app creates fallback participants for v1 legacy entries using `stablePersonId(from: splitWith)`.

## SplitParticipant

```swift
struct SplitParticipant {
    let id: String          // stable person ID
    let name: String
    let owes: Double
    var status: String?     // "pending" or "settled"
    var settledAt: String?  // ISO8601 timestamp
}
```

## SplitInputs

```swift
struct SplitInputs {
    var myShare: Double?
    var myPercent: Double?
    var theirPercent: Double?
    var myShares: Double?
    var theirShares: Double?
    var adjustmentAmount: Double?
    var adjustmentMode: String?   // "extraIPay" or "extraTheyPay"
    var entryMode: String?        // "myShare", "theyOwe", "myPercent", "theirPercent", etc.
}
```

## SplitItem (receipt items in split metadata)

```swift
struct SplitItem {
    let name: String
    let price: Double
    let assignment: String    // "mine", "shared", "ignore"
    let sharedWith: [String]  // person IDs
}
```

## ReceiptScanMetadata

```swift
struct ReceiptScanMetadata {
    let source: String        // "geminiReceiptScan"
    let merchant: String?
    let itemCount: Int
    let originalTotal: Double?
}
```

## SplitPerson

```swift
struct SplitPerson: Codable, Identifiable, Equatable {
    let id: String   // stable person ID from stablePersonId(from:)
    var name: String
}
```

IDs are deterministic: `stablePersonId(from: "Sandy")` → `"sandy"`. Auto-migrates old UUID IDs to name-based IDs on load.

## SplitTrackerEntry

```swift
struct SplitTrackerEntry {
    let transactionId: String
    let transactionTitle: String
    let date: Date
    let category: String?
    let amountOwed: Double
    let status: SettlementStatus  // .pending, .settled
    let settledAt: String?
    let participantId: String
    let splitMetadata: SplitMetadata
    let transaction: NormalizedTransaction
}
```

## SplitTrackerPersonGroup

```swift
struct SplitTrackerPersonGroup {
    let personId: String
    let personName: String
    let pendingTotal: Double
    let settledTotal: Double
    let entries: [SplitTrackerEntry]
}
```

## GroupedTransactionSection

```swift
struct GroupedTransactionSection {
    let date: String        // "2026-06-15"
    let displayDate: String // "Jun 15, 2026"
    let transactions: [NormalizedTransaction]
    let totalAmount: Double
}
```

## MonthMetadata

```swift
struct MonthMetadata {
    let year: Int
    let month: Int
    let monthKey: String  // "2026-06"
}
```

## Budget Models

```swift
struct BudgetCategoryItem {
    let categoryPageId: String
    let categoryName: String
    let iconEmoji: String?
    let spent: Double
    let budget: Double?
    // utilizationPercent = (spent / budget) * 100
    // status: .overBudget (pct > 1.0), .warning (>= 0.8), .safe, .noBudget
}

struct BudgetUtilizationSummary {
    let totalBudget: Double
    let totalSpent: Double
    let overBudgetCount: Int
    let warningCount: Int
    let onTrackCount: Int
}
```

## Gemini Receipt Models

```swift
struct GeminiReceiptResult {
    var merchant: String?
    var platform: String?     // e.g., "Instacart" — used to avoid "Walmart via Walmart" display
    var date: Date?
    var orderNumber: String?
    var currency: String      // default "USD"
    var items: [GeminiReceiptItem]
    var summary: GeminiReceiptSummary
    var adjustments: [GeminiReceiptAdjustment]
    var warnings: [String]
    var rawText: String
}

struct GeminiReceiptItem {
    var id: String
    var name: String
    var quantity: Double?
    var unitPrice: Double?
    var finalPrice: Double
    var categoryHint: String?
    var rawText: String?
    var classification: ReceiptItemClassification  // .mine, .shared, .ignore
    var isEditable: Bool
    var sharedWith: [String] = []  // person IDs
}

enum ReceiptItemClassification: String {
    case mine = "mine"
    case shared = "shared"
    case ignore = "ignore"
}

struct GeminiReceiptSummary {
    var itemsSubtotal: Double?
    var tax: Double?
    var serviceFee: Double?
    var deliveryFee: Double?
    var tip: Double?
    var discount: Double?
    var total: Double?
    var totalCharged: Double?
}

struct GeminiReceiptAdjustment {
    var name: String
    var type: String     // refund, weightAdjustment, substitution, discount, fee, unknown
    var amount: Double?
    var description: String?
}
```

## ReceiptItemClassification

```swift
enum ReceiptItemClassification: String {
    case mine = "mine"
    case shared = "shared"
    case ignore = "ignore"
}
```

## CategoryValue

```swift
struct CategoryValue: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let sourceType: String   // "select", "multi_select", "relation"
}
```

## DynamicFormValue

```swift
struct DynamicFormValue {
    var propertyName: String
    var propertyType: NotionPropertyType
    var stringValue: String?
    var numberValue: Double?
    var boolValue: Bool?
    var dateValue: Date?
    var selectValue: String?
    var multiSelectValues: [String]?
    var relationIds: [String]?
    // isEmpty returns false for .checkbox (always non-empty)
}
```

## NotionPropertyType

```swift
enum NotionPropertyType: String {
    case title, richText, number, select, multiSelect, date, relation, checkbox
    case url, email, phoneNumber, status
}
```

## Filter Models

```swift
struct TransactionFilter {
    let id: UUID
    var propertyName: String
    var propertyType: NotionPropertyType
    var condition: FilterCondition  // contains, equals, notEquals, isEmpty, isNotEmpty, greaterThan, lessThan, between, before, after, isChecked, isUnchecked
    var value: FilterValue?
}

enum FilterValue {
    case text(String)
    case number(Double)
    case numberRange(Double, Double)
    case date(Date)
    case dateRange(Date?, Date?)
    case select(String)
    case multiSelect(String)
    case relation(id: String, title: String)
    case checkbox(Bool)
}

struct DateRangeFilter {
    var fromDate: Date?
    var toDate: Date?
}

struct IncomeSnapshotData {
    let totalIncome: Double
    let totalCount: Int
    let mainSource: IncomeSourceSummary?
    let topSources: [IncomeSourceSummary]
    let hasIncome: Bool
}

struct IncomeSourceSummary {
    let name: String
    let amount: Double
    let count: Int
    let percentage: Double
}
```

## NotionPage (API Response Model)

Notion API pages are decoded to `NotionPage` with `CodingKeys` manually mapping snake_case keys:

```swift
struct NotionPage: Codable {
    let id: String
    let createdTime: String
    let lastEditedTime: String
    let parent: NotionParent
    let url: String
    let properties: [String: NotionPropertyValue]?
    let archived: Bool
    // plus optional fields
}
```

`NotionPropertyValue` handles all property types dynamically based on the `type` field.
