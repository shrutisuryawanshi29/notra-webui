'use client'

import { TrendingUp, Receipt, DollarSign, PieChart, List, Calendar } from 'lucide-react'
import Card from '@/components/Card'
import { AnalyticsScope, formatCurrency, formatCurrencySigned, formatPercent, getScopeLabel } from '@/lib/analytics'

interface SummaryCardsProps {
  totalIncome: number
  totalExpenses: number
  netBalance: number
  savingsRate: number | null
  totalTransactions: number
  averageDailySpend: number
  scope: AnalyticsScope
}

export default function SummaryCards({
  totalIncome,
  totalExpenses,
  netBalance,
  savingsRate,
  totalTransactions,
  averageDailySpend,
  scope,
}: SummaryCardsProps) {
  const scopeLabel = getScopeLabel(scope)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card className="flex flex-col gap-1.5 p-3">
        <div className="w-8 h-8 rounded-lg bg-[#93B889]/10 flex items-center justify-center">
          <TrendingUp size={16} className="text-[#93B889]" />
        </div>
        <span className="text-[#B8A99A] text-xs">Total Income</span>
        <span className="text-lg font-bold text-[#93B889]">{formatCurrency(totalIncome)}</span>
        <span className="text-[#B8A99A] text-xs">{scopeLabel}</span>
      </Card>

      <Card className="flex flex-col gap-1.5 p-3">
        <div className="w-8 h-8 rounded-lg bg-[#D8755D]/10 flex items-center justify-center">
          <Receipt size={16} className="text-[#D8755D]" />
        </div>
        <span className="text-[#B8A99A] text-xs">Total Expenses</span>
        <span className="text-lg font-bold text-[#D8755D]">{formatCurrency(totalExpenses)}</span>
        <span className="text-[#B8A99A] text-xs">{scopeLabel}</span>
      </Card>

      <Card className="flex flex-col gap-1.5 p-3">
        <div className={`w-8 h-8 rounded-lg ${netBalance >= 0 ? 'bg-[#93B889]/10' : 'bg-[#D8755D]/10'} flex items-center justify-center`}>
          <DollarSign size={16} className={netBalance >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'} />
        </div>
        <span className="text-[#B8A99A] text-xs">Net Balance</span>
        <span className={`text-lg font-bold ${netBalance >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
          {formatCurrencySigned(netBalance)}
        </span>
        <span className="text-[#B8A99A] text-xs">{netBalance >= 0 ? 'Positive' : 'Negative'}</span>
      </Card>

      <Card className="flex flex-col gap-1.5 p-3">
        <div className="w-8 h-8 rounded-lg bg-[#D49A4A]/10 flex items-center justify-center">
          <PieChart size={16} className="text-[#D49A4A]" />
        </div>
        <span className="text-[#B8A99A] text-xs">Savings Rate</span>
        <span className="text-lg font-bold text-[#F4EDE3]">
          {savingsRate !== null ? formatPercent(savingsRate) : 'N/A'}
        </span>
        <span className="text-[#B8A99A] text-xs">of income saved</span>
      </Card>

      <Card className="flex flex-col gap-1.5 p-3">
        <div className="w-8 h-8 rounded-lg bg-[#B8A99A]/10 flex items-center justify-center">
          <List size={16} className="text-[#B8A99A]" />
        </div>
        <span className="text-[#B8A99A] text-xs">Total Transactions</span>
        <span className="text-lg font-bold text-[#F4EDE3]">{totalTransactions}</span>
        <span className="text-[#B8A99A] text-xs">transactions</span>
      </Card>

      <Card className="flex flex-col gap-1.5 p-3">
        <div className="w-8 h-8 rounded-lg bg-[#D8755D]/10 flex items-center justify-center">
          <Calendar size={16} className="text-[#D8755D]" />
        </div>
        <span className="text-[#B8A99A] text-xs">Avg Daily Spend</span>
        <span className="text-lg font-bold text-[#D8755D]">{formatCurrency(averageDailySpend)}</span>
        <span className="text-[#B8A99A] text-xs">per day</span>
      </Card>
    </div>
  )
}

SummaryCards.displayName = 'SummaryCards'
