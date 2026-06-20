# Product Specification

## 1. Setup & Onboarding

First-launch flow routes users through mandatory setup steps (handled by `SetupStateManager.nextRequiredScreen()`):

1. **Token Entry** — User pastes Notion Integration Token. Stored in `UserDefaults` (iOS uses `UserDefaultsManager`). Token validity is not verified at entry — only tested when API calls fail.
2. **Page Picker** — Fetches top-level workspace pages via `POST /search` (filter: `object=page`, `parent.type=workspace`). User selects the Notion page that contains their finance databases.
3. **Database Role Assignment** — Discovers all databases within the selected page via `POST /search` (filter: `object=database`). Fetches schema for each database. User assigns each database a role: `expense`, `income`, or `ignore`.
4. **Column Mapping** — For each expense/income database, user maps columns: Title (title/rich_text), Amount (number), Category (select/multi_select/relation), Date (date). An `expenseAppMetadataProperty` (rich_text) is also mapped for Split Details storage. Auto-suggestion logic in `ColumnMappingService.autoSuggestMapping()` provides defaults.
5. **Dashboard** — Setup complete. Main app screen loads.

**Known bug** (do not fix): `SceneDelegate.swift:152` returns `DatabaseRoleAssignmentViewController()` for the `.columnMapping` step instead of `ColumnMappingViewController()`.

## 2. Notion Connection

- API version: `2022-06-28` (standard), `2025-09-03` (data source APIs only)
- Base URL: `https://api.notion.com/v1`
- Auth: Bearer token in `Authorization` header
- All API calls use `URLSession` (`JSONDecoder`, no `convertFromSnakeCase`)
- Data source APIs used for relation category resolution
- Three-tier fallback for row fetching: data source API → search → direct database query

## 3. Dashboard

- Loads all expenses and incomes from cache on app start
- Displays data for a **selected month** only — no API calls after initial load
- Month selector lets user switch between all available months in the data
- Sections (in order):
  1. **Hero** — Large balance display (income − expenses)
  2. **Overview** — Month totals, income vs expense comparison bar
  3. **Monthly Status** — Key metrics (largest expense, most used category, uncategorized count)
  4. **Monthly Budget** — Per-category budget utilization cards. Budget auto-detects number properties in related category databases by keyword matching. Groups expenses by category relation ID.
  5. **Recent Activity** — Last 5 transactions (combined expenses + incomes, deduplicated by ID)
  6. **Quick Checks** — Quick status cards
  7. **Explore** — Link to full analytics
- `sectionSpacing = 28`
- FAB (floating action button) presents `AddTransactionViewController(initialRole: .expense)` directly

## 4. Expenses

- List grouped by date (newest first), sorted by amount descending within group
- Each section shows date header and section total
- Split expenses show `paidAmountLabel` only for split transactions. Subtitle shows multi-person settlement status
- Pull-to-refresh reloads from cache
- Filter icon in nav bar opens `FilterPanelViewController`
- Tap transaction opens `TransactionDetailViewController`
- Edit triggered from detail view

## 5. Income

- Same layout as Expenses but for income transactions
- Filter system identical to expenses
- Edit triggered from detail view

## 6. Add/Edit Transaction

- Dynamic form built from database column mappings (`buildFields()`)
- Supports all Notion property types: title, rich_text, number, select, multi_select, date, relation, checkbox, url, email, phone_number, status
- Form fields exclude metadata columns (Split Details rich_text) via `isMetadataFieldName()`
- Month classification relation auto-defaults from transaction date
- Deep link support: `notra://add-expense`, `notra://add-income` with params: `title`, `amount`, `date` (yyyy-MM-dd), `notes`
- Save via `TransactionInsertService.insertTransaction()` (POST) or `.updateTransaction()` (PATCH)
- Split expense flow: overwrites Notion Amount with `myShare`, writes Split Details JSON to metadata column

## 7. Scan Receipt

