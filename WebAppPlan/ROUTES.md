# Routes & Pages

## Setup Flow

| Route | Page Component | Purpose | Data Source |
|-------|---------------|---------|-------------|
| `/` | RootLayout → redirect | If setup complete → `/dashboard`, else → `/setup/token` | `localStorage` check |
| `/setup/token` | TokenEntryPage | Paste Notion Integration Token | User input → localStorage |
| `/setup/pages` | PagePickerPage | Select workspace page | `POST /api/notion/search` (top-level pages) |
| `/setup/roles` | RoleAssignmentPage | Assign Expense/Income/Ignore roles | `POST /api/notion/databases` (discovery) |
| `/setup/mapping` | ColumnMappingPage | Map Title/Amount/Category/Date/Split Details columns | `GET /api/notion/databases/:id` (schema) + user input |

## Main App

| Route | Page Component | Purpose | Data Source |
|-------|---------------|---------|-------------|
| `/dashboard` | DashboardPage | Monthly summary, budget, recent activity | Local cache |
| `/expenses` | ExpenseListPage | Expense list grouped by date | Local cache + filters |
| `/income` | IncomeListPage | Income list grouped by date | Local cache + filters |
| `/analytics` | AnalyticsPage | Overview, Expenses, Income, Trends tabs | Local cache |
| `/split-tracker` | SplitTrackerPage | Person groups with pending/settled totals | Local cache |
| `/split-tracker/[personId]` | SplitTrackerPersonDetailPage | Per-person transaction cards, settlement | Local cache |
| `/settings` | SettingsPage | Gemini key, model picker, reset setup, scan receipt | localStorage |

## Transaction CRUD

| Route | Page Component | Purpose | Data Source |
|-------|---------------|---------|-------------|
| `/add` | AddTransactionPage | New expense/income (role param) | Notion schema (form) → POST |
| `/edit/[id]` | EditTransactionPage | Edit existing transaction | Notion API (prefill) → PATCH |
| `/transactions/[id]` | TransactionDetailPage | View transaction detail | Local cache |

## Receipt Scanning

| Route | Page Component | Purpose | Data Source |
|-------|---------------|---------|-------------|
| `/settings/scan` | ReceiptScanPage | File picker → OCR → Gemini | Camera/upload → Gemini API |
| `/review` | ReceiptReviewPage | Review parsed items, classify, create | Gemini result → local state → Notion API |

## Filter Panel (modal/drawer)

| Route | Page Component | Purpose | Data Source |
|-------|---------------|---------|-------------|
| (embedded via `?filter=true` or modal) | FilterPanel | Column-based AND-logic filter builder | Local cache (schema, values) |

## Navigation Structure

### Setup (no nav bar)
- Linear flow: Token → Pages → Roles → Mapping → Dashboard
- Back button allowed on steps 2-4
- Step indicator showing progress

### Main App (with navigation)

**Mobile** (<768px): Bottom tab bar
- Dashboard | Expenses | Income | Analytics | Split Tracker | Settings

**Desktop** (>768px): Left sidebar
- Notra logo/brand at top
- All nav items vertical
- Scan Receipt button in sidebar (desktop) or Settings (mobile)

### Settings Page Sections
1. **Gemini API Key** — enter/update/delete, test key
2. **Gemini Model** — picker: `gemini-2.0-flash`, `gemini-3.1-flash-lite` (default), `gemini-3.5-flash`
3. **Scan Receipt** — button to start scan flow
4. **Reset Setup** — clear all data, redirect to `/setup/token`

## Deep Links (Phase 2+)

Web equivalents of iOS deep links:
- `/add?type=expense&title=...&amount=...&date=...&notes=...`
- `/add?type=income&title=...&amount=...&date=...&notes=...`
