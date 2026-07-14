'use client'

import { useEffect, useState, useMemo } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { NormalizedTransaction, SplitItemAssignment } from '@/types/transaction'
import { getSplitMethodLabel } from '@/lib/split-metadata'

interface TransactionDetailModalProps {
  open: boolean
  onClose: () => void
  transaction: NormalizedTransaction | null
}

const assignmentLabels: Record<SplitItemAssignment, string> = {
  mine: 'Mine',
  person: 'Person',
  shared: 'Shared',
  everyone: 'Everyone',
  ignore: 'Ignored',
}

const assignmentBadgeColors: Record<SplitItemAssignment, string> = {
  mine: 'bg-[#93B889]/20 text-[#93B889]',
  person: 'bg-[#6FC2D0]/20 text-[#6FC2D0]',
  shared: 'bg-[#D49A4A]/20 text-[#D49A4A]',
  everyone: 'bg-[#8B7EF6]/20 text-[#8B7EF6]',
  ignore: 'bg-[#5A4638]/50 text-[#9B8778]',
}

const itemStatusBadgeColors: Record<string, string> = {
  return_pending: 'bg-[#D49A4A]/20 text-[#D49A4A]',
  return_complete: 'bg-[#6A5140]/50 text-[#9B8778]',
  returned: 'bg-[#6A5140]/50 text-[#9B8778]',
  refunded: 'bg-[#D8755D]/20 text-[#D8755D]',
  refund_complete: 'bg-[#D8755D]/20 text-[#D8755D]',
  cancelled: 'bg-[#D8755D]/20 text-[#D8755D]',
  substituted: 'bg-[#6FC2D0]/20 text-[#6FC2D0]',
  not_charged: 'bg-[#6A5140]/50 text-[#9B8778]',
  excluded: 'bg-[#6A5140]/50 text-[#9B8778]',
}

const itemStatusLabels: Record<string, string> = {
  return_pending: 'Return Pending',
  return_complete: 'Returned',
  returned: 'Returned',
  refunded: 'Refunded',
  refund_complete: 'Refunded',
  cancelled: 'Cancelled',
  substituted: 'Substituted',
  not_charged: 'Not Charged',
  excluded: 'Excluded',
}

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '$0.00'
  if (n < 0) return `-$${Math.abs(n).toFixed(2)}`
  return `$${n.toFixed(2)}`
}

function formatFinalAmountMode(mode: string | undefined): string {
  switch (mode) {
    case 'printed_total': return 'Printed Total'
    case 'items_only': return 'Items Only'
    case 'items_plus_tax': return 'Items + Tax'
    case 'custom': return 'Custom'
    default: return ''
  }
}

function getItemStatusBadge(status: string): { label: string; colors: string } | null {
  if (status === 'purchased' || status === 'unknown') return null
  const label = itemStatusLabels[status]
  const colors = itemStatusBadgeColors[status]
  if (!label || !colors) return null
  return { label, colors }
}

