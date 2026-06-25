'use client'

import { X } from 'lucide-react'
import Card from '@/components/Card'
import EmptyState from './EmptyState'
import { NormalizedTransaction } from '@/types/transaction'
import { formatCurrency, formatShortDate } from '@/lib/analytics'

interface FilteredTransactionsTableProps {
  transactions: NormalizedTransaction[]
  activeCategoryFilter: string | null
  onCategoryFilter: (name: string | null) => void
  totalIncome: number
  totalExpenses: number
}

export default function FilteredTransactionsTable({
  transactions,
  activeCategoryFilter,
  onCategoryFilter,
  totalIncome,
  totalExpenses,
}: FilteredTransactionsTableProps) {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

  const filteredCategoryAmount = activeCategoryFilter
    ? sorted
        .filter((t) => t.category === activeCategoryFilter)
        .reduce((sum, t) => sum + t.amount, 0)
    : 0

  if (sorted.length === 0) {
    return (
      <Card>
        <h3 className="text-[#F4EDE3] text-sm font-semibold mb-1">Transactions</h3>
        <EmptyState title="No transactions for this period" />
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold mb-3">Transactions</h3>

      {activeCategoryFilter && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#D49A4A]/10 text-[#D49A4A] text-xs">
            Category: {activeCategoryFilter}
            <button onClick={() => onCategoryFilter(null)} className="hover:text-white transition-colors">
              <X size={12} />
            </button>
          </span>
          <span className="text-[#9B8778] text-xs">
            Total {activeCategoryFilter} Expenses: {formatCurrency(filteredCategoryAmount)}
          </span>
        </div>
      )}

      <div className="flex justify-between text-xs text-[#9B8778] mb-3">
        <span>Total Income: {formatCurrency(totalIncome)}</span>
        <span>Total Expenses: {formatCurrency(totalExpenses)}</span>
        <span>Net: {formatCurrency(totalIncome - totalExpenses)}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="text-[#9B8778] text-xs uppercase tracking-wider border-b border-[#6B5847]">
              <th className="text-left font-medium pb-2 pr-4">Date</th>
              <th className="text-left font-medium pb-2 pr-4">Title</th>
              <th className="text-left font-medium pb-2 pr-4">Category</th>
              <th className="text-left font-medium pb-2 pr-4">Type</th>
              <th className="text-right font-medium pb-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((txn) => (
              <tr key={txn.id} className="border-b border-[#6B5847]/50 hover:bg-[#403027]/30 transition-colors">
                <td className="py-2.5 pr-4 text-[#9B8778] text-xs whitespace-nowrap">{formatShortDate(txn.date)}</td>
                <td className="py-2.5 pr-4 text-[#F4EDE3] text-sm">{txn.title}</td>
                <td className="py-2.5 pr-4">
                  {txn.category ? (
                    <button
                      onClick={() => onCategoryFilter(txn.category)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white bg-[#D49A4A] hover:opacity-80 transition-opacity"
                    >
                      {txn.category}
                    </button>
                  ) : (
                    <span className="text-[#9B8778] text-xs">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      txn.databaseRole === 'expense'
                        ? 'bg-[#D8755D]/10 text-[#D8755D]'
                        : 'bg-[#93B889]/10 text-[#93B889]'
                    }`}
                  >
                    {txn.databaseRole === 'expense' ? 'Expense' : 'Income'}
                  </span>
                </td>
                <td
                  className={`py-2.5 text-sm font-medium tracking-tight text-right whitespace-nowrap ${
                    txn.databaseRole === 'expense' ? 'text-[#D8755D]' : 'text-[#93B889]'
                  }`}
                >
                  {formatCurrency(txn.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

FilteredTransactionsTable.displayName = 'FilteredTransactionsTable'
