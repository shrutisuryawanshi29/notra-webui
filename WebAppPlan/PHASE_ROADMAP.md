# Implementation Roadmap

## Phase 1 — Core & Setup

**Goal**: Working setup flow + read-only dashboard from Notion data.

### Tasks

1. **Scaffold project**
   - `npx create-next-app@latest notra-web --typescript --tailwind --app`
   - Configure `tsconfig.json` path aliases (`@/` → `src/`)
   - Set up `src/` directory structure: `app/`, `api/`, `lib/`, `types/`, `hooks/`, `components/`
   - Create `.env.local` and `.env.example`
   - Add `server-only` package

2. **Define TypeScript types**
   - `src/types/notion.ts` — NotionPage, NotionPropertyValue, database schemas
   - `src/types/transaction.ts` — NormalizedTransaction, GroupedTransactionSection, DatabaseMappingData, ColumnMapping, CategoryValue
   - `src/types/split.ts` — SplitMetadata (v1+v2), SplitParticipant, SplitPerson, SplitTrackerEntry, SplitTrackerPersonGroup, stablePersonId()
   - `src/types/receipt.ts` — GeminiReceiptResult, GeminiReceiptItem, GeminiReceiptSummary, ReceiptScanMetadata
   - `src/types/mapping.ts` — DynamicFormValue, NotionPropertyType, filter types

3. **Build Notion API client**
   - `src/lib/notion-client.ts` — HTTP wrapper with Bearer token, manual snake_case mapping, pagination
   - `src/lib/notion-properties.ts` — Property payload builder (buildPropertyPayload), property value parser
   - Endpoints: test, search, database schema, database query, create page, update page, trash page

4. **Build API routes**
   - `POST /api/notion/test` — validate token
   - `POST /api/notion/search` — search pages/databases
   - `GET /api/notion/databases/[id]` — schema
   - `POST /api/notion/databases/query` — query rows
   - `POST /api/notion/pages` — create
   - `PATCH /api/notion/pages/[id]` — update
   - `PATCH /api/notion/pages/[id]/trash` — delete

5. **Build setup flow UI (components)**
   - `TokenEntryPage` — paste token, validate via `/api/notion/test`
   - `PagePickerPage` — list workspace pages, select one
   - `RoleAssignmentPage` — list databases, role picker
   - `ColumnMappingPage` — auto-suggest mapping, manual override, persist to localStorage

6. **Build data cache layer**
   - `useNotraCache` hook/context — client-side store (useReducer)
   - Load initial data on setup complete → query all expense/income databases
   - `groupTransactionsByDate()` utility
   - Persist mappings in localStorage

7. **Build Dashboard**
   - Hero, Overview, Monthly Status, Recent Activity sections
   - Month selector (left/right arrows)
   - All data from local cache — no API calls on navigation

8. **Build Expense/Income Lists**
   - Grouped by date, sorted by amount within group
   - Date headers with section totals
   - Filter panel UI (modal/drawer) — column-based AND-logic filter builder
   - Filter engine (pure functions — port from iOS FilterEngine)
   - Split subtitle display for split expenses

### Deliverables
- Complete setup flow (token → page → roles → mapping → dashboard)
- Dashboard with month-selected data
- Expense + Income lists with date grouping and filtering
- Filter panel with column-based filters
- Split subtitles on expense list

### Estimated effort: 3-4 weeks (full-time)

---

## Phase 2 — Transaction CRUD, Receipt Scanning, Splits

**Goal**: Full transaction management (add/edit/delete), receipt scanning pipeline, manual split expenses.

### Tasks

1. **Build Add Transaction page**
   - Dynamic form built from database column mappings
   - Property-type-specific form fields (title, number, select, multi_select, date, relation, checkbox, etc.)
   - Expense/Income toggle
   - Month classification auto-default from date
   - Deep link support (`/add?type=expense&title=...`)
   - Title auto-fallback "Expense - YYYY-MM-DD" if left blank

2. **Build Edit Transaction page**
   - Prefill from Notion raw properties using `applyEditPrefill()` logic
   - Split-specific prefill: paidAmount, participants, method type, inputs
   - Save via PATCH → cache replaceExpense/replaceIncome

3. **Build Delete transaction**
   - Confirmation dialog → PATCH in_trash → cache remove

4. **Build Transaction Detail page**
   - View all properties
   - Edit/Delete buttons
   - Split details display

5. **Build Manual Split Expense**
   - `calculateManualSplit()` — port the centralized function
   - Person picker (from SplitPeopleStore)
   - 2x2 method chip grid (Equal, Percent, Exact, Adjust)
   - Method-specific input fields
   - Summary: myShare, theyOwe, per-participant amounts
   - Split Details JSON builder
   - Save: overwrite Amount with myShare, write Split Details to metadata column
   - Validation: at least one person selected

