import {
  SplitMetadata,
  SplitParticipant,
  SplitTrackerEntry,
  SplitTrackerPersonGroup,
  NormalizedTransaction,
} from '@/types/transaction'
import { stablePersonId } from './notion-properties'

export function getSplitSubtitle(metadata: SplitMetadata): string | null {
  if (!metadata.split.enabled) return null
  const participants = metadata.split.participants

  if (!participants || participants.length === 0) return null

  const pending = participants.filter(p => !p.status || p.status === 'pending')
  const settled = participants.filter(p => p.status === 'settled')

  const pendingOwed = pending.reduce((s, p) => s + p.owes, 0)
  const settledOwed = settled.reduce((s, p) => s + p.owes, 0)

  if (pending.length === 0 && settled.length > 0) {
    return formatSettledSubtitle(settled, settledOwed)
  }
  if (settled.length === 0 && pending.length > 0) {
    return formatPendingSubtitle(pending, pendingOwed)
  }
  return `Pending $${pendingOwed.toFixed(2)} • Settled $${settledOwed.toFixed(2)}`
}

function formatPendingSubtitle(pending: SplitParticipant[], total: number): string {
  if (pending.length === 1) {
    return `${pending[0].name} owes $${total.toFixed(2)}`
  }
  return `${pending.length} people owe $${total.toFixed(2)}`
}

function formatSettledSubtitle(settled: SplitParticipant[], total: number): string {
  if (settled.length === 1) {
    return `${settled[0].name} settled $${total.toFixed(2)}`
  }
  return `${settled.length} people settled $${total.toFixed(2)}`
}

export function extractSplitTrackerEntries(
  transactions: NormalizedTransaction[]
): SplitTrackerEntry[] {
  const entries: SplitTrackerEntry[] = []

  for (const t of transactions) {
    if (!t.splitMetadata || !t.splitMetadata.split.enabled) continue
    const participants = t.splitMetadata.split.participants

    if (!participants || participants.length === 0) {
      const splitWith = t.splitMetadata.split.splitWith
      if (splitWith) {
        entries.push({
          transactionId: t.id,
          transactionTitle: t.title,
          date: t.date,
          category: t.category,
          amountOwed: t.splitMetadata.split.theyOwe,
          status: t.splitMetadata.split.status === 'settled' ? 'settled' : 'pending',
          settledAt: null,
          participantId: stablePersonId(splitWith),
          splitMetadata: t.splitMetadata,
          transaction: t,
        })
      }
      continue
    }

    for (const p of participants) {
      entries.push({
        transactionId: t.id,
        transactionTitle: t.title,
        date: t.date,
        category: t.category,
        amountOwed: p.owes,
        status: p.status === 'settled' ? 'settled' : 'pending',
        settledAt: p.settledAt,
        participantId: p.id,
        splitMetadata: t.splitMetadata,
        transaction: t,
      })
    }
  }

  return entries
}

export function groupSplitTrackerEntries(
  entries: SplitTrackerEntry[]
): SplitTrackerPersonGroup[] {
  const groups: Record<string, SplitTrackerEntry[]> = {}

  for (const entry of entries) {
    if (!groups[entry.participantId]) groups[entry.participantId] = []
    groups[entry.participantId].push(entry)
  }

  return Object.entries(groups).map(([personId, groupEntries]) => {
    const personName = groupEntries[0].splitMetadata.split.participants.find(
      p => p.id === personId
    )?.name || groupEntries[0].splitMetadata.split.splitWith || 'Unknown person'

    const pendingTotal = groupEntries
      .filter(e => e.status === 'pending')
      .reduce((s, e) => s + e.amountOwed, 0)

    const settledTotal = groupEntries
      .filter(e => e.status === 'settled')
      .reduce((s, e) => s + e.amountOwed, 0)

    return {
      personId,
      personName,
      pendingTotal,
      settledTotal,
      entries: groupEntries,
    }
  })
}
