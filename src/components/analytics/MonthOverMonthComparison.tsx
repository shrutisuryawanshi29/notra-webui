'use client'

import { TrendingDown, TrendingUp, PiggyBank } from 'lucide-react'
import Card from '@/components/Card'
import { MoMComparison } from '@/lib/analytics'

interface MonthOverMonthComparisonProps {
  comparison: MoMComparison | null
}

function ChangeDisplay({ label, change, icon, iconBg }: { label: string; change: number | null; icon: React.ReactNode; iconBg: string }) {
  let color = '#D49A4A'
  let prefix = ''
  let display = 'N/A'

  if (change !== null) {
    if (change > 0) {
      color = '#D8755D'
      prefix = '+'
    } else if (change < 0) {
      color = '#93B889'
      prefix = ''
    } else {
      color = '#D49A4A'
      prefix = ''
    }
    display = `${prefix}${change.toFixed(1)}%`
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <span className="text-[#B8A99A] text-xs">{label}</span>
      <span className="text-sm font-semibold tracking-tight" style={{ color }}>{display}</span>
    </div>
  )
}

export default function MonthOverMonthComparison({ comparison }: MonthOverMonthComparisonProps) {
  if (!comparison) return null

  if (!comparison.hasPreviousData) {
    return (
      <Card>
        <p className="text-[#B8A99A] text-sm">No previous month data available for comparison.</p>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold mb-4">Compared to {comparison.previousLabel}</h3>
      <div className="grid grid-cols-3 gap-4">
        <ChangeDisplay
          label="Expenses"
          change={comparison.expenseChange}
          icon={<TrendingDown size={18} className="text-[#D8755D]" />}
          iconBg="bg-[#D8755D]/10"
        />
        <ChangeDisplay
          label="Income"
          change={comparison.incomeChange}
          icon={<TrendingUp size={18} className="text-[#93B889]" />}
          iconBg="bg-[#93B889]/10"
        />
        <ChangeDisplay
          label="Savings"
          change={comparison.savingsChange}
          icon={<PiggyBank size={18} className="text-[#D49A4A]" />}
          iconBg="bg-[#D49A4A]/10"
        />
      </div>
    </Card>
  )
}

MonthOverMonthComparison.displayName = 'MonthOverMonthComparison'
