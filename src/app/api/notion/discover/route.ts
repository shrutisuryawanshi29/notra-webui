import { NextRequest, NextResponse } from 'next/server'
import { createNotionClient, getToken, NotionApiError } from '@/lib/notion-client'

interface DiscoveredDbEntry {
  id: string
  title: string
  properties: Record<string, { name: string; type: string; relationDataSourceId?: string }>
}

interface DiscoveryLog {
  step: string
  status: string
  detail: string
  count?: number
  error?: string
  statusCode?: number
  notionErrorBody?: unknown
}

export async function POST(request: NextRequest) {
  const logs: DiscoveryLog[] = []
  const allDbIds = new Set<string>()

  try {
    const body = await request.json()
    const token = getToken(body.token)
    const pageId = body.pageId as string | undefined

    logs.push({
      step: 'token_validation',
      status: 'ok',
      detail: `Token resolved. Page ID: ${pageId || 'none'}`,
    })

    const client = createNotionClient(token)

    // Step 1: Try block children API to find databases under the selected page
    if (pageId) {
      try {
        logs.push({
          step: 'block_children',
          status: 'attempting',
          detail: `Fetching child blocks for page: ${pageId}`,
        })

        const childrenResult = await client.getBlockChildren(pageId)
        const childBlocks = childrenResult.results as Array<Record<string, unknown>>

        logs.push({
          step: 'block_children',
          status: 'ok',
          detail: `Found ${childBlocks.length} child blocks`,
          count: childBlocks.length,
        })

        const childDbs: Array<{ id: string; title: string }> = []
        for (const block of childBlocks) {
          const type = block.type as string
          if (type === 'child_database') {
            const childDb = block[type] as Record<string, unknown> | undefined
            if (childDb) {
              const title = (childDb.title as string) || ''
              childDbs.push({ id: block.id as string, title })
            }
          }
        }

        if (childDbs.length > 0) {
          logs.push({
            step: 'block_children',
            status: 'found',
            detail: `Found ${childDbs.length} child databases under page`,
            count: childDbs.length,
          })

          for (const db of childDbs) {
            allDbIds.add(db.id)
          }

          // Fetch schemas for child databases
          const entries = await fetchSchemas(client, Array.from(allDbIds), logs)
          if (entries.length > 0) {
            logs.push({
              step: 'complete',
              status: 'ok',
              detail: `Returning ${entries.length} databases from block children`,
              count: entries.length,
            })
            return NextResponse.json({ databases: entries, logs })
          }
        } else {
          logs.push({
            step: 'block_children',
            status: 'empty',
            detail: 'No child databases found under selected page, falling back to search',
          })
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        const statusCode = error instanceof NotionApiError ? error.status : undefined
        logs.push({
          step: 'block_children',
          status: 'failed',
          detail: `Block children API failed: ${msg}`,
          statusCode,
          notionErrorBody: error instanceof NotionApiError ? error.body : undefined,
        })
      }
    }

    // Step 2: Fall back to Notion search API for all databases
    try {
      logs.push({
        step: 'search_api',
        status: 'attempting',
        detail: 'Searching for all databases via Notion search API',
      })

      const searchResult = await client.search({
        filter: { property: 'object', value: 'database' },
      })

      const searchDbs = searchResult.results as Array<Record<string, unknown>>
      logs.push({
        step: 'search_api',
        status: 'ok',
        detail: `Search returned ${searchDbs.length} database results`,
        count: searchDbs.length,
      })

      let addedCount = 0
      for (const db of searchDbs) {
        const id = db.id as string
        if (!allDbIds.has(id)) {
          allDbIds.add(id)
          addedCount++
        }
      }

      logs.push({
        step: 'search_api',
        status: 'ok',
        detail: `Added ${addedCount} new databases from search (${allDbIds.size} total unique)`,
        count: allDbIds.size,
      })

      // Build entries from search results with title extraction
      const entries: DiscoveredDbEntry[] = []
      for (const db of searchDbs) {
        const id = db.id as string
        const title = extractDbTitle(db)
        entries.push({ id, title, properties: {} })
      }

      // Fetch schemas for all databases
      const entriesWithSchemas = await fetchSchemas(client, Array.from(allDbIds), logs)

      logs.push({
        step: 'complete',
        status: 'ok',
        detail: `Returning ${entriesWithSchemas.length} databases from search fallback`,
        count: entriesWithSchemas.length,
      })

      return NextResponse.json({ databases: entriesWithSchemas, logs })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      const statusCode = error instanceof NotionApiError ? error.status : undefined

      if (statusCode === 403) {
        logs.push({
          step: 'search_api',
          status: 'forbidden',
          detail: 'Notion returned 403 — integration does not have access to databases',
          statusCode: 403,
          notionErrorBody: error instanceof NotionApiError ? error.body : undefined,
        })
        return NextResponse.json({
          databases: [],
          logs,
          error: 'Integration does not have access to databases. Make sure your Notion integration is connected to the parent page and any databases you want to use.',
        })
      }

      if (statusCode === 401) {
        logs.push({
          step: 'search_api',
          status: 'unauthorized',
          detail: 'Notion returned 401 — token is invalid',
          statusCode: 401,
        })
        return NextResponse.json({
          databases: [],
          logs,
          error: 'Notion token is invalid. Please check your token and try again.',
        })
      }

      logs.push({
        step: 'search_api',
        status: 'failed',
        detail: `Search API failed: ${msg}`,
        statusCode,
        notionErrorBody: error instanceof NotionApiError ? error.body : undefined,
      })

      return NextResponse.json({
        databases: [],
        logs,
        error: `Notion API returned ${statusCode || 500}. Please ensure your Notion integration has been shared with your databases.`,
      })
    }
  } catch (error) {
    logs.push({
      step: 'fatal',
      status: 'failed',
      detail: `Fatal error: ${error instanceof Error ? error.message : 'Unknown'}`,
    })
    return NextResponse.json({
      databases: [],
      logs,
      error: 'Failed to load databases',
    })
  }
}

async function fetchSchemas(
  client: ReturnType<typeof createNotionClient>,
  dbIds: string[],
  logs: DiscoveryLog[]
): Promise<DiscoveredDbEntry[]> {
  const entries: DiscoveredDbEntry[] = []
  let schemaSuccess = 0
  let schemaFailed = 0

  for (const id of dbIds) {
    try {
      const schema = await client.getDatabase(id)
      const title = schema.title?.map(t => t.plain_text).join('') || 'Untitled'
      const properties: DiscoveredDbEntry['properties'] = {}

      for (const [propName, propValue] of Object.entries(schema.properties)) {
        const prop = propValue as { type: string; relation?: { database_id?: string; data_source_id?: string } }
        let relationDataSourceId: string | undefined

        if (prop.type === 'relation' && prop.relation) {
          // iOS reads data_source_id first, then falls back to database_id
          relationDataSourceId = prop.relation.data_source_id || prop.relation.database_id
        }

        properties[propName] = {
          name: propName,
          type: prop.type,
          relationDataSourceId,
        }
      }

      entries.push({ id, title, properties })
      schemaSuccess++
    } catch (error) {
      schemaFailed++
      const msg = error instanceof Error ? error.message : 'Unknown'
      const statusCode = error instanceof NotionApiError ? error.status : undefined
      logs.push({
        step: 'schema_fetch',
        status: 'failed',
        detail: `Failed to fetch schema for database ${id}: ${msg}`,
        statusCode,
        notionErrorBody: error instanceof NotionApiError ? error.body : undefined,
      })
    }
  }

  logs.push({
    step: 'schema_fetch',
    status: 'ok',
    detail: `Schema fetch: ${schemaSuccess} succeeded, ${schemaFailed} failed`,
    count: schemaSuccess,
  })

  return entries
}

function extractDbTitle(db: Record<string, unknown>): string {
  const titleArr = db.title as Array<{ plain_text: string }> | undefined
  if (titleArr && titleArr.length > 0) return titleArr.map(t => t.plain_text).join('')
  const props = db.properties as Record<string, unknown> | undefined
  if (props) {
    for (const val of Object.values(props)) {
      const v = val as { type?: string; title?: Array<{ plain_text: string }> }
      if (v.type === 'title' && v.title) {
        return v.title.map(t => t.plain_text).join('')
      }
    }
  }
  return 'Untitled'
}
