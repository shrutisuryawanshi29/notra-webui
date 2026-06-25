'use client'

import { Receipt, TrendingUp } from 'lucide-react'
import OverviewCard from './OverviewCard'

interface OverviewGridProps {
  totalSpend: number
  totalIncome: number
  netBalance: number
  expenseCount: number
  incomeCount: number
  onExpensesClick?: () => void
  onIncomeClick?: () => void
}

export default function OverviewGrid({
  totalSpend,
  totalIncome,
  netBalance,
  expenseCount,
  incomeCount,
  onExpensesClick,
  onIncomeClick,
}: OverviewGridProps) {
  return (
    <section>
      <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
        Overview
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <OverviewCard
          icon={<Receipt size={20} className="text-[#D8755D]" />}
          label="Total Spent"
          amount={`-$${totalSpend.toFixed(2)}`}
          subtitle={`${expenseCount} transactions`}
          color="text-[#D8755D]"
          bgClass="bg-[#D8755D]/10"
          onClick={onExpensesClick}
        />
        <OverviewCard
          icon={<TrendingUp size={20} className="text-[#93B889]" />}
          label="Total Income"
          amount={`+$${totalIncome.toFixed(2)}`}
          subtitle={`${incomeCount} transactions`}
          color="text-[#93B889]"
          bgClass="bg-[#93B889]/10"
          onClick={onIncomeClick}
        />
        <OverviewCard
          icon={
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
              netBalance >= 0 ? 'border-[#93B889] text-[#93B889]' : 'border-[#D8755D] text-[#D8755D]'
            }`}>
              $
            </div>
          }
          label="Net Balance"
          amount={`${netBalance >= 0 ? '+' : '-'}$${Math.abs(netBalance).toFixed(2)}`}
          subtitle={netBalance >= 0 ? 'Positive' : 'Negative'}
          color={netBalance >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}
          bgClass={netBalance >= 0 ? 'bg-[#93B889]/10' : 'bg-[#D8755D]/10'}
        />
      </div>
    </section>
  )
}
