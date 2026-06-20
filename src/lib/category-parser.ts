import { CategoryValue } from './setup-state'

export async function parseCategories(
  token: string,
  databaseId: string,
  categoryPropertyName: string,
): Promise<CategoryValue[]> {
  const res = await fetch('/api/notion/databases/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, databaseId, page_size: 100 }),
  })
  const data = await res.json()
  const rows = (data.results || []) as Array<Record<string, unknown>>
  return extractCategoryValues(rows, categoryPropertyName)
}

function extractCategoryValues(
  rows: Array<Record<string, unknown>>,
  propertyName: string,
): CategoryValue[] {
  const categories: CategoryValue[] = []
  const seenIds = new Set<string>()

  for (const row of rows) {
    const properties = row.properties as Record<string, unknown> | undefined
    if (!properties) continue
    const prop = properties[propertyName] as Record<string, unknown> | undefined
    if (!prop) continue

    const type = prop.type as string

    switch (type) {
      case 'select': {
        const select = prop.select as Record<string, unknown> | undefined
        if (select?.id && select?.name && !seenIds.has(select.id as string)) {
          seenIds.add(select.id as string)
          categories.push({ id: select.id as string, name: select.name as string, sourceType: 'select' })
        }
        break
      }
      case 'multi_select': {
        const multiSelect = prop.multi_select as Array<Record<string, unknown>> | undefined
        if (multiSelect) {
          for (const item of multiSelect) {
            if (item.id && item.name && !seenIds.has(item.id as string)) {
              seenIds.add(item.id as string)
              categories.push({ id: item.id as string, name: item.name as string, sourceType: 'multi_select' })
            }
          }
        }
        break
      }
      case 'relation': {
        const relation = prop.relation as Array<Record<string, unknown>> | undefined
        if (relation) {
          for (const item of relation) {
            const pageId = item.id as string
            if (pageId && !seenIds.has(pageId)) {
              seenIds.add(pageId)
              categories.push({ id: pageId, name: 'Loading...', sourceType: 'relation' })
            }
          }
        }
        break
      }
      case 'title': {
        const titleArray = prop.title as Array<Record<string, unknown>> | undefined
        if (titleArray) {
          for (const item of titleArray) {
            const textObj = item.text as Record<string, unknown> | undefined
            const content = textObj?.content as string | undefined
            if (content && !seenIds.has(content)) {
              seenIds.add(content)
              categories.push({ id: content, name: content, sourceType: type })
            }
          }
        }
        break
      }
      case 'rich_text': {
        const textArray = prop.rich_text as Array<Record<string, unknown>> | undefined
        if (textArray) {
          for (const item of textArray) {
            const textObj = item.text as Record<string, unknown> | undefined
            const content = textObj?.content as string | undefined
            if (content && !seenIds.has(content)) {
              seenIds.add(content)
              categories.push({ id: content, name: content, sourceType: type })
            }
          }
        }
        break
      }
    }
  }

  return categories.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
}
