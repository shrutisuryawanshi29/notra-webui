# API & Services

## Notion API Usage

### Base Configuration
- **Base URL**: `https://api.notion.com/v1`
- **Notion-Version**: `2022-06-28` (standard), `2025-09-03` (data source APIs)
- **Authentication**: Bearer token in `Authorization` header
- **No `convertFromSnakeCase`** — all JSON decoded with default `JSONDecoder()` config

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /search` | POST | Find top-level pages (filter: `object=page`), Find databases (filter: `object=database`) |
| `GET /databases/{id}` | GET | Fetch database schema (properties) |
| `POST /databases/{id}/query` | POST | Query all rows from a database (paginated, `page_size=100`) |
| `POST /pages` | POST | Create a new page (transaction) |
| `PATCH /pages/{id}` | PATCH | Update a page (transaction edit, trash) |
| `POST /data_sources/{id}/query` | POST | Query relation data source (version `2025-09-03`) |
| `GET /data_sources/{id}` | GET | Retrieve data source metadata (version `2025-09-03`) |

### Request Format

POST /pages (create transaction):
```json
{
  "parent": { "database_id": "..." },
  "properties": {
    "Title": { "title": [{ "text": { "content": "Transaction name" } }] },
    "Amount": { "number": 42.50 },
    "Date": { "date": { "start": "2026-06-15" } },
    "Category": { "select": { "name": "Groceries" } },
    "Split Details": { "rich_text": [{ "text": { "content": "{\"version\":2,...}" } }] }
  }
}
```

PATCH /pages/{id} (update transaction):
```json
{
  "properties": { ... }
}
```

PATCH /pages/{id} (trash):
```json
{
  "in_trash": true
}
```

### Data Fetching Fallback Chain

`NotionDataFetcher.fetchAllRows()` uses a 3-tier fallback:
1. **Data source API** — `GET /data_sources/{id}` → extract `database_id` → query
2. **Search** — `POST /search` with `query: dataSourceId` to find the database
3. **Direct query** — `POST /databases/{id}/query` as last resort

### Pagination
Database queries use `page_size: 100` with cursor-based pagination (`start_cursor`). The app recursively fetches all pages until `has_more` is false.

### Property Payload Building

`TransactionInsertService.buildPropertyPayload()` converts `DynamicFormValue` array to Notion API property format:

| Property Type | Notion API Format |
|--------------|------------------|
| title | `{"title": [{"text": {"content": "..."}}]}` |
| rich_text | `{"rich_text": [{"text": {"content": "..."}}]}` |
| number | `{"number": 42.5}` |
| select | `{"select": {"name": "..."}}` |
| multi_select | `{"multi_select": [{"name": "..."}]}` |
| date | `{"date": {"start": "2026-06-15"}}` |
| relation | `{"relation": [{"id": "..."}]}` |
| checkbox | `{"checkbox": true/false}` |
| url | `{"url": "..."}` |
| email | `{"email": "..."}` |
| phone_number | `{"phone_number": "..."}` |
| status | `{"status": {"name": "..."}}` |

Null values are sent as `NSNull()` (JSON `null`).

## Gemini Receipt Parsing

### Base Configuration
- **Base URL**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Default model**: `gemini-3.1-flash-lite`
- **Available models**: `gemini-2.0-flash`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`
- **API key**: From Keychain (passed as URL query param `?key=...`)
- **Timeout**: 60 seconds

### Request Format

Text mode (extracted OCR text):
```json
{
  "contents": [{
    "parts": [{
      "text": "Prompt with receipt text embedded..."
    }]
  }],
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}
```

File mode (image/PDF):
```json
{
  "contents": [{
    "parts": [
      { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } },
      { "text": "Parse the receipt document..." }
    ]
  }],
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}
```

### Response Parsing

Gemini returns JSON. The app:
1. Strips markdown code fences (````json`, ````)
2. Decodes with `JSONDecoder` into `GeminiReceiptResponse`
3. Validates with `GeminiReceiptValidator`: deduplicates items, converts weight adjustments to items, checks item total vs subtotal
4. Quality check via `ExtractionQualityEvaluator`: minimum 300 chars, 3+ money values, 2+ receipt keywords

### Error Handling

| HTTP Status | Error |
|-------------|-------|
| 400 | malformedRequest |
| 401, 403 | invalidAPIKey |
| 404 | modelUnavailable |
| 429 | rateLimited |
| 500-599 | serverError |

User-facing messages describe each error with actionable guidance (e.g., "Try again later", "Check your key in Settings").

## Keychain / Local Storage

### Keychain
- `GeminiKeychainService` — stores Gemini API key
- Keychain label: `com.notra.gemini`
- Methods: `saveAPIKey()`, `loadAPIKey()`, `deleteAPIKey()`, `hasAPIKey()`

### UserDefaults
- `UserDefaultsManager` — simple wrapper for standard keys
- Stored keys:
  - `notionToken` — Notion Integration Token
  - `selectedPageId`, `selectedPageTitle`
  - `databaseMappings`, `columnMappings` (JSON-encoded mapping data)
  - `categoryValues_*` (per-database)
  - `geminiModelName`
- `SplitPeopleStore` uses key `notraSplitPeople` for person list
- `ColumnMappingService` persists under UserDefaults

### In-Memory Cache
- `SessionCacheManager` (NSLock-protected singleton)
- Stores: expenses, incomes, grouped sections, fetched months, database mappings, category values, relation target data, database schemas, select options, category lookups
- Mutations trigger `groupTransactionsByDate()` to rebuild grouped sections
- Targeted update methods: `replaceExpense`, `replaceIncome`, `removeExpense(byPageId:)`, `removeIncome(byPageId:)`, `addExpense`, `addIncome`

## Caching Behavior

| Data | Source | Cache Location | Refresh |
|------|--------|---------------|---------|
| Database mappings | UserDefaults | SessionCacheManager + ColumnMappingService | On setup / manual reset |
| Transaction rows | Notion API | SessionCacheManager (expenses/incomes arrays) | On initial load |
| Grouped sections | Computed from cache | SessionCacheManager | After every mutation |
| Category values | Notion API | UserDefaults + SessionCacheManager | On setup |
| Relation target data | Notion API | SessionCacheManager | Lazy on first access |
| Database schemas | Notion API | SessionCacheManager | On discovery |
| Select options | Notion API | SessionCacheManager | On fetch |
| Gemini model name | UserDefaults | UserDefaultsManager | On settings change |

## Error Handling

### NotionService Errors
| Error | Trigger |
|-------|---------|
| invalidToken | Empty token or HTTP 401 |
| networkError | URLSession error |
| invalidResponse | Non-HTTP response or missing data |
| decodingError | JSON decode failure |
| noPages | No top-level workspace pages found |
| apiError | Non-200 status codes |

### TransactionInsert Errors
| Error | Trigger |
|-------|---------|
| invalidDatabaseId | Missing database ID |
| networkError | URLSession error |
| apiError | Non-200 response |
| missingRequiredField | Validation failure |

### Gemini Errors
| Error | Trigger |
|-------|---------|
| missingAPIKey | No key in Keychain |
| invalidAPIKey | HTTP 401/403 |
| rateLimited | HTTP 429 or RESOURCE_EXHAUSTED |
| modelUnavailable | HTTP 404 |
| serverError | HTTP 5xx |
| fileTooLarge | File > 20MB |
| jsonDecodeFailed | Gemini returned unparseable JSON |

All API errors are dispatched to `DispatchQueue.main.async` for UI updates.
