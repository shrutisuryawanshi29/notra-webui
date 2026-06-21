'use client'

import { Receipt } from 'lucide-react'

interface StatusAndChecksGridProps {
  savingsRate: number
  netBalance: number
  largestExpense: { title: string; amount: number } | null
  mostUsedCategory: { name: string; count: number } | null
  uncategorizedCount: number
}

export default function StatusAndChecksGrid({
  savingsRate,
  netBalance,
  largestExpense,
  mostUsedCategory,
  uncategorizedCount,
}: StatusAndChecksGridProps) {
  return (
    <section>
      <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
        This Month Status
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status */}
        <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036] space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[#CBB9A7] text-xs">Savings Rate</span>
            <span className={`text-sm font-bold ${savingsRate >= 0 ? 'text-[#8CA37D]' : 'text-[#C7745A]'}`}>
              {savingsRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-[#40342B] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${savingsRate >= 0 ? 'bg-[#8CA37D]' : 'bg-[#C7745A]'}`}
              style={{ width: `${Math.min(Math.abs(savingsRate), 100)}%` }}
            />
          </div>
          <p className="text-[#9B8778] text-xs">
            {netBalance >= 0
              ? `You saved $${netBalance.toFixed(2)} this month`
              : `You overspent by $${Math.abs(netBalance).toFixed(2)} this month`
            }
          </p>
        </div>

        {/* Quick Checks */}
        <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036] space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C7745A]/10 flex items-center justify-center">
              <Receipt size={14} className="text-[#C7745A]" />
            </div>
            <div className="flex-1">
              <p className="text-[#CBB9A7] text-xs">Largest Expense</p>
              <p className="text-[#F4E9DA] text-sm font-medium">
                {largestExpense
                  ? `$${largestExpense.amount.toFixed(2)} — ${largestExpense.title || 'Untitled'}`
                  : 'No expenses'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C99152]/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C99152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[#CBB9A7] text-xs">Most Used Category</p>
              <p className="text-[#F4E9DA] text-sm font-medium">
                {mostUsedCategory ? `${mostUsedCategory.name} (${mostUsedCategory.count}x)` : 'No expenses'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#9B8778]/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B8778" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[#CBB9A7] text-xs">Uncategorized</p>
              <p className="text-[#F4E9DA] text-sm font-medium">
                {uncategorizedCount > 0 ? `${uncategorizedCount} transactions` : 'None'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
