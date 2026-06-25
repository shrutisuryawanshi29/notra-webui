'use client'

import Card from '@/components/Card'
import EmptyState from './EmptyState'
import { CategorySummary, formatCurrency, formatPercent } from '@/lib/analytics'

const CATEGORY_COLORS = ['#D8755D', '#D49A4A', '#D49A4A', '#93B889', '#B8A99A']

interface TopSpendingCategoriesProps {
  categories: CategorySummary[]
  totalExpenses: number
}

export default function TopSpendingCategories({ categories, totalExpenses }: TopSpendingCategoriesProps) {
  if (categories.length === 0) {
    return (
      <Card>
        <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-1">Top Spending Categories</h3>
        <EmptyState title="No expense data" />
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-4">Top Spending Categories</h3>
      <div className="space-y-4">
        {categories.map((cat, index) => (
          <div key={cat.name}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[#B8A99A] text-xs font-bold w-5 shrink-0">{index + 1}</span>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
              <span className="text-[#F4EDE3] text-sm flex-1 truncate" title={cat.name}>{cat.name}</span>
              <span className="text-[#D8755D] text-sm font-medium tracking-tight shrink-0">{formatCurrency(cat.spent)}</span>
              <span className="text-[#B8A99A] text-xs shrink-0 w-12 text-right">{formatPercent(cat.percentage)}</span>
            </div>
            <div className="ml-7 w-full md:w-3/4 h-1.5 bg-[#6B5847] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${cat.percentage}%`, backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
