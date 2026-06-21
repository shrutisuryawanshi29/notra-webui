'use client'

import { Receipt, TrendingUp } from 'lucide-react'
import OverviewCard from './OverviewCard'

interface OverviewGridProps {
  totalSpend: number
  totalIncome: number
  netBalance: number
  expenseCount: number
  incomeCount: number
}

export default function OverviewGrid({
  totalSpend,
  totalIncome,
  netBalance,
  expenseCount,
  incomeCount,
}: OverviewGridProps) {
  return (
    <section>
      <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
        Overview
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <OverviewCard
          icon={<Receipt size={20} className="text-[#C7745A]" />}
          label="Total Spent"
          amount={`-$${totalSpend.toFixed(2)}`}
          subtitle={`${expenseCount} transactions`}
          color="text-[#C7745A]"
          bgClass="bg-[#C7745A]/10"
        />
        <OverviewCard
          icon={<TrendingUp size={20} className="text-[#8CA37D]" />}
          label="Total Income"
          amount={`+$${totalIncome.toFixed(2)}`}
          subtitle={`${incomeCount} transactions`}
          color="text-[#8CA37D]"
          bgClass="bg-[#8CA37D]/10"
        />
        <OverviewCard
          icon={
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
              netBalance >= 0 ? 'border-[#8CA37D] text-[#8CA37D]' : 'border-[#C7745A] text-[#C7745A]'
            }`}>
              $
            </div>
          }
          label="Net Balance"
          amount={`${netBalance >= 0 ? '+' : '-'}$${Math.abs(netBalance).toFixed(2)}`}
          subtitle={netBalance >= 0 ? 'Positive' : 'Negative'}
          color={netBalance >= 0 ? 'text-[#8CA37D]' : 'text-[#C7745A]'}
          bgClass={netBalance >= 0 ? 'bg-[#8CA37D]/10' : 'bg-[#C7745A]/10'}
        />
      </div>
    </section>
  )
}
