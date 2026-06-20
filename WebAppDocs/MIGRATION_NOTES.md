# Migration Notes

## What the Web App Must Preserve

The web app must be fully compatible with data already created by the iOS app. All existing Notion data must remain valid and readable.

## 1. Existing Notion Data

The web app reads from the same Notion databases. All existing pages must:
- Display correctly in the web app
- Maintain their amounts, categories, dates, and relations
- Preserve their Split Details JSON (no data loss)

## 2. Existing Split Details JSON

The rich_text metadata column stores Split Details JSON. Two versions exist in the wild:

### Version 1 (Legacy)

Used by the original 2-person split feature. No `participants` array.

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

The web app must:
- Detect `version: 1` and handle the missing `participants` array
- Create fallback participants using `stablePersonId(from: splitWith ?? "Unknown person")`
- Support the `splitWith` string for display purposes
- Display old type strings: `"half"`, `"50/50"`, `"Split Equally"`, `"Custom Amount"`, `"shares"`

### Version 2 (Current)

Used for multi-person manual splits and receipt scan splits. Includes `participants` array and `version: 2`.

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
      {"id": "sandy", "name": "Sandy", "owes": 30.00, "status": "pending", "settledAt": null},
      {"id": "alex", "name": "Alex", "owes": 30.00, "status": "settled", "settledAt": "2026-06-15T10:30:00Z"}
    ],
    "inputs": {}
  }
}
```

The web app must:
- Accept both `version` values (1 and 2)
- Handle missing `version` field (treat as v1)
- Support all v2 type strings: `manualEqual`, `manualPercent`, `manualCustom`, `manualHHS`, `receiptMultiPerson`
- Handle JSON objects with keys in any order (JSON objects are unordered)

### Version 2 with Receipt Metadata

For receipt scan transactions, the JSON also includes a `receipt` section:

```json
{
  "version": 2,
  "receipt": {
    "source": "geminiReceiptScan",
    "merchant": "Walmart",
    "itemCount": 5,
    "originalTotal": 120.50
  },
  "split": { ... }
}
```

The web app must preserve the `receipt` object when updating split metadata (e.g., during settlement). The `buildUpdatedJSON()` method in the iOS app preserves all existing fields and only modifies the participant array.

## 3. V1/V2 Compatibility

| Feature | v1 | v2 |
|---------|----|----|
| Participants array | No | Yes |
| Multi-person | No (2-person only) | Yes (2+) |
| Type strings | `half`, `50/50`, `Split Equally`, `Custom Amount`, `shares` | `manualEqual`, `manualPercent`, `manualCustom`, `manualHHS`, `receiptMultiPerson` |
| Items array | No | Yes (receipt scans) |
| Receipt metadata | No | Yes |
| Inputs structure | Simple | Method-specific |
| Settlement | Not supported | Per-participant status |

When writing new splits, always use version 2 format.

## 4. Stable Person IDs

Person IDs are deterministic:

```swift
func stablePersonId(from name: String) -> String {
    // lowercase, no diacritics, spaces→hyphens, strip unsupported chars
}
// "Sandy" → "sandy"
// "Alex" → "alex"
// "John Doe" → "john-doe"
// "José" → "jose"
```

The web app must use the **exact same algorithm** to compute person IDs. Old UUID-based IDs from early versions are auto-migrated to name-based IDs on `SplitPeopleStore.load()`.

**Important**: When the same person name produces the same ID across the iOS and web apps, split tracker grouping works correctly. If the algorithm differs, participants will appear as different people.

## 5. Receipt Metadata

Receipt scan transactions store `receipt` metadata in the Split Details JSON. This data is **read-only** for display purposes in the iOS app. The web app should:
- Preserve receipt metadata when updating split details (settlement, edit)
- Not modify or delete the `receipt` section
- Display the `merchant`, `itemCount`, and `originalTotal` if available

## 6. Dashboard / Analytics Calculations

The iOS app computes dashboard and analytics entirely from the in-memory cache. The web app must reproduce these calculations identically:

- **Balance**: `selectedMonthIncomes - selectedMonthExpenses`
- **Budget over-budget check**: `pct > 1.0` (not `>= 1.0`). This matters for the `BudgetStatus` enum.
- **Budget status thresholds**: `> 1.0` = overBudget, `>= 0.8` = warning, else safe
- **Sub-1% formatting**: Use explicit `"<1%"` string. `maximumFractionDigits=0` rounds <0.5% to `"0%"`.
- **Category breakdown**: Top 6 categories + "Other" in donut chart
- **Multi-person split subtitle**: `"Sandy owes $30.00"` / `"2 people owe $40.00"` / `"Pending $20.00 • Settled $30.00"`
- **Amount normalization**: All amounts are `abs()`'d (no negative amounts)
- **Recent transactions**: Last 5, sorted by date descending, deduplicated by page ID
- **Deduplication**: When combining expenses and incomes, deduplicate by page ID

## 7. Session Cache Architecture

The iOS `SessionCacheManager` is an NSLock-protected in-memory singleton. It stores:
- Raw transactions (expenses/incomes arrays)
- Grouped sections (rebuilt after every mutation)
- Fetched months
- Database mappings
- Category values
- Relation target data (for category resolution)
- Database schemas
- Select options

The web app must implement an equivalent client-side store. After every mutation (add, edit, delete), grouped sections must be rebuilt using `groupTransactionsByDate()`.

## 8. Column Mapping Schema

Existing users have column mappings persisted in UserDefaults (JSON under `databaseMappings`/`columnMappings`). The web app must:
- Read these mappings from the user's browser storage
- Support the `expenseAppMetadataProperty` column name (maps to Split Details rich_text column)
- Handle the old `expenseSplitDetailsProperty` key name (decoded into `expenseAppMetadataProperty` during migration)
- Not modify existing column mapping structure

## 9. Split Details Column Detection

The `isMetadataFieldName()` method checks 7 fallback names in addition to the mapped column name:
- `"split details"`
- `"app metadata"`
- `"metadata"`
- `"notra metadata"`
- `"split metadata"`
- `"app data"`
- `"notra data"`

The web app must use the same fallback list to detect metadata columns. If a user has a column named "App Metadata", it should be treated as the Split Details column.

## 10. What Breaks If Not Preserved

| If you change... | What breaks |
|-----------------|-------------|
| Stable person ID algorithm | People appear as duplicates in Split Tracker |
| v1 JSON parsing | Legacy split expenses are invisible/unchartable |
| Receipt metadata structure | Existing receipt scan transactions lose metadata on settlement |
| Column mapping keys | App cannot find mapped columns in existing databases |
| `convertFromSnakeCase` assumption | All Notion API responses parse incorrectly |
| Date parsing (hour=12 vs ISO8601) | Transactions shift by one day |
| Budget over-budget threshold (>= vs >) | Budget status is wrong for exact 100% utilization |
