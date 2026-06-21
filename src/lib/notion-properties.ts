import { NotionPropertyValue, NotionPage } from '@/types/notion'
import {
  NormalizedTransaction,
  GroupedTransactionSection,
  SplitMetadata,
  SplitParticipant,
  SplitItem,
} from '@/types/transaction'

export function safeExtractText(
  value: unknown,
  fallback = ''
): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const texts = value.map(item => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'plain_text' in item) return String(item.plain_text ?? '')
      return ''
    })
    return texts.join('') || fallback
  }
  return fallback
}

export function extractPropertyValue(prop: NotionPropertyValue): string | number | boolean | null {
  switch (prop.type) {
    case 'title':
      return safeExtractText(prop.title) || null
    case 'rich_text':
      return prop.rich_text.map(t => t.plain_text).join('')
    case 'number':
      return prop.number
    case 'select':
      return prop.select?.name ?? null
    case 'multi_select':
      return prop.multi_select.map(s => s.name).join(', ')
    case 'date':
      return prop.date?.start ?? null
    case 'relation':
      return prop.relation.map(r => r.id).join(',')
    case 'checkbox':
      return prop.checkbox
    case 'url':
      return prop.url
    case 'email':
      return prop.email
    case 'phone_number':
      return prop.phone_number
    case 'status':
      return prop.status?.name ?? null
    default:
      return null
  }
}

export function extractCategoryName(
  prop: NotionPropertyValue | undefined,
  relationLookup?: Record<string, string>
): string | null {
  if (!prop) return null

  if (process.env.NODE_ENV === 'development') {
    console.log('[Category] prop type:', prop?.type, 'value:',
      prop?.type === 'select' ? prop?.select?.name :
      prop?.type === 'relation' ? prop?.relation?.map(r => r.id).join(',') :
      prop?.type === 'multi_select' ? prop?.multi_select?.map(s => s.name).join(',') :
      '(other)'
    )
  }

  if (prop.type === 'select') {
    return prop.select?.name ?? null
  }

  if (prop.type === 'multi_select') {
    return prop.multi_select.map(s => s.name).join(', ') || null
  }

  if (prop.type === 'title') {
    return safeExtractText(prop.title).trim() || null
  }

  if (prop.type === 'rich_text') {
    return prop.rich_text.map(t => t.plain_text).join('').trim() || null
  }

  if (prop.type === 'checkbox') {
    return prop.checkbox ? 'Yes' : 'No'
  }

  if (prop.type === 'url' && prop.url) {
    return prop.url
  }

  if (prop.type === 'email' && prop.email) {
    return prop.email
  }

  if (prop.type === 'phone_number' && prop.phone_number) {
    return prop.phone_number
  }

  if (prop.type === 'status') {
    return prop.status?.name ?? null
  }

  if (prop.type === 'relation' && relationLookup) {
    const ids = prop.relation.map(r => r.id)
    const names = ids.map(id => relationLookup[id]).filter((n): n is string => !!n)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Category] relation ids:', ids, 'resolved names:', names, 'lookup keys:', Object.keys(relationLookup).slice(0, 3))
    }
    return names.length > 0 ? names.join(', ') : null
  }

  return null
}

export function extractCategoryRelationIds(prop: NotionPropertyValue | undefined): string[] {
  if (!prop || prop.type !== 'relation') return []
  return prop.relation.map(r => r.id)
}

