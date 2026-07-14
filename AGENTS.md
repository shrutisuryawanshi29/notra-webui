<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Notra Web — Agent Guide

## Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript 5**, **Tailwind CSS v4**
- Path alias `@/` → `./src/*`
- ESLint 9 flat config (`eslint.config.mjs`)
- No type-check or test scripts in `package.json`

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint (flat config) |
| `npx tsc --noEmit` | Manual type-check (not in scripts) |

## Architecture

- **No backend database.** Notion is the data store; all Notion API calls go through Next.js API routes at `/api/notion/*`
- **Config in localStorage** under key `notra-config` (includes Notion token, page selections, column mappings)
- **Setup flow**: `/setup` → token → pages → roles → column mapping → done
- State is loaded via `CacheProvider` (`src/hooks/use-notra-cache.tsx`) wrapping the root layout, calling the Notion API at mount
- **App entrypoint** (`/`): redirects to `/setup` if unconfigured, `/dashboard` if configured

## Key files & directories

| Path | Role |
|------|------|
| `src/app/page.tsx` | Entrypoint — redirects to setup or dashboard |
| `src/app/layout.tsx` | Root layout with `CacheProvider` + Nav |
| `src/app/api/notion/*` | All server-side API routes (proxy to Notion API) |
| `src/app/api/receipt/scan/route.ts` | Gemini receipt scan — refund detection + item dedup removed |
| `src/app/scan/page.tsx` | Receipt review UI — split calc, category grouping, expense creation |
| `src/lib/config.ts` | `loadConfig` / `saveConfig` — localStorage wrapper |
| `src/lib/notion-client.ts` | Raw Notion API client (version `2022-06-28`) |
| `src/lib/notion-payload.ts` | `buildNotionProperties` — constructs Notion API page payloads |
| `src/lib/split-calc.ts` | `calculateReceiptSplit`, `calculateEqualSplit`, etc. |
| `src/lib/split-metadata.ts` | `extractSplitTrackerEntries`, `groupSplitTrackerEntries`, `getSplitMethodLabel` |
| `src/lib/receipt-calc.ts` | `calculateReceiptSplitTotals`, `getDefaultFinalAmount`, `computeIncludedItemsTotal` |
| `src/lib/category-suggestions.ts` | Local category suggestion engine (mirrors iOS logic) |
| `src/hooks/use-notra-cache.tsx` | Global cache with reducer + lookups for relations/budgets |
| `src/types/transaction.ts` | `NormalizedTransaction`, `SplitMetadata`, `SplitItem` |
| `src/types/notion.ts` | `NotionPropertyValue` union type |
| `src/types/gemini.ts` | `GeminiReceiptResult`, `GeminiReceiptItem`, `GeminiReceiptAdjustment` |
| `src/components/TransactionForm.tsx` | Add/edit expense form with category suggestions, StyledSelect, Toast |
| `src/components/TransactionRow.tsx` | Individual transaction card with edit/delete/view actions |
| `src/components/TransactionList.tsx` | Groups transactions by date, renders `TransactionRow` |
| `src/components/TransactionDetailModal.tsx` | Modal showing transaction + split details on expense/income list click |
| `src/components/SplitDetailModal.tsx` | Modal for detailed receipt/manual split breakdown in Split Tracker |
| `src/components/StyledSelect.tsx` | Custom dark dropdown; sizes: `sm`, `category`, `md` |
| `src/components/Toast.tsx` | Themed error toast replacing native `alert()` |
| `src/components/ConfirmDialog.tsx` | Themed modal replacing `confirm()` |

## Notion API quirks

- API version pinned to `2022-06-28`
- Token resolution: env var `NOTION_TOKEN` > token from localStorage > error
- `queryDatabase` auto-paginates (100 per page)
- Data Sources API (`/data_sources/:id/query`) used for relation lookups as fallback

## Key conventions

- `'use client'` on every page/component that uses browser APIs or state
- Split expense metadata stored as JSON string in a designated Notion property
- Icons from `lucide-react`; charts from `recharts`
- Tailwind v4: PostCSS plugin `@tailwindcss/postcss` (not `tailwind.config.js`)
- Dark theme custom colors (not using Tailwind default palette): `#1F1712`, `#D49A4A`, `#D8755D`, `#93B889`, etc.
- Page bg: `#1B120E` | Card: `#2A1F18` | Card border: `#5A4638` | Accent: `#D49A4A` | Expense: `#D8755D` | Income: `#93B889`
- No tests exist. Exercise caution when modifying core data-fetching or normalization logic.

## Receipt Scan Split Calculation

The receipt split calc (`src/app/scan/page.tsx` review section, reused in `handleCreate`) uses **scale-factor proportional allocation**:

1. Determine `effectiveTotal = totalCharged ?? total` from receipt summary
2. Subtract tax if `includeTax` is unchecked
3. `scaleFactor = effectiveTotal / itemsTotal` (itemsTotal = sum of kept items)
4. Scale each item price by `scaleFactor` before running standard split logic in `calculateReceiptSplit`
5. Auto-reconciliation: adjust `myShare` by rounding residual so `myShare + theyOwe = effectiveTotal` within $0.01

This ensures discounts, refunds, tax, and fees are all proportionally distributed. Same formula in all three contexts: `splitTotals` (summary display), `groupPreviews` (per-category preview), and `handleCreate` (actual expense creation).

## Receipt Category Grouping (create flow)

When saving receipt expenses, items are grouped by category and each group creates a separate Notion expense. Each group computes its own:
- `groupPaidAmount` — scaled group item total
- `groupMyShare` — computed from ownership of group items only
- `groupParticipants[].owes` — per-participant total for this group only (not receipt-level)

This ensures Sandy's $5.79 receipt-level owed amount is split across groups ($4.08 Groceries, $1.70 Essentials) rather than duplicated.

## Cache refresh after create

After creating expenses from a receipt scan, `loadData()` from `useCache()` is called before navigation to ensure dashboard/expenses/split-tracker show fresh data immediately.

## Split Tracker

- Entries are grouped by person, sorted alphabetically by person name.
- Within each person group, entries are sorted by date descending (latest first).
- Clicking "View Details" opens `SplitDetailModal` showing receipt item breakdown or manual split details.
- Settlement toggle PATCHes Notion and calls `loadData()` to refresh.

## Receipt Scan Refund Detection

`src/app/api/receipt/scan/route.ts:9-16` — `isRefundItem()` classifies items as refunds if name/rawText matches `REFUND_PATTERNS` or `finalPrice <= 0`. Refund items are moved to `adjustments[]` instead of items, so they don't appear as assignable items or distort the item subtotal. Refund adjustments are shown in the summary card on the review page.

## Deployment

- Vercel (free plan). Set `NOTION_TOKEN` as Vercel environment variable to keep it server-side.
- No other services required.
