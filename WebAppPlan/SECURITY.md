# Security Rules

## API Key Handling

### Notion Integration Token
- **Never** sent to client bundle or exposed in browser devtools
- Stored server-side in `process.env.NOTION_TOKEN` (`.env.local`)
- When proxy mode is needed (future): token can be stored in server session keyed by a session cookie
- **Cannot** be stored per-user (no auth system) — single token for self-hosted use
- Alternative for multi-user: encrypted in HTTP-only cookie, decrypted by API routes

### Gemini API Key
- **Never** sent to client
- Stored server-side in `process.env.GEMINI_API_KEY` (`.env.local`)
- User can update via Settings → API route validates and stores server-side

## Environment Variables

```bash
# .env.local (required)
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxx

# .env.local (optional)
GEMINI_MODEL=gemini-3.1-flash-lite     # default
NOTION_VERSION=2022-06-28              # default
NOTION_DATA_SOURCE_VERSION=2025-09-03  # default
```

Created `.env.example` with dummy values for reference.

## Data Storage

### Server-Side
- **None** — no database, no file storage. All user data lives in Notion.
- No user accounts, no passwords, no PII stored on server.
- Server-side in-memory state is ephemeral (per-request).

### Client-Side (Browser)
- **localStorage** stores:
  - Notion token (if using client-direct mode — currently overridden to backend-only)
  - Selected page ID/title
  - Database mappings (JSON)
  - Column mappings (JSON)
  - Category values (JSON, per-database)
  - Gemini model preference
  - Split people list
  - Transaction cache (consider IndexedDB for large datasets — localStorage has 5-10MB limit)
- **Session-only**: filter state, temporary form data, receipt review state

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| API keys in client bundle | Backend-only API routes (no keys in frontend code) |
| XSS → localStorage theft | Sanitize all user inputs. Notion data is structured JSON, not raw HTML. Use `dangerouslySetInnerHTML` sparingly. |
| CSRF | Next.js API routes use SameSite cookies. No authenticated sessions to protect. |
| Notion API rate limits | Server can queue/batch requests. Unlikely to exceed 3 req/sec for single user. |
| Gemini API costs | Warn user before scanning. Each receipt scan costs API credits. |
| localStorage size limit | Use IndexedDB for large transaction cache. localStorage for config only. |
| No HTTPS in dev | Next.js dev server uses HTTP. Production must use HTTPS (Vercel, etc. provide this). |
| Date timezone bugs | Enforce UTC+noon parsing for date-only strings. Server normalizes dates before caching. |

## CORS

- Notion API does not need CORS config (all calls go through server-side API routes)
- Gemini API does not need CORS (server-side only)

## Bundle Security

- `next.config.js` bundles nothing from `.env.local` into client JS
- All API routes import server-only modules; Next.js tree-shakes client bundles
- Use `'use server'` / `server-only` pattern to prevent accidental client imports

## Input Validation

All API routes validate:
- Required fields present
- `parent.database_id` is a valid Notion database ID (32 hex chars)
- Property types match known schema
- Amounts are valid numbers (strip commas, reject NaN/Infinity)
- Gemini file sizes < 20MB
- Split Details JSON is valid JSON

## Production Checklist

- [ ] `NOTION_TOKEN` and `GEMINI_API_KEY` set in deployment environment (Vercel env vars, not in repo)
- [ ] No `console.log` of sensitive values in production build
- [ ] HTTPS enforced
- [ ] `x-powered-by: Next.js` header removed or minimized
- [ ] Security headers (CSP, X-Frame-Options, etc.) configured in `next.config.js`
- [ ] Rate limiting added to API routes if deployed publicly
