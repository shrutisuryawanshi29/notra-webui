'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete, loadConfig, getExpenseConfig } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { SplitTrackerPersonGroup } from '@/types/transaction'
import { extractSplitTrackerEntries, groupSplitTrackerEntries } from '@/lib/split-metadata'
import { buildUpdatedSplitDetails } from '@/lib/notion-payload'
import Card from '@/components/Card'
import Chip from '@/components/Chip'
import LoadingSpinner from '@/components/LoadingSpinner'
import { RefreshCw } from 'lucide-react'

type FilterMode = 'all' | 'pending' | 'settled'

export default function SplitTrackerPage() {
  const router = useRouter()
  const { state, loadData } = useCache()
  const [filter, setFilter] = useState<FilterMode>('all')

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const groups = useMemo(() => {
    const entries = extractSplitTrackerEntries(state.expenses)
    const filtered = entries.filter((e) => {
      if (filter === 'pending') return e.status === 'pending'
      if (filter === 'settled') return e.status === 'settled'
      return true
    })
    return groupSplitTrackerEntries(filtered)
  }, [state.expenses, filter])

  const totalPendingOwed = groups.reduce((s, g) => s + g.pendingTotal, 0)
  const totalSettled = groups.reduce((s, g) => s + g.settledTotal, 0)

  const toggleSettlement = async (
    transactionId: string,
    participantId: string,
    currentStatus: string
  ) => {
    const config = loadConfig()
    if (!config) return
    const expenseCfg = getExpenseConfig(config)

    const tx = state.expenses.find(e => e.id === transactionId)
    if (!tx?.splitMetadata) return

    const newSettled = currentStatus !== 'settled'
    const updated = buildUpdatedSplitDetails(tx.splitMetadata, participantId, newSettled)

    const metaCol = expenseCfg.metadataColumn
    if (!metaCol) return

    const properties: Record<string, unknown> = {
      [metaCol]: {
        rich_text: [{ text: { content: JSON.stringify(updated) } }],
      },
    }

    try {
      const res = await fetch(`/api/notion/pages/${transactionId}/settle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: config.notionToken, properties }),
      })
      if (res.ok) {
        loadData()
      }
    } catch {
      alert('Failed to update settlement')
    }
  }

  if (state.loading && state.expenses.length === 0) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight mb-6">Split Tracker</h1>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Split Tracker</h1>
        <button
          onClick={loadData}
          className="text-[#9B8778] hover:text-[#9B8778] transition-colors"
          title="Refresh data"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        <Chip selected={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pending
        </Chip>
        <Chip selected={filter === 'settled'} onClick={() => setFilter('settled')}>
          Settled
        </Chip>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <p className="text-[#9B8778] text-xs">Pending Owed</p>
          <p className="text-[#D49A4A] text-xl font-bold tracking-tight mt-1">
            ${totalPendingOwed.toFixed(2)}
          </p>
        </Card>
        <Card>
          <p className="text-[#9B8778] text-xs">Settled</p>
          <p className="text-[#93B889] text-xl font-bold tracking-tight mt-1">
            ${totalSettled.toFixed(2)}
          </p>
        </Card>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[#9B8778] text-sm">No split transactions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.personId}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#F4EDE3] text-base font-semibold tracking-wider">
                  {group.personName}
                </h3>
                <div className="flex gap-3 text-xs">
                  {group.pendingTotal > 0 && (
                    <span className="text-[#D49A4A] tracking-tight">
                      Pending: ${group.pendingTotal.toFixed(2)}
                    </span>
                  )}
                  {group.settledTotal > 0 && (
                    <span className="text-[#93B889] tracking-tight">
                      Settled: ${group.settledTotal.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <div
                    key={`${entry.transactionId}-${entry.participantId}`}
                    className="flex items-center justify-between py-1.5 border-b border-[#5A4638]/30 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[#F4EDE3] text-sm truncate">
                        {entry.transactionTitle}
                      </p>
                      <p className="text-[#9B8778] text-xs">
                        {entry.date}
                        {entry.category ? ` • ${entry.category}` : ''}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex items-center gap-2">
                      <p className="text-[#F4EDE3] text-sm font-medium tracking-tight">
                        ${entry.amountOwed.toFixed(2)}
                      </p>
                      <button
                        onClick={() =>
                          toggleSettlement(
                            entry.transactionId,
                            entry.participantId,
                            entry.status
                          )
                        }
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                          entry.status === 'settled'
                            ? 'bg-[#93B889] text-white'
                            : 'bg-[#D49A4A] text-white hover:bg-[#93B889]'
                        }`}
                      >
                        {entry.status === 'settled' ? 'Settled' : 'Pending'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
