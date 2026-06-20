# Web Application Requirements

## Recommended Stack

| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| Frontend | React + TypeScript + Next.js (or Remix) | SSR for dashboard, PWA capable |
| State | Zustand or Redux Toolkit | SessionCacheManager equivalent |
| Styling | Tailwind CSS + CSS variables for theme | Easy dark/light mode |
| API Client | fetch + custom hooks | Direct Notion API calls (no backend needed) |
| Auth | No auth — Notion token stored in localStorage (encrypted) | Same as iOS: token stored locally |
| Database | None — Notion is the data store | All data lives in Notion |
| PWA | service worker, manifest | Mobile-first experience |
| Gemini | fetch directly from browser | API key in localStorage |

## Pages / Routes

| Route | Component | Data Source |
|-------|-----------|-------------|
| `/setup/token` | TokenEntry | User input → localStorage |
| `/setup/page` | PagePicker | Notion API (`POST /search`) |
| `/setup/roles` | DatabaseRoleAssignment | Notion API (discovery) |
| `/setup/mapping` | ColumnMapping | Notion API (schema) + user input |
| `/dashboard` | Dashboard | Local cache (month-filtered) |
| `/expenses` | ExpenseList | Local cache + filters |
| `/income` | IncomeList | Local cache + filters |
| `/transactions/add` | AddTransaction | Notion schema → form → Notion API |
| `/transactions/:id/edit` | EditTransaction | Notion API (page) → form → Notion API |
| `/transactions/:id` | TransactionDetail | Local cache |
| `/receipt/scan` | ReceiptScan | Camera/upload → OCR → Gemini |
| `/receipt/review` | ReceiptReview | Gemini result → Notion API |
| `/splits` | SplitTracker | Local cache |
| `/splits/:personId` | SplitTrackerPersonDetail | Local cache |
| `/analytics` | Analytics | Local cache |
| `/settings` | Settings | UserDefaults equivalent |

## Reusable Components

- **FormField** — Renders dynamic form field based on Notion property type (title, rich_text, number, select, multi_select, date, relation, checkbox, url, email, phone_number, status)
- **Card** — Styled container with shadow, corner radius, padding
- **Chip** — Selectable pill, supports selected/unselected/different semantic states
- **FilterPanel** — Column-based filter builder with condition/value pickers
- **DateRangePicker** — From/To date selection
- **MonthSelector** — Left/right arrows to navigate months
- **CategoryPicker** — Select/multi-select/relation category selector
- **PersonChip** — Split person chip with selection state
- **SplitMethodSelector** — 2x2 grid of split method chips (Equal, Percent, Exact, Adjust)
- **BudgetRing** — Circular progress indicator for budget utilization
- **DonutChart** — Category breakdown chart
- **BarChart** — Daily spending / monthly trend chart
- **ReceiptItemRow** — Item with classification chips + person selectors
- **BulkActionsBar** — All Mine / All Shared / Clear buttons

## State Management

### Client-Side Store (SessionCacheManager equivalent)

```
CacheStore {
  expenses: NormalizedTransaction[]
  incomes: NormalizedTransaction[]
  groupedExpenses: GroupedTransactionSection[]
  groupedIncomes: GroupedTransactionSection[]
  databaseMappings: Map<string, DatabaseMappingData>
  categoryValues: Map<string, CategoryValue[]>
  relationData: Map<string, Map<string, string>>
  databaseSchemas: Map<string, object>
  selectOptions: Map<string, Map<string, string[]>>
  lastLoadedMonth: string  // "2026-06"
  splitPeople: SplitPerson[]
}
```

All mutations rebuild grouped sections. Targeted mutations for add/edit/delete.

### Persisted State (UserDefaults equivalent)

- `notion_token` — localStorage
- `selected_page_id`, `selected_page_title`
- `database_mappings` — JSON
- `column_mappings` — JSON
- `category_values_*` — per-database
- `gemini_model_name` — localStorage
- `gemini_api_key` — localStorage (encrypted) or browser keychain
- `split_people` — JSON

## Responsive Behavior

- **Mobile** (< 768px): Single column, bottom tab nav, modal forms
- **Tablet** (768-1024px): 2-column dashboard, slide-over filters
- **Desktop** (> 1024px): Sidebar nav, multi-column layouts, inline filters

Dashboard:
- Mobile: single column sections
- Desktop: hero + overview in row, budget in 2+ column grid

Expense/Income lists:
- Mobile: card list
- Desktop: table view with sortable columns

Receipt review:
- Mobile: scrollable item list
- Desktop: item grid

## Authentication / API Key Handling

- Notion token: stored in `localStorage`, passed as Bearer token in API calls
- Gemini API key: stored in `localStorage` (consider `crypto.subtle` encryption), passed as URL query param
- No user authentication (the iOS app has no user auth either)
- Clear stored keys on "Reset Setup"

## Notion Integration Strategy

- **Direct from browser**: All API calls go directly from the frontend to Notion API (CORS must be allowed by Notion)
- **No backend needed**: The iOS app has no server — the web app shouldn't either
- **CORS**: Notion API supports CORS requests. Test with browser fetch.
- **Rate limiting**: Notion API rate limits apply (3 req/sec per integration). The iOS app makes sequential requests — the web app should batch or queue.

## Gemini Integration Strategy

- **Direct from browser**: Gemini API supports CORS
- **File handling**: For images, resize/compress client-side before sending base64 to Gemini
- **Max file size**: 20MB (hard limit from Gemini)
- **Timeout**: 60 seconds (may need longer for large PDFs)
- **Prompt**: Use the exact prompts from `GeminiReceiptParser.buildTextRequest()` and `buildFileRequest()`

## Limitations / Risks

| Risk | Mitigation |
|------|-----------|
| Notion API CORS | Test early; if blocked, need a lightweight proxy (Cloudflare Worker) |
| Large data sets | No pagination for category parser (only 100 rows). Cache all data client-side. LocalStorage has 5-10MB limit — use IndexedDB for transaction cache |
| Gemini API cost | Each receipt scan costs API credits. Warn user about usage |
| API key security | localStorage is not encrypted. Consider Web Crypto API for encryption-at-rest |
| Date timezone bugs | Notion date-only strings → must enforce UTC+noon parsing to avoid day shifts |
| Split Details JSON | Must handle both v1 and v2 formats. JSON stored in rich_text — must preserve whitespace |
| No offline support | PWA service worker + IndexedDB could enable basic offline viewing |
| Notion API changes | Notion-Version header pinned to 2022-06-28. Data source APIs use 2025-09-03 |
| Large PDF uploads | 20MB Gemini limit. Split large PDFs or reduce image quality |
| Multiple expense databases | Setup supports multiple expense/income DBs. Web app must handle same |