- Entry point: Settings → Scan Receipt (not from Dashboard FAB)
- File picker: Take Photo, Choose Photo, Choose PDF
- OCR: Vision `VNRecognizeTextRequest` for images; PDFKit for PDFs
- Gemini AI parsing: extracted text or file sent to Gemini API for structured JSON extraction
- Default model: `gemini-3.1-flash-lite`. Available: `gemini-2.0-flash`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`
- API key stored in Keychain via `GeminiKeychainService` (label `com.notra.gemini`)
- If key is missing: in-app alert → Keychain → file picker

## 8. Receipt Review

- `ReceiptReviewViewController` shows parsed results before saving
- Edit merchant name, date, item details
- Item states: `mine` (personal), `shared` (split with others), `ignore`
- Bulk assignment: "All Mine" / "All Shared" modes
- Summary section shows subtotal, tax, fees, tip, discount, total
- Category selection for the resulting expense(s)
- Tax/fee proportional allocation for shared items
- **No shared items** → one normal expense (no split metadata)
- **Has shared items** → one combined `"<Merchant> Receipt"` expense with version 2 split metadata
- Validation: shared items must have ≥1 selected person

## 9. Split Expenses

- Split set of people managed via `SplitPeopleStore` (UserDefaults, key `notraSplitPeople`)
- Person IDs are deterministic `stablePersonId(from:)` — lowercase, no diacritics, spaces→hyphens
- Four split methods:
  1. **Equal** — `paidAmount / (1 + selectedCount)`
  2. **Percent** — myPercent or theirPercent
  3. **Exact amount** — customAmount (myShare or theyOwe entry mode)
  4. **HHS/Adjust** — baseShare + extraAmount (iPayExtra or extraTheyPay)
- Split Details JSON stored in rich_text metadata column
- Notion Amount field = `myShare`, not `paidAmount`

## 10. Split Tracker

- Lists all split transactions grouped by person
- Filter: Pending / Settled / All
- Person detail: name, totals, individual transaction cards
- Settlement: PATCH only participant status in Split Details JSON (no income created)
- Display name resolution: participant name → `SplitPeopleStore` → stable ID to readable name → "Unknown person"

## 11. Analytics

- Four tabs: Overview, Expenses, Income, Trends
- USD hardcoded
- Category breakdown donut chart: top 6 + "Other"
- Daily spending bar chart (current month)
- Income vs expense comparison
- Monthly trends (expenses + incomes over time)
- Zero API calls — reads from cache only

## 12. Settings

- Gemini API key management (enter/update/delete)
- Gemini model picker
- Clear cache / reset setup
- Scan Receipt button
- App info

## 13. Gemini API Key Setup

- Key stored in Keychain (`GeminiKeychainService`, label `com.notra.gemini`)
- Test key via `GeminiReceiptParser.testAPIKey()` (sends "Reply with one word: OK" prompt)
- Settings picker for model selection
- 3 models: `gemini-2.0-flash`, `gemini-3.1-flash-lite` (default), `gemini-3.5-flash`

## 14. Category/Month Mapping

- Categories from: select, multi_select, relation properties
- Relation-based categories use `CategoryParserService` (first 100 rows) for lookup
- Month classification is a relation field auto-defaulted from transaction date
- Budget auto-detects number properties in related category databases by keyword scoring

## 15. Caching/Refresh Behavior

- `SessionCacheManager` (NSLock-protected singleton): stores expenses, incomes, grouped sections, fetched months, database mappings, category values, relation data, database schemas, select options
- Cache populated on initial load (DashboardViewModel)
- Targeted mutations on edit/delete: `replaceExpense`, `replaceIncome`, `removeExpense(byPageId:)`, `removeIncome(byPageId:)`, `addExpense`, `addIncome`
- Every mutation triggers `groupTransactionsByDate()` to rebuild grouped sections
- `ColumnMappingService`: reads from cache first, falls back to `UserDefaults` persistence
- Relation target data cached lazily when needed (e.g., filter panel, add transaction)
- No automatic refresh — user triggers reload by navigating