export default function TransactionDetailModal({ open, onClose, transaction }: TransactionDetailModalProps) {
  const [showIgnored, setShowIgnored] = useState(false)

  useEffect(() => {
    if (!open) return
    setShowIgnored(false)
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const t = transaction
  const split = t?.splitMetadata?.split ?? null
  const isSplit = !!(split?.enabled)
  const receipt = t?.splitMetadata?.receipt ?? null
  const isExpense = t?.databaseRole === 'expense'
  const accentColor = isExpense ? '#D8755D' : '#93B889'
  const amountColor = isExpense ? 'text-[#D8755D]' : 'text-[#93B889]'
  const splitStatus = split?.status ?? null
  const isReceipt = split?.type === 'receiptMultiPerson'

  const methodLabel = split?.type ? getSplitMethodLabel(split.type) : null

  const resolvedNames = useMemo(() => {
    const map = new Map<string, string>()
    if (split?.participants) {
      for (const p of split.participants) {
        map.set(p.id, p.name)
      }
    }
    return map
  }, [split?.participants])

  const keptItems = useMemo(() =>
    (split?.items || []).filter(i => i.assignment !== 'ignore'),
    [split?.items]
  )
  const ignoredItems = useMemo(() =>
    (split?.items || []).filter(i => i.assignment === 'ignore'),
    [split?.items]
  )

  const keptTotal = keptItems.reduce((s, i) => s + i.price, 0)
  const ignoredTotal = ignoredItems.reduce((s, i) => s + i.price, 0)
  const finalAmount = receipt?.finalAmountToSplit ?? split?.paidAmount ?? 0
  const scaleFactor = keptTotal > 0 ? finalAmount / keptTotal : 0

  const itemPortions = keptItems.map(item => {
    const scaled = item.price * scaleFactor
    let myPortion = 0
    let theirPortion = 0

    switch (item.assignment) {
      case 'mine':
        myPortion = scaled
        break
      case 'person':
        theirPortion = scaled
        break
      case 'shared': {
        const N = item.sharedWith.length
        const share = N > 0 ? scaled / (N + 1) : scaled
        myPortion = share
        theirPortion = share
        break
      }
      case 'everyone': {
        const total = (split?.participants?.length ?? 0) + 1
        const share = total > 0 ? scaled / total : 0
        myPortion = share
        theirPortion = share
        break
      }
    }

    return { ...item, scaledPrice: scaled, myPortion, theirPortion }
  })

  function resolveParticipantName(id: string): string {
    return resolvedNames.get(id) || id
  }

  if (!open || !t) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#2A1F18] border border-[#5A4638] rounded-2xl w-full max-w-xl mx-2 sm:mx-2 p-3 sm:p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-[#9B8778] hover:text-[#F4EDE3] transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="mb-4 sm:mb-5 pr-6">
          <h2 className="text-[#F4EDE3] text-lg sm:text-xl font-bold leading-tight">
            {t.title}
          </h2>
          <p className="text-[#9B8778] text-xs sm:text-sm mt-1">
            {t.date}
            {t.category ? ` • ${t.category}` : ''}
            {methodLabel ? ` • ${methodLabel}` : ''}
          </p>
        </div>

        {/* Amount and type */}
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-base sm:text-lg font-bold ${amountColor}`}>
            {isExpense ? '-' : '+'}{fmt(t.amount)}
          </span>
          <span
            className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            {isExpense ? 'Expense' : 'Income'}
          </span>
          {t.paidAmount != null && (
            <span className="text-[#B8A99A] text-xs">
              Paid: {fmt(t.paidAmount)}
            </span>
          )}
        </div>

        {!isSplit && (
          <div className="bg-[#1B120E] rounded-xl p-3 sm:p-4 space-y-1.5">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-[#9B8778]">Amount</span>
              <span className={`font-bold ${amountColor}`}>
                {isExpense ? '-' : '+'}{fmt(t.amount)}
              </span>
            </div>
            {t.paidAmount != null && (
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-[#9B8778]">Paid amount</span>
                <span className="text-[#F4EDE3] font-bold">{fmt(t.paidAmount)}</span>
              </div>
            )}
          </div>
        )}

        {/* Split detail */}
        {isSplit && split && (
          <>
            {/* Status badge */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${
                  splitStatus === 'settled'
                    ? 'bg-[#93B889] text-white'
                    : 'bg-[#D49A4A] text-white'
                }`}
              >
                {splitStatus === 'settled' ? 'Settled' : 'Pending'}
              </span>
              {methodLabel && (
                <span className="text-[#9B8778] text-[11px]">{methodLabel}</span>
              )}
            </div>

            {/* Key amounts */}
            <div className="bg-[#1B120E] rounded-xl p-3 sm:p-4 mb-4 space-y-1.5">
              {isReceipt && receipt && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-[#9B8778]">Final amount to split</span>
                  <span className="text-[#D49A4A] font-bold">{fmt(receipt.finalAmountToSplit)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-[#9B8778]">My share</span>
                <span className="text-[#93B889] font-bold">{fmt(split.myShare)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-[#9B8778]">They owe</span>
                <span className="text-[#D8755D] font-bold">{fmt(split.theyOwe)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-[#9B8778]">Paid amount</span>
                <span className="text-[#F4EDE3] font-bold">{fmt(split.paidAmount)}</span>
              </div>
            </div>

            {/* Receipt Split View */}
            {isReceipt && receipt && split.items && split.items.length > 0 && (
              <>
                {/* Amount Summary Card */}
                <div className="bg-[#1B120E] rounded-xl p-3 sm:p-4 mb-4 space-y-1.5">
                  <h3 className="text-[#B8A99A] text-[11px] font-semibold uppercase tracking-wider mb-2">
                    Amount Summary
                  </h3>
                  {receipt.printedTotal != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#9B8778]">Printed total</span>
                      <span className="text-[#B8A99A]">{fmt(receipt.printedTotal)}</span>
                    </div>
                  )}
                  {receipt.chargedAmount != null && receipt.chargedAmount !== receipt.printedTotal && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#9B8778]">Charged amount</span>
                      <span className="text-[#B8A99A]">{fmt(receipt.chargedAmount)}</span>
                    </div>
                  )}
                  {receipt.finalAmountToSplit != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#9B8778]">Final amount to split</span>
                      <span className="text-[#D49A4A] font-semibold">{fmt(receipt.finalAmountToSplit)}</span>
                    </div>
                  )}
                  {receipt.finalAmountMode && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#9B8778]">Mode</span>
                      <span className="text-[#B8A99A]">{formatFinalAmountMode(receipt.finalAmountMode)}</span>
                    </div>
                  )}
                  {receipt.manualAdjustment != null && receipt.manualAdjustment !== 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#9B8778]">
                        Manual adjustment{receipt.manualAdjustmentNote ? ` (${receipt.manualAdjustmentNote})` : ''}
                      </span>
                      <span className={receipt.manualAdjustment < 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}>
                        {fmt(receipt.manualAdjustment)}
                      </span>
                    </div>
                  )}
                  {receipt.groupTax != null && receipt.groupTax !== 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#9B8778]">Tax</span>
                      <span className="text-[#B8A99A]">{fmt(receipt.groupTax)}</span>
                    </div>
                  )}
                  {ignoredTotal > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#9B8778]">Ignored items</span>
                      <span className="text-[#6A5140]">{fmt(ignoredTotal)}</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="mb-4">
                  <h3 className="text-[#B8A99A] text-[11px] font-semibold uppercase tracking-wider mb-2 px-1">
                    Items ({keptItems.length})
                  </h3>
                  <div className="space-y-2">
                    {itemPortions.map((item, idx) => {
                      const itemStatus = receipt?.itemStatuses?.[item.name]
                      const statusBadge = itemStatus ? getItemStatusBadge(itemStatus) : null

                      const splitWithIds = item.sharedWith
                      const splitWithNames = splitWithIds.map(resolveParticipantName)
                      const splitWithText =
                        item.assignment === 'shared' && splitWithNames.length > 0
                          ? ` with ${splitWithNames.join(', ')}`
                          : item.assignment === 'person' && splitWithNames.length > 0
                          ? ` for ${splitWithNames[0]}`
                          : ''

                      return (
                        <div
                          key={idx}
                          className="bg-[#1B120E] rounded-lg p-2.5 sm:p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[#F4EDE3] text-sm font-medium truncate">
                                  {item.name}
                                </span>
                                <span className="text-[#B8A99A] text-xs font-mono">
                                  {fmt(item.price)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {item.category && (
                                  <span className="text-[#6A5140] text-[10px] bg-[#403027]/50 px-1.5 py-0.5 rounded">
                                    {item.category}
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                    assignmentBadgeColors[item.assignment]
                                  }`}
                                >
                                  {assignmentLabels[item.assignment]}
                                </span>
                                {statusBadge && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusBadge.colors}`}
                                  >
                                    {statusBadge.label}
                                  </span>
                                )}
                              </div>
                              {splitWithText && (
                                <p className="text-[#9B8778] text-[10px] mt-0.5">
                                  {splitWithText}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] text-[#93B889]">
                                My: {fmt(item.myPortion)}
                              </p>
                              <p className="text-[10px] text-[#D8755D]">
                                Other: {fmt(item.theirPortion)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Ignored Items (collapsible) */}
                {ignoredItems.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowIgnored(prev => !prev)}
                      className="flex items-center gap-1 text-[#9B8778] hover:text-[#B8A99A] text-xs transition-colors"
                    >
                      {showIgnored ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>
                        Ignored items ({ignoredItems.length})
                      </span>
                    </button>
                    {showIgnored && (
                      <div className="mt-2 space-y-1 pl-4">
                        {ignoredItems.map((item, idx) => {
                          const itemStatus = receipt?.itemStatuses?.[item.name]
                          const statusBadge = itemStatus ? getItemStatusBadge(itemStatus) : null

                          return (
                            <div key={idx} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[#9B8778] text-xs">{item.name}</span>
                                {statusBadge && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusBadge.colors}`}>
                                    {statusBadge.label}
                                  </span>
                                )}
                              </div>
                              <span className="text-[#6A5140] text-xs font-mono">{fmt(item.price)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Manual Split View */}
            {!isReceipt && (
              <div className="bg-[#1B120E] rounded-xl p-3 sm:p-4 mb-4 space-y-1.5">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-[#9B8778]">Split type</span>
                  <span className="text-[#B8A99A]">{methodLabel || split.type}</span>
                </div>
                {split.inputs && Object.keys(split.inputs).length > 0 && (
                  <div className="pt-1 space-y-1">
                    <p className="text-[#6A5140] text-[10px] font-semibold uppercase tracking-wider">
                      Inputs
                    </p>
                    {Object.entries(split.inputs).map(([key, val]) => {
                      const displayVal = typeof val === 'number'
                        ? fmt(val)
                        : String(val ?? '')
                      if (!displayVal) return null
                      return (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-[#9B8778]">{key}</span>
                          <span className="text-[#B8A99A]">{displayVal}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Participants Section */}
            {split.participants && split.participants.length > 0 && (
              <div>
                <h3 className="text-[#B8A99A] text-[11px] font-semibold uppercase tracking-wider mb-2">
                  Participants ({split.participants.length})
                </h3>
                <div className="space-y-1.5">
                  {split.participants.map(p => (
                    <div
                      key={p.id}
                      className="bg-[#1B120E] rounded-lg px-3 py-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#F4EDE3] text-sm truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[#B8A99A] text-xs font-mono">{fmt(p.owes)}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                            p.status === 'settled'
                              ? 'bg-[#93B889]/20 text-[#93B889]'
                              : 'bg-[#D49A4A]/20 text-[#D49A4A]'
                          }`}
                        >
                          {p.status === 'settled' ? 'Settled' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {split.participants.some(p => p.status === 'settled' && p.settledAt) && (
                  <div className="mt-2 space-y-0.5">
                    {split.participants.filter(p => p.status === 'settled' && p.settledAt).map(p => (
                      <p key={p.id} className="text-[#6A5140] text-[10px]">
                        {p.name} settled {p.settledAt}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
