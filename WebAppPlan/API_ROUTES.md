# API Routes

All routes are Next.js App Router API handlers at `src/app/api/`. All Notion/Gemini API calls go server-side only.

## Route Index

### Notion Setup & Configuration

| Method | Route | Purpose | iOS Reference |
|--------|-------|---------|---------------|
| POST | `/api/notion/test` | Validate Notion token (GET /users/me) | `NotionService.fetchUser()` |
| POST | `/api/notion/search` | Search pages/databases | `NotionService.fetchTopLevelPages()`, `DatabaseDiscoveryService` |
| GET | `/api/notion/databases/[id]` | Fetch database schema (properties) | `GET /databases/{id}` |
| POST | `/api/notion/databases/query` | Query database rows (paginated) | `NotionDataFetcher.fetchAllRows()` |
| POST | `/api/notion/datasource/[id]/query` | Query data source for relation resolution | `GET /data_sources/{id}/query` (version 2025-09-03) |

### Transaction CRUD

| Method | Route | Purpose | iOS Reference |
|--------|-------|---------|---------------|
| POST | `/api/notion/pages` | Create transaction | `TransactionInsertService.insertTransaction()` |
| PATCH | `/api/notion/pages/[id]` | Update transaction | `TransactionInsertService.updateTransaction()` |
| PATCH | `/api/notion/pages/[id]/trash` | Trash (delete) transaction | `NotionService.trashPage()` |

### Gemini Receipt Parsing

| Method | Route | Purpose | iOS Reference |
|--------|-------|---------|---------------|
| POST | `/api/gemini/test` | Test Gemini API key | `GeminiReceiptParser.testAPIKey()` |
| POST | `/api/gemini/parse-text` | Parse OCR text via Gemini | `GeminiReceiptParser.parseWithText()` |
| POST | `/api/gemini/parse-file` | Parse image/PDF file via Gemini | `GeminiReceiptParser.parseWithFile()` |

## Route Details

### POST /api/notion/test

Validate that a Notion token is valid by calling `GET /users/me`.

**Request:**
```json
{
  "token": "ntn_..."
}
```

**Response 200:**
```json
{
  "valid": true,
  "user": { "id": "...", "name": "..." }
}
```

**Response 401:**
```json
{
  "valid": false,
  "error": "Invalid token"
}
```

### POST /api/notion/search

Search Notion for top-level workspace pages or databases.

**Request:**
```json
{
  "filter": {
    "object": "page"        // or "database"
  },
  "query": "optional search term"
}
```

**Response 200:**
```json
{
  "results": [
    {
      "id": "page-id-123",
      "title": "Finance Workspace",
      "object": "page"
    }
  ]
}
```

### POST /api/notion/databases/query

Query a database with optional filters and pagination. Implements 3-tier fallback: data source API → search → direct query.

**Request:**
```json
{
  "databaseId": "db-id-123",
  "startCursor": null,
  "pageSize": 100,
  "filter": {}           // optional Notion filter object
}
```

**Response 200:**
```json
{
  "results": [/* NotionPage[] */],
  "hasMore": false,
  "nextCursor": null
}
```

The server handles recursive pagination until `hasMore` is false.

### POST /api/notion/pages

Create a new transaction (expense or income).

**Request:**
```json
{
  "databaseId": "db-id-123",
  "properties": {
    "Title": { "title": [{ "text": { "content": "Groceries" } }] },
    "Amount": { "number": 42.50 },
    "Date": { "date": { "start": "2026-06-15" } },
    "Category": { "select": { "name": "Food" } },
    "Split Details": { "rich_text": [{ "text": { "content": "{...}" } }] }
  }
}
```

**Response 200:** Full NotionPage object (must be parsed to update client cache).

### PATCH /api/notion/pages/[id]

Update an existing transaction. Key behavior: PATCH returns the updated page.

**Request:**
```json
{
  "properties": {
    "Amount": { "number": 50.00 }
  }
}
```

**Response 200:** Updated NotionPage.

### PATCH /api/notion/pages/[id]/trash

Soft-delete by setting `in_trash: true`.

**Request:**
```json
{}
```

**Response 200:** Updated NotionPage (with archived: true).

### POST /api/gemini/parse-text

Send extracted OCR text to Gemini for structured receipt parsing.

**Request:**
```json
{
  "text": "WALMART\nMILK 4.99\nBREAD 2.99\nTOTAL 7.98",
  "model": "gemini-3.1-flash-lite"
}
```

**Response 200:**
```json
{
  "merchant": "Walmart",
  "items": [/* ... */],
  "summary": { /* ... */ }
}
```

### POST /api/gemini/parse-file

Send base64-encoded file (image/PDF) to Gemini.

**Request:**
```json
{
  "file": {
    "mimeType": "image/jpeg",
    "data": "base64-encoded-string"
  },
  "model": "gemini-3.1-flash-lite"
}
```

**Response 200:** Same as parse-text.

Max file size: 20MB (enforced server-side). Timeout: 60 seconds.

## Error Response Format

All API routes return consistent errors:

```json
{
  "error": {
    "code": "invalidToken",
    "message": "The Notion token is invalid or expired.",
    "status": 401
  }
}
```

| Error Code | HTTP Status | Meaning |
|-----------|-------------|---------|
| `invalidToken` | 401 | Notion/Gemini token invalid |
| `networkError` | 502 | External API unreachable |
| `invalidResponse` | 502 | Non-HTTP/unexpected response |
| `decodingError` | 500 | JSON parse failure |
| `notFound` | 404 | Database/page not found |
| `rateLimited` | 429 | API rate limit hit |
| `validationError` | 400 | Missing/invalid request fields |
| `fileTooLarge` | 413 | File > 20MB for Gemini |

## Middleware

Next.js middleware checks for Notion token in server-side session/cookie on protected routes (all except `/setup/token` and `/api/notion/test`). Redirects to `/setup/token` if no token is configured at server level.

**Needs verification**: Since token is stored client-side (localStorage) and passed to API routes, middleware may need to check for a session cookie set by API routes after token validation. Alternative: route-level checks in each API handler.

## Property Payload Builder

Server-side utility `buildPropertyPayload()` converts form values to Notion API format:

| Property Type | Output Format |
|--------------|---------------|
| title | `{ title: [{ text: { content } }] }` |
| rich_text | `{ rich_text: [{ text: { content } }] }` |
| number | `{ number: 42.5 }` |
| select | `{ select: { name } }` |
| multi_select | `{ multi_select: [{ name }] }` |
| date | `{ date: { start: "2026-06-15" } }` |
| relation | `{ relation: [{ id }] }` |
| checkbox | `{ checkbox: true/false }` |
| url | `{ url: "..." }` |
| email | `{ email: "..." }` |
| phone_number | `{ phone_number: "..." }` |
| status | `{ status: { name } }` |

Null values sent as `null` (JSON null).

## Rate Limiting

Notion API: ~3 req/sec per integration. The web app should queue sequential calls if needed. No rate limiting is implemented in the iOS app — revisit if user reports throttling.

Gemini API: Check usage quotas. No rate limiting in iOS app.
