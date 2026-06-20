# Required Notion Database Schemas

Notra requires the user to have at least one **Expense** database and one **Income** database in Notion. These can be existing databases or created specifically for Notra.

## Expense Database

| Column | Type | Required | Purpose |
|--------|------|----------|---------|
| Expense Title | `title` (or `rich_text`) | Yes | Transaction description |
| Amount | `number` | Yes | Transaction amount (positive) |
| Date | `date` | Yes | Transaction date |
| Category | `select` / `multi_select` / `relation` | No | Category assignment |
| Month Classification | `relation` | No | Links to a Month/Period database |
| Budget | `relation` | No | Links to a Category/Budget database |
| Split Details | `rich_text` | No | JSON blob for split expense metadata |

### Expense Column Mapping (auto-suggest logic)

The app auto-suggests column mappings in `ColumnMappingService.autoSuggestMapping()`:

- **Title**: first column of type `title` or `rich_text`
- **Amount**: first `number` column whose name contains "amount", "total", "price", or "cost"
- **Category**: first column whose name contains "category", "type", "expense", or "source"
- **Date**: first `date` column or column whose name contains "date", "created", "purchase", or "time"
- **Split Details** (metadata): first `rich_text` or `text` column whose name matches: `"split details"`, `"app metadata"`, `"metadata"`, `"notra metadata"`, `"split metadata"`, `"app data"`, or `"notra data"`

## Income Database

| Column | Type | Required | Purpose |
|--------|------|----------|---------|
| Income Title | `title` (or `rich_text`) | Yes | Transaction description |
| Amount | `number` | Yes | Transaction amount (positive) |
| Date | `date` | Yes | Transaction date |
| Type / Category | `select` / `multi_select` / `relation` | No | Income source/category |
| Month Classification | `relation` | No | Links to a Month/Period database |

## Optional / Related Databases

### Month Classification Database

A database with month/year records (e.g., "June 2026", "2026-06"). Linked via relation from both Expense and Income databases. The app auto-defaults this relation from the transaction date when creating transactions.

### Category / Budget Database

A database for categories with optional budget number columns. The app auto-detects budget columns by keyword scoring (looks for number properties with budget-related names).

## Column Mapping Fallback Names

The `isMetadataFieldName()` method checks against these fallback names (case-insensitive):
- `"split details"`
- `"app metadata"`
- `"metadata"`
- `"notra metadata"`
- `"split metadata"`
- `"app data"`
- `"notra data"`

## How Column Mapping Works

1. **Auto-discovery**: `DatabaseDiscoveryService` searches ALL accessible databases via `POST /search` (filter: `object=database`)
2. **Schema fetch**: Each database's properties are fetched via `GET /databases/{id}`
3. **Role assignment**: User assigns each database as expense, income, or ignore
4. **Mapping**: User (or auto-suggest) maps each core field to a Notion column
5. **Persistence**: `ColumnMappingService` saves to UserDefaults under `databaseMappings`/`columnMappings` keys
6. **Cache**: On app start, `SetupStateManager` checks `hasExpenseMapping()` and `hasIncomeMapping()` to determine setup completeness

## Important Notes

- The `convertFromSnakeCase` key decoding strategy is **never used** — every `JSONDecoder()` uses default config. The web app must manually map snake_case keys in all `CodingKeys`.
- Number columns with comma formatting: strip commas before parsing (`replacingOccurrences(of: ",", with: "")`). Exception: deep link amounts replace comma with dot for European decimal support.
- Date-only strings from Notion (e.g., `"2026-06-15"`) must be parsed with `DateComponents` + `hour=12` to avoid timezone shift.
- The Split Details column is always hidden from the add/edit form UI but included in save payloads.
