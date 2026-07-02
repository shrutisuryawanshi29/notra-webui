# Notra Web

A web-based companion for managing personal finances via Notion. Features expense tracking, split payments, receipt scanning with AI, and a dashboard for your Notion-stored financial data.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS v4
- **Data Storage:** Notion (via Notion API, version `2022-06-28`) — no backend database
- **AI:** Google Gemini API for receipt scanning
- **Config:** Stored in `localStorage` (browser)
- **Deployment:** Vercel (serverless, free plan)
- **Charts:** Recharts

## Prerequisites

- Node.js 18+
- npm
- A Notion Integration token ([create one here](https://www.notion.so/my-integrations))
- One or more Notion databases configured for expenses, income, and budget tracking
- (Optional, for receipt scanning) A [Gemini API key](https://aistudio.google.com/apikey)

## Local Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd notra-webui

# 2. Install dependencies
npm install

# 3. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The setup wizard will guide you through connecting your Notion workspace.

## Setup Flow

The app walks you through a 5-step setup wizard at `/setup`:

1. **Token** — Enter your Notion Integration token (or add a Gemini API key for receipt scanning)
2. **Pages** — Select your expense, income, and budget databases from your Notion workspace
3. **Roles** — Configure group members for split expenses
4. **Column Mapping** — Map Notion property columns to app fields (title, amount, date, category, etc.)
5. **Done** — Start using the app at `/dashboard`

## Required Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NOTION_TOKEN` | See note | Notion Integration Token. **Recommended for production.** If not set, the token is entered during setup (stored in localStorage). |

> **Security note:** For production, set `NOTION_TOKEN` as a Vercel environment variable so it stays server-side only and never reaches client code. All Notion API calls are proxied through Next.js server-side API routes.

> **Receipt Scanning:** A Gemini API key is entered during the scan flow (stored in localStorage). This is optional — the app works fully without it.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

## Deploy to Vercel (Hobby/Free Plan)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Notra Web MVP"
git branch -M main
git remote add origin git@github.com:<your-username>/<repo-name>.git
git push -u origin main
```

### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Keep all default settings (framework = Next.js)
4. Under **Environment Variables**, add:
   - `NOTION_TOKEN` = your Notion Integration Token (recommended)
5. Click **Deploy**

### 3. Post-Deployment

- Vercel will automatically detect Next.js and build with default settings.
- No paid add-ons, databases, or services are required.
- The app runs entirely on the Vercel Hobby (free) plan.

## Features

| Feature | Status |
|---|---|
| Expense tracking (add, edit, delete) | ✅ |
| Income tracking | ✅ |
| Category management | ✅ |
| Split expenses (equal, percent, exact, HHS) | ✅ |
| Receipt scanning with Gemini AI | ✅ |
| Split tracker (pending/settled per person) | ✅ |
| Dashboard charts (weekly, monthly) | ✅ |
| Budget tracking | ✅ |
| Receipt refund detection & adjustments | ✅ |
| Category suggestions (local, iOS-mirrored) | ✅ |
| Themed UI (dark, custom colors) | ✅ |
| PWA / offline support | ❌ |
| Multi-user / real-time sync | ❌ |

## Features Detail

### Receipt Scanning
Upload or photograph a receipt → Gemini AI extracts items, prices, categories, tax, discounts, and refunds → Review and assign ownership → Creates categorized expenses with split metadata.

Refund items are automatically detected (by name patterns and negative/zero prices) and moved to adjustments — they don't appear as assignable items or distort totals.

### Split Calculation
When splitting a scanned receipt, the app uses **scale-factor proportional allocation**:
- The receipt's actual charged total is the definitive amount to split
- Each item's price is scaled proportionally by `chargedTotal / itemsTotal`
- Discounts, refunds, fees, and tax are all distributed evenly through the scale factor
- Rounding is automatically reconciled to the cent

### Category Suggestions
As you type an expense title, the app suggests categories based on past expenses (purely local matching — no API calls). Powered by a merchant name → category frequency map built from your cached Notion data.

### Themed UI Components
All native browser popups (`alert`, `confirm`, `<select>`) have been replaced with custom themed components:
- **StyledSelect** — dark dropdown with gold accent
- **Toast** — auto-dismiss error notification
- **ConfirmDialog** — modal for destructive actions

## Architecture

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS v4 with custom dark palette (`#1B120E` bg, `#2A1F18` card, `#D49A4A` accent)
- **Data:** Notion API (pinned to `2022-06-28`), auto-paginated queries
- **State:** Global cache via `CacheProvider` — loads all data once at mount, no re-fetching on navigation
- **Config:** Browser `localStorage` under key `notra-config`
- **API Routes:** All Notion API calls proxied through `/api/notion/*`
- **Deployment:** Vercel (free plan, serverless)
