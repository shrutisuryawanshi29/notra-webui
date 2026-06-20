# Notra Web — Architecture

## Overview

Next.js 15+ App Router with TypeScript. All Notion & Gemini API calls go through Next.js API routes (server-side only). API keys live in server-side environment variables — never sent to the browser.

```
Browser (React RSC + Client Components)
       │
       │ fetch('/api/notion/*')  fetch('/api/gemini/*')
       ▼
Next.js App Server
  ┌─────────────────────────────────────────────────────┐
  │  src/app/             (UI pages — RSC + Client)      │
  │  src/api/             (API routes — server-only)     │
  │  src/lib/             (shared utils, Notion/Gemini   │
  │                        HTTP clients, split math)      │
  │  src/types/           (TypeScript type definitions)   │
  │  src/hooks/           (client-side React hooks)       │
  │  src/components/      (shared React components)       │
  │                                                       │
  │  .env.local            (NOTION_TOKEN, GEMINI_KEY)      │
  └───────────────────────┬─────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        Notion API              Gemini API
        (api.notion.com)        (generativelanguage.googleapis.com)
```

## Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15+ (App Router) | RSC + API routes in one project, no separate backend |
| Language | TypeScript 5+ | Type safety, matches iOS models closely |
| Styling | Tailwind CSS v4 | Utility-first, CSS variables for dark/light theme |
| State (server) | Not stored (stateless) | Each API route reads from Notion directly |
| State (client) | React context + `useReducer` | Equivalent to iOS `SessionCacheManager` singleton |
| Persistence | localStorage (client-side) | Notion token, mappings, cache — same as iOS UserDefaults |
| Charts | recharts | React-native, easy donut/bar charts for analytics |
| Icons | lucide-react | Consistent icon set, matches iOS SF Symbols conceptually |
| Forms | Native React state (Phase 0/1) → `react-hook-form` (Phase 2) | Progressive enhancement |
| Auth | None | Same as iOS — Notion token is the only credential |

## Architecture Decisions

### Backend-Only API Access (Override from existing docs)

The existing `WEB_APP_REQUIREMENTS.md` recommends direct-from-browser Notion/Gemini calls. **This plan overrides that** per explicit requirement:

- **Notion API**: proxied through `/api/notion/*` routes. Token stays server-side.
- **Gemini API**: proxied through `/api/gemini/*` routes. Key stays server-side.
- **Rationale**: API keys never leak to client bundle, no CORS issues with Notion API, rate limiting manageable server-side.

### Data Flow

1. **Initial Load**: User navigates to Dashboard. Server component calls `/api/notion/query` (via fetch from RSC or client) → returns JSON → cached in client store (localStorage).
2. **CRUD Operations**: Client `fetch()` to `/api/notion/create`, `/api/notion/update`, `/api/notion/trash`. API route modifies Notion, returns updated page. Client updates local cache.
3. **Setup Flow**: Multi-step form posts to `/api/notion/test` (validate token), `/api/notion/search` (discover pages/databases), etc. Mapping saved to localStorage.
4. **Receipt Scanning**: Client uploads file → `/api/gemini/parse-receipt` (server sends to Gemini) → returns structured JSON → review screen → save via `/api/notion/create`.
5. **Split Settlement**: Client calls `/api/notion/update` with only split details column changed.

### Client-Side Cache Architecture

Mirrors iOS `SessionCacheManager`:

```typescript
interface CacheStore {
  expenses: NormalizedTransaction[]
  incomes: NormalizedTransaction[]
  groupedExpenses: GroupedTransactionSection[]
  groupedIncomes: GroupedTransactionSection[]
  databaseMappings: Map<string, DatabaseMappingData>
  categoryValues: Map<string, CategoryValue[]>
  relationData: Map<string, Map<string, string>>
  databaseSchemas: Map<string, object>
  selectOptions: Map<string, Map<string, string[]>>
  splitPeople: SplitPerson[]
  lastLoadedMonth: string // "2026-06"
}
```

All mutations rebuild grouped sections via `groupTransactionsByDate()`.

### Design Tokens from iOS

- Color palette: dark espresso background (`#2B241E`), warm cream text (`#F4E9DA`), soft coral expense (`#C7745A`), soft sage income (`#8CA37D`), accent gold (`#C99152`).
- Light mode: warm cream background (`#F6EFE3`), dark text (`#4A332C`).
- Default mode: dark.
- Typography: system font (San Francisco via `font-sans`), size tokens mapped to Tailwind.
- Corner radii: 8 (small), 12 (medium/buttons), 16 (large/cards).
- Shadow: subtle, low opacity black.
- Section spacing: 28px.
- `sectionSpacing = 28`
- `table.contentInset.bottom` for sticky bars: 50 + 48 + 8 + 8 + 16 = 130px.

### Page Structure

```
notra-web/src/app/
├── (setup)/
│   ├── token/
│   ├── pages/
│   ├── roles/
│   └── mapping/
├── (main)/
│   ├── dashboard/
│   ├── expenses/
│   ├── income/
│   ├── analytics/
│   ├── split-tracker/
│   │   └── [personId]/
│   ├── settings/
│   │   └── scan/
│   └── review/
├── add/
├── edit/
│   └── [id]/
└── transactions/
    └── [id]/
```

Grouped routes `(setup)` and `(main)` use layout nesting — setup has no sidebar/tabs; main has navigation.

### Responsive Breakpoints

- **Mobile** (< 768px): Single column, bottom tab nav, modal/drawer forms
- **Desktop** (> 768px): Sidebar navigation, multi-column layouts, inline filters

Dashboard: single column mobile → 2+ column grid desktop.
Expense/Income lists: card list mobile → table view with sortable columns desktop.
Receipt review: scrollable list mobile → grid desktop.
Split method selection: 2x2 chip grid (all sizes).
