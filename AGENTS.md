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
| `src/lib/config.ts` | `loadConfig` / `saveConfig` — localStorage wrapper |
| `src/lib/notion-client.ts` | Raw Notion API client (version `2022-06-28`) |
| `src/hooks/use-notra-cache.tsx` | Global cache with reducer + lookups for relations/budgets |
| `src/types/transaction.ts` | `NormalizedTransaction`, `SplitMetadata` |
| `src/types/notion.ts` | `NotionPropertyValue` union type |

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
- No tests exist. Exercise caution when modifying core data-fetching or normalization logic.

## Deployment

- Vercel (free plan). Set `NOTION_TOKEN` as Vercel environment variable to keep it server-side.
- No other services required.