export function normalizePageToTransaction(
  page: NotionPage,
  databaseId: string,
  databaseRole: 'expense' | 'income',
  mappings: {
    titleColumn: string
    amountColumn: string
    dateColumn: string
    categoryColumn: string | null
    metadataColumn: string | null
  },
  relationCategoryLookup?: Record<string, string>
): NormalizedTransaction {
  const props = page.properties || {}
  const titleProp = props[mappings.titleColumn] as NotionPropertyValue | undefined
  const amountProp = props[mappings.amountColumn] as NotionPropertyValue | undefined
  const dateProp = props[mappings.dateColumn] as NotionPropertyValue | undefined
  const categoryProp = mappings.categoryColumn ? (props[mappings.categoryColumn] as NotionPropertyValue | undefined) : undefined
  const metadataProp = mappings.metadataColumn ? (props[mappings.metadataColumn] as NotionPropertyValue | undefined) : undefined

  const title = typeof extractPropertyValue(titleProp!) === 'string'
    ? (extractPropertyValue(titleProp!) as string)
    : 'Untitled'

  const rawAmount = amountProp && amountProp.type === 'number' ? amountProp.number : 0
  const amount = Math.abs(rawAmount ?? 0)

  let date = ''
  if (dateProp && dateProp.type === 'date' && dateProp.date?.start) {
    date = dateProp.date.start
  }

  const category = extractCategoryName(categoryProp, relationCategoryLookup)

  let splitMetadata: SplitMetadata | null = null
  if (metadataProp && metadataProp.type === 'rich_text') {
    const jsonStr = metadataProp.rich_text.map(t => t.plain_text).join('')
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed && parsed.split && parsed.split.enabled) {
          splitMetadata = normalizeSplitMetadata(parsed)
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }

  const paidAmount = splitMetadata?.split?.paidAmount ?? null

  return {
    id: page.id,
    title,
    amount,
    paidAmount,
    category,
    date,
    databaseId,
    databaseRole,
    rawProperties: props,
    splitMetadata,
  }
}

function normalizeSplitMetadata(parsed: Record<string, unknown>): SplitMetadata {
  const version = (parsed.version as number) || 2

  if (version === 1 && parsed.split) {
    const s = parsed.split as Record<string, unknown>
    const participants: SplitParticipant[] = []
    if (s.splitWith) {
      participants.push({
        id: stablePersonId(s.splitWith as string),
        name: s.splitWith as string,
        owes: typeof s.theyOwe === 'number' ? s.theyOwe : 0,
        status: (s.status as 'pending' | 'settled') || 'pending',
        settledAt: null,
      })
    }

    return {
      version: 1,
      split: {
        enabled: true,
        paidAmount: typeof s.paidAmount === 'number' ? s.paidAmount : 0,
        myShare: typeof s.myShare === 'number' ? s.myShare : 0,
        theyOwe: typeof s.theyOwe === 'number' ? s.theyOwe : 0,
        type: (s.type as string) || 'half',
        status: (s.status as 'pending' | 'settled') || 'pending',
        participants,
        splitWith: s.splitWith as string | undefined,
        inputs: (s.inputs as Record<string, unknown>) || {},
      },
    }
  }

  if (parsed.split) {
    const s = parsed.split as Record<string, unknown>
    const participants: SplitParticipant[] = (s.participants as Array<Record<string, unknown>> || []).map(
      (p: Record<string, unknown>) => ({
        id: (p.id as string) || '',
        name: (p.name as string) || '',
        owes: typeof p.owes === 'number' ? p.owes : 0,
        status: (p.status as 'pending' | 'settled') || 'pending',
        settledAt: (p.settledAt as string) || null,
      })
    )

    return {
      version: 2,
      split: {
        enabled: true,
        paidAmount: typeof s.paidAmount === 'number' ? s.paidAmount : 0,
        myShare: typeof s.myShare === 'number' ? s.myShare : 0,
        theyOwe: typeof s.theyOwe === 'number' ? s.theyOwe : 0,
        type: (s.type as string) || 'manualEqual',
        status: (s.status as 'pending' | 'settled') || 'pending',
        participants,
        inputs: (s.inputs as Record<string, unknown>) || {},
        items: s.items as SplitItem[] | undefined,
      },
      receipt: parsed.receipt ? (parsed.receipt as { source: string; merchant: string | null; itemCount: number; originalTotal: number | null }) : undefined,
    }
  }

  return {
    version: 2,
    split: {
      enabled: true,
      paidAmount: 0,
      myShare: 0,
      theyOwe: 0,
      type: 'manualEqual',
      status: 'pending',
      participants: [],
      inputs: {},
    },
  }
}

export function stablePersonId(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function groupTransactionsByDate(
  transactions: NormalizedTransaction[]
): GroupedTransactionSection[] {
  const groups: Record<string, NormalizedTransaction[]> = {}

  for (const t of transactions) {
    if (!groups[t.date]) groups[t.date] = []
    groups[t.date].push(t)
  }

  return Object.entries(groups)
    .map(([date, txs]) => {
      const sorted = [...txs].sort((a, b) => b.amount - a.amount)
      const d = new Date(date + 'T12:00:00Z')
      const displayDate = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
      return {
        date,
        displayDate,
        transactions: sorted,
        totalAmount: sorted.reduce((sum, t) => sum + t.amount, 0),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}
