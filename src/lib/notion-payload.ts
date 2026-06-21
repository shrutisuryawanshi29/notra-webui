import { SplitMetadata } from '@/types/transaction'
import { NotraConfig, getExpenseConfig, getIncomeConfig } from './config'

export interface NotionPageProperties {
  [key: string]: Record<string, unknown>
}

export function buildNotionProperties(
  config: NotraConfig,
  role: 'expense' | 'income',
  data: {
    title: string
    amount: number
    date: string
    category: string | null
    splitMetadata?: SplitMetadata | null
  },
  categoryType?: string | null
): NotionPageProperties {
  const isExpense = role === 'expense'
  const cfg = isExpense ? getExpenseConfig(config) : getIncomeConfig(config)
  const titleCol = cfg.titleColumn
  const amountCol = cfg.amountColumn
  const dateCol = cfg.dateColumn
  const catCol = cfg.categoryColumn
  const metaCol = isExpense ? cfg.metadataColumn : null

  const properties: NotionPageProperties = {}

  if (titleCol) {
    properties[titleCol] = {
      title: [{ text: { content: data.title } }],
    }
  }

  if (amountCol) {
    properties[amountCol] = {
      number: data.amount,
    }
  }

  if (dateCol) {
    properties[dateCol] = {
      date: { start: data.date },
    }
  }

  if (catCol && data.category && data.category.trim()) {
    if (categoryType === 'multi_select') {
      properties[catCol] = {
        multi_select: [{ name: data.category }],
      }
    } else if (categoryType === 'relation') {
      console.warn('[buildNotionProperties] Cannot write relation category from name alone:', data.category)
    } else if (categoryType === 'rich_text') {
      properties[catCol] = {
        rich_text: [{ text: { content: data.category } }],
      }
    } else {
      properties[catCol] = {
        select: { name: data.category },
      }
    }
  }

  if (isExpense && metaCol) {
    if (data.splitMetadata && data.splitMetadata.split.enabled) {
      properties[metaCol] = {
        rich_text: [{ text: { content: JSON.stringify(data.splitMetadata) } }],
      }
    } else {
      properties[metaCol] = {
        rich_text: [],
      }
    }
  }

  return properties
}

export function buildSplitDetailsJson(
  paidAmount: number,
  myShare: number,
  theyOwe: number,
  type: string,
  participants: Array<{ id: string; name: string; owes: number }>,
  inputs: Record<string, unknown>
): SplitMetadata {
  return {
    version: 2,
    split: {
      enabled: true,
      paidAmount,
      myShare,
      theyOwe,
      type,
      status: 'pending',
      participants: participants.map(p => ({
        id: p.id,
        name: p.name,
        owes: p.owes,
        status: 'pending',
        settledAt: null,
      })),
      inputs,
    },
  }
}

export function buildUpdatedSplitDetails(
  existing: SplitMetadata,
  participantId: string,
  settled: boolean
): SplitMetadata {
  const participants = existing.split.participants.map(p => {
    if (p.id === participantId) {
      return {
        ...p,
        status: settled ? 'settled' as const : 'pending' as const,
        settledAt: settled ? new Date().toISOString() : null,
      }
    }
    return p
  })

  const allSettled = participants.every(p => p.status === 'settled')

  return {
    ...existing,
    split: {
      ...existing.split,
      status: allSettled ? 'settled' : 'pending',
      participants,
    },
  }
}

export const METADATA_FALLBACK_NAMES = [
  'Split Details',
  'split details',
  'App Metadata',
  'app metadata',
  'Metadata',
  'metadata',
  'Notra Metadata',
  'notra metadata',
  'Split Metadata',
  'split metadata',
  'App Data',
  'app data',
  'Notra Data',
  'notra data',
]
