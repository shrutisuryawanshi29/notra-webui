# Notra Web

A web-based companion for managing personal finances via Notion. This is a **basic MVP** — many features are still pending implementation and testing.

## Prerequisites

- Node.js 18+
- npm
- A Notion Integration token ([create one here](https://www.notion.so/my-integrations))
- One or more Notion databases to manage (create them inside Notion)

## Local Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd notra-webui

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local
# Edit .env.local and add your Notion Integration Token:
#   NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Required Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NOTION_TOKEN` | See note | Notion Integration Token. **Required for server-side-only mode.** If not set, the token can be entered during the setup flow (stored in localStorage). |

> **Security note:** The Notion token entered during setup is stored in the browser's `localStorage`. For production, set `NOTION_TOKEN` as a Vercel environment variable so it stays server-side only and never reaches client code. All Notion API calls are proxied through Next.js server-side API routes.

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

## Current Status (MVP)

This is a basic working version. The following features are **not yet implemented** and will be added through future preview deployments:

- Receipt scanning
- Gemini AI integration
- Advanced analytics/dashboard redesign
- Enhanced split logic
- PWA/offline support
- Multi-user support

## Architecture

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4
- **Data Storage:** Notion (via Notion API) — no backend database
- **Config:** Stored in `localStorage` (browser)
- **API Routes:** All Notion API calls go through Next.js server-side API routes (`/api/notion/*`)
- **Deployment:** Vercel (serverless)