6. **Build Receipt Scanning pipeline**
   - File picker (camera/photo library/PDF upload via browser APIs)
   - OCR extraction (client-side — `Tesseract.js` or native browser OCR)
   - `POST /api/gemini/test` — validate API key
   - `POST /api/gemini/parse-text` — send OCR text
   - `POST /api/gemini/parse-file` — send image/PDF
   - Quality check (minimum 300 chars, 3+ money values, 2+ receipt keywords)
   - Gemini prompt construction (port from iOS)

7. **Build Receipt Review page**
   - Header: editable merchant name, date, order number
   - Item list with classification chips (mine/shared/ignore)
   - Person selector for shared items
   - Bulk assignment (All Mine / All Shared / Clear)
   - Summary section (subtotal, tax, fees, tip, discount, total)
   - "Include tax proportionally" toggle
   - Category selector
   - Validation: shared items must have ≥1 person
   - Save: create Notion page(s) + cache update

8. **Build Gemini API route**
   - `POST /api/gemini/parse-text` — construct Gemini request, parse response
   - `POST /api/gemini/parse-file` — handle base64 file data, max 20MB, 60s timeout
   - Error handling: invalid key, rate limit, model unavailable, file too large

### Deliverables
- Add/Edit/Delete transactions
- Manual split with 4 methods + multi-person
- Receipt scan pipeline: upload → OCR → Gemini → review → save
- Receipt review with item classification and bulk actions
- Full CRUD cache synchronization

### Estimated effort: 4-5 weeks

---

## Phase 3 — Split Tracker, Analytics, Settings, Polish

**Goal**: Complete feature parity with iOS app.

### Tasks

1. **Build Split Tracker**
   - Person groups from cache (group by stablePersonId)
   - Pending/Settled/All filter chips
   - Person detail page: header (name, totals, count), transaction cards
   - Settlement: PATCH only participant status (no income created)
   - Display name resolution: participant name → SplitPeopleStore → readable title → "Unknown person"
   - Legacy v1 support: fallback participants from `splitWith`
   - Edit from detail: wire to edit page → cache update on return

2. **Build Settings page**
   - Gemini API key management (enter/update/delete)
   - Gemini model picker (3 models)
   - Scan Receipt button
   - Reset Setup (clear all, redirect)
   - App info

3. **Build Analytics**
   - Four tabs: Overview, Expenses, Income, Trends
   - Donut chart: top 6 categories + "Other"
   - Daily spending bar chart (current month)
   - Monthly trends (expenses + incomes over time)
   - Income source breakdown
   - All data from cache — zero API calls
   - USD hardcoded

4. **Build Budget section**
   - Auto-detect budget columns in related category databases
   - Per-category budget utilization cards with circular progress rings
   - Over-budget (pct > 1.0), warning (>= 0.8), safe, no-budget states
   - 2-column grid layout

5. **Polish & Performance**
   - Responsive design: mobile bottom tabs, desktop sidebar
   - Loading states (skeleton screens)
   - Error boundaries
   - Offline grace: use cached data when API unreachable
   - PWA manifest + service worker for installability
   - 400ms debounce for category suggestions (port from iOS)
   - Expense category suggestions: 3 inline chips in title field
   - Keyboard shortcuts (desktop): `Cmd+N` new transaction

6. **Testing**
   - Unit tests: split calculation, filter engine, date parsing, stablePersonId
   - Integration tests: setup flow, transaction CRUD, receipt review
   - E2E tests: full user journeys (acceptance criteria from ACCEPTANCE_TESTS.md)

### Deliverables
- Split Tracker with settlement
- Analytics with charts
- Budget tracking
- Settings with all controls
- Responsive layout (mobile + desktop)
- PWA support
- Full test coverage

### Estimated effort: 4-5 weeks

---

## Total Estimated Effort: 11-14 weeks (full-time)

## Dependencies Between Phases

```
Phase 1 (Core + Setup) ──────────────────────────┐
                                                  │
                    ┌──────────────────────────────┘
                    ▼
          Phase 2 (CRUD + Receipt + Splits)
                    │
                    ▼
          Phase 3 (Tracker + Analytics + Polish)
```

Phase 1 is prerequisite for all others. Phase 2 can start once API routes and cache layer exist. Phase 3 requires all data to be flowing correctly.

## Key Technical Risks

1. **OCR on web**: iOS uses native Vision framework. Web needs `Tesseract.js` (slow, less accurate) or cloud OCR. Consider Google Cloud Vision API as alternative.
2. **Camera access**: Browser camera API (`getUserMedia`) for "Take Photo". Falls back to file upload if unavailable.
3. **Large datasets**: IndexedDB needed if transaction count exceeds localStorage limits. Plan for migration path.
4. **Split Details JSON compatibility**: Must handle v1/v2, preserve `receipt` metadata on settlement. Test with real iOS-created data.
5. **Notion API CORS**: Currently avoided by backend-only approach. If any direct-browser Notion calls are added later, verify CORS support.
