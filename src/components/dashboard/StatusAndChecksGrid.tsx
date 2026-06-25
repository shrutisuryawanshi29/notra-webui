'use client'

import { Receipt } from 'lucide-react'

interface StatusAndChecksGridProps {
  savingsRate: number
  netBalance: number
  expenseCount: number
  incomeCount: number
  largestExpense: { title: string; amount: number } | null
  mostUsedCategory: { name: string; count: number } | null
  uncategorizedCount: number
}

export default function StatusAndChecksGrid({
  savingsRate,
  netBalance,
  expenseCount,
  incomeCount,
  largestExpense,
  mostUsedCategory,
  uncategorizedCount,
}: StatusAndChecksGridProps) {
  const hasIncome = incomeCount > 0
  const hasExpenses = expenseCount > 0

  let mainText: string
  let subText: string
  let footerText: string

  if (!hasExpenses && !hasIncome) {
    mainText = 'No transactions yet for this month'
    subText = 'Add your first expense or income'
    footerText = '0 expenses · 0 income entries'
  } else if (!hasIncome) {
    mainText = 'No income recorded this month'
    subText = 'Add income to calculate savings rate'
    footerText = `${expenseCount} expense${expenseCount !== 1 ? 's' : ''} · 0 income entries`
  } else if (netBalance >= 0) {
    mainText = `You saved $${netBalance.toFixed(2)} this month`
    subText = `Income is higher than expenses by ${Math.abs(savingsRate).toFixed(0)}%`
    footerText = `${expenseCount} expense${expenseCount !== 1 ? 's' : ''} · ${incomeCount} income ${incomeCount !== 1 ? 'entries' : 'entry'}`
  } else {
    mainText = `You spent $${Math.abs(netBalance).toFixed(2)} more than you earned`
    subText = `Expenses are higher than income by ${Math.abs(savingsRate).toFixed(0)}%`
    footerText = `${expenseCount} expense${expenseCount !== 1 ? 's' : ''} · ${incomeCount} income ${incomeCount !== 1 ? 'entries' : 'entry'}`
  }

  const isPositive = netBalance >= 0 && hasIncome
  const isNegative = netBalance < 0 && hasIncome
  const iconBgColor = isPositive ? 'bg-[#93B889]' : isNegative ? 'bg-[#D8755D]' : 'bg-[#D49A4A]'
  const mainTextColor = isPositive ? 'text-[#93B889]' : isNegative ? 'text-[#D8755D]' : 'text-[#F4EDE3]'

  return (
    <section>
      <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
        This Month Status
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status */}
        <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847] space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBgColor}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#F4EDE3] text-base font-semibold leading-tight">
                {mainText}
              </p>
              <p className={`text-sm font-medium mt-0.5 ${mainTextColor}`}>
                {savingsRate >= 0 && hasIncome ? `${savingsRate.toFixed(1)}% savings rate` : subText}
              </p>
            </div>
          </div>
          {hasIncome && (
            <div className="h-2 bg-[#403027] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isPositive ? 'bg-[#93B889]' : 'bg-[#D8755D]'}`}
                style={{ width: `${Math.min(Math.abs(savingsRate), 100)}%` }}
              />
            </div>
          )}
          <p className="text-[#B8A99A] text-xs">{footerText}</p>
        </div>

        {/* Quick Checks */}
        <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847] space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D8755D]/10 flex items-center justify-center">
              <Receipt size={14} className="text-[#D8755D]" />
            </div>
            <div className="flex-1">
              <p className="text-[#B8A99A] text-xs">Largest Expense</p>
              <p className="text-[#F4EDE3] text-sm font-medium">
                {largestExpense
                  ? `$${largestExpense.amount.toFixed(2)} — ${largestExpense.title || 'Untitled'}`
                  : 'No expenses'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D49A4A]/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D49A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[#B8A99A] text-xs">Most Used Category</p>
              <p className="text-[#F4EDE3] text-sm font-medium">
                {mostUsedCategory ? `${mostUsedCategory.name} (${mostUsedCategory.count}x)` : 'No expenses'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#B8A99A]/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8A99A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[#B8A99A] text-xs">Uncategorized</p>
              <p className="text-[#F4EDE3] text-sm font-medium">
                {uncategorizedCount > 0 ? `${uncategorizedCount} transactions` : 'None'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
