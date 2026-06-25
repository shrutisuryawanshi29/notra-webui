'use client'

import Card from '@/components/Card'
import EmptyState from './EmptyState'
import { CategorySummary, formatCurrency, formatPercent } from '@/lib/analytics'

interface IncomeCategoryBreakdownProps {
  categories: CategorySummary[]
  totalIncome: number
  onCategoryClick?: (name: string) => void
}

export default function IncomeCategoryBreakdown({ categories, totalIncome, onCategoryClick }: IncomeCategoryBreakdownProps) {
  if (categories.length === 0 && totalIncome === 0) {
    return (
      <Card>
        <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-1">Income Sources</h3>
        <EmptyState title="No income data for this period" />
      </Card>
    )
  }

  if (categories.length === 0) {
    return (
      <Card>
        <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-1">Income Sources</h3>
        <p className="text-[#B8A99A] text-xs py-4">Income from uncategorized sources</p>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-1">Income Sources</h3>
      <p className="text-[#B8A99A] text-xs mb-3">
        {categories.length} {categories.length === 1 ? 'source' : 'sources'} &middot; Total {formatCurrency(totalIncome)}
      </p>
      <div>
        {categories.map((cat) => (
          <div
            key={cat.name}
            onClick={() => onCategoryClick?.(cat.name)}
            className={`flex items-center justify-between py-2 ${onCategoryClick ? 'cursor-pointer hover:bg-[#403027] transition-colors' : ''}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#93B889]" />
              <span className="text-[#F4EDE3] text-sm">{cat.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#93B889] text-sm font-medium tracking-tight">{formatCurrency(cat.spent)}</span>
              <span className="text-[#B8A99A] text-xs">{formatPercent(cat.percentage)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

IncomeCategoryBreakdown.displayName = 'IncomeCategoryBreakdown'
