# Deployment Checklist

## Before Deploying

### Build Verification

- [x] Local install succeeds (`npm install`)
- [x] TypeScript check passes (`npm run build` includes type check)
- [ ] Lint passes (`npm run lint`)
- [x] Production build succeeds (`npm run build`)
- [x] All API routes compile
- [x] No deployment-blocking errors

### Security

- [x] `NOTION_TOKEN` can be set as Vercel env var (server-side only)
- [x] All Notion API calls run through Next.js server-side API routes
- [x] No `NEXT_PUBLIC_` used for secrets
- [x] Token query param removed from `GET /api/notion/databases/[id]` — now uses POST with body
- [x] `.env.example` contains no real secrets
- [x] `.gitignore` excludes `.env` and `.env.local` but allows `.env.example`
- [x] No paid Vercel features used

### Vercel Compatibility

- [x] `package.json` has `dev`, `build`, `start`, `lint` scripts
- [x] Next.js config (`next.config.ts`) is Vercel-compatible (no custom overrides)
- [x] No filesystem writes that would fail on serverless
- [x] Config uses `localStorage` (client-side) — works on Vercel
- [x] No external paid services or databases
- [x] No cron jobs
- [x] Personal project (not team/pro)

### Environment Variables Needed in Vercel

| Variable | Required | Notes |
|---|---|---|
| `NOTION_TOKEN` | Recommended | Your Notion Integration Token. If set, the server uses it exclusively and the client never needs to supply it. |

## Deploy Steps

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Notra Web MVP"
   git branch -M main
   git remote add origin git@github.com:<your-username>/<repo-name>.git
   git push -u origin main
   ```

2. **Import into Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Keep default settings (Next.js auto-detected)
   - Add `NOTION_TOKEN` environment variable
   - Click Deploy

3. **Vercel Project Settings (no changes needed):**
   - Framework Preset: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `next build` (auto-detected)
   - Output Directory: `.next` (auto-detected)
   - Node.js Version: 20.x (default)
   - All other settings: defaults

## Post-Deploy Smoke Tests

After deployment, verify the following:

- [ ] **App loads:** Visit the deployed URL — app should redirect to setup or dashboard
- [ ] **Setup flow opens:** Visit `/setup` — step indicator should show
- [ ] **Token entry:** Visit `/setup/token` — can enter a Notion token
- [ ] **Token test works:** "Test Connection" button succeeds
- [ ] **Page selection:** Visit `/setup/pages` — workspace pages load (if token is valid)
- [ ] **Database role mapping:** Visit `/setup/roles` — databases appear with role selector
- [ ] **Column mapping:** Visit `/setup/mapping/[id]` for a database — columns load and can be mapped
- [ ] **Dashboard loads:** Visit `/dashboard` — overview cards, quick checks, recent activity render
- [ ] **Expenses page loads:** Visit `/expenses` — empty state or data loads
- [ ] **Income page loads:** Visit `/income` — empty state or data loads
- [ ] **Split tracker loads:** Visit `/split-tracker` — page renders without error
- [ ] **Settings load:** Visit `/settings` — config displays correctly

## Known Limitations

- **Notion token security:** If `NOTION_TOKEN` is NOT set as a Vercel env var, the token entered during setup is stored in `localStorage` (client-side). For maximum security, always set `NOTION_TOKEN` as a Vercel environment variable.
- **MVP status:** This is a basic working version. Features like receipt scanning, Gemini AI, advanced analytics, PWA/offline, and multi-user support are not yet implemented.
- **Single-user:** The app is designed for personal use — there is no authentication or multi-tenant support.
- **Notion API rate limits:** The app may hit Notion API rate limits under heavy usage.
