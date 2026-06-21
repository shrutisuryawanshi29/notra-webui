const NOTION_VERSION = '2022-06-28'
const NOTION_BASE = 'https://api.notion.com/v1'

const envToken = () => process.env.NOTION_TOKEN

export function sanitizeToken(t: string): string {
  return t.replace(/[^\x20-\x7E]/g, '').trim()
}

export function getToken(token?: string): string {
  const serverToken = envToken()
  if (serverToken) return sanitizeToken(serverToken)
  if (token) return sanitizeToken(token)
  throw new Error('Notion token not provided and NOTION_TOKEN env var is not set')
}

export function createNotionClient(token: string) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${NOTION_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new NotionApiError(res.status, err.message || res.statusText, err)
    }
    return res.json()
  }

  return {
    testConnection: () =>
      request<{ id: string; name?: string }>('GET', '/users/me'),

    search: (params: Record<string, unknown>) =>
      request<{ results: unknown[]; has_more: boolean; next_cursor: string | null }>(
        'POST', '/search', params
      ),

    getBlockChildren: (blockId: string, startCursor?: string) =>
      request<{ results: unknown[]; has_more: boolean; next_cursor: string | null }>(
        'GET', `/blocks/${blockId}/children?page_size=100${startCursor ? `&start_cursor=${startCursor}` : ''}`
      ),

    getDatabase: (id: string) =>
      request<{
        id: string
        title: Array<{ plain_text: string }>
        properties: Record<string, { id: string; name: string; type: string; [key: string]: unknown }>
      }>('GET', `/databases/${id}`),

    queryDatabase: async (
      databaseId: string,
      startCursor?: string | null,
      pageSize = 100,
      filter?: Record<string, unknown>
    ) => {
      const allResults: unknown[] = []
      let cursor = startCursor
      let hasMore = true

      while (hasMore) {
        const body: Record<string, unknown> = {
          page_size: pageSize,
        }
        if (cursor) body.start_cursor = cursor
        if (filter) body.filter = filter

        const result = await request<{
          results: unknown[]
          has_more: boolean
          next_cursor: string | null
        }>('POST', `/databases/${databaseId}/query`, body)

        allResults.push(...result.results)
        hasMore = result.has_more
        cursor = result.next_cursor
      }

      return allResults
    },

    getDataSource: (id: string) =>
      request<{ id: string; database_id?: string; type?: string; name?: string }>(
        'GET', `/data_sources/${id}`
      ),

    queryDataSource: async (dataSourceId: string) => {
      const allResults: unknown[] = []
      let cursor: string | null = null
      let hasMore = true

      while (hasMore) {
        const body: Record<string, unknown> = { page_size: 100 }
        if (cursor) body.start_cursor = cursor

        const result = await request<{
          results: unknown[]
          has_more: boolean
          next_cursor: string | null
        }>('POST', `/data_sources/${dataSourceId}/query`, body)

        allResults.push(...result.results)
        hasMore = result.has_more
        cursor = result.next_cursor
      }

      return allResults
    },

    createPage: (body: unknown) =>
      request<unknown>('POST', '/pages', body),

    updatePage: (pageId: string, body: unknown) =>
      request<unknown>('PATCH', `/pages/${pageId}`, body),

    trashPage: (pageId: string) =>
      request<unknown>('PATCH', `/pages/${pageId}`, { archived: true }),
  }
}

export class NotionApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
    this.name = 'NotionApiError'
  }
}
