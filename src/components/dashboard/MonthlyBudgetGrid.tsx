'use client'

interface BudgetCategoryItem {
  name: string
  spent: number
  budget: number | null
  utilizationPercent: number | null
  status: 'overBudget' | 'warning' | 'safe' | 'noBudget'
  categoryId: string | null
}

interface BudgetUtilizationSummary {
  overBudgetCount: number
  warningCount: number
  onTrackCount: number
  noBudgetCount: number
}

interface MonthlyBudgetGridProps {
  items: BudgetCategoryItem[]
  summary: BudgetUtilizationSummary
  onCategoryClick?: (item: BudgetCategoryItem) => void
}

function IconForCategory(name: string): { icon: string; color: string } {
  const lower = name.toLowerCase()
  if (/grocery|food|groceries/.test(lower)) return { icon: '🛒', color: '' }
  if (/restaurant|dining|eat|takeout/.test(lower)) return { icon: '🍽️', color: '' }
  if (/transport|car|gas|fuel|uber|lyft|travel/.test(lower)) return { icon: '🚗', color: '' }
  if (/rent|home|house|mortgage/.test(lower)) return { icon: '🏠', color: '' }
  if (/shopping|retail|clothing/.test(lower)) return { icon: '🛍️', color: '' }
  if (/subscription|membership/.test(lower)) return { icon: '🔄', color: '' }
  if (/entertainment|movie|game|ticket/.test(lower)) return { icon: '🎬', color: '' }
  if (/vacation|hotel|flight|airplane/.test(lower)) return { icon: '✈️', color: '' }
  if (/health|medical|doctor|insurance|pharmacy/.test(lower)) return { icon: '❤️', color: '' }
  if (/utility|electric|water|internet|phone|bill/.test(lower)) return { icon: '⚡', color: '' }
  if (/education|school|course|class|tuition/.test(lower)) return { icon: '📚', color: '' }
  if (/gift|donation|charity|present/.test(lower)) return { icon: '🎁', color: '' }
  if (/pet|veterinary|animal/.test(lower)) return { icon: '🐾', color: '' }
  if (/miscellaneous|other|general|uncategorized|misc/.test(lower)) return { icon: '🔖', color: '' }
  return { icon: '🏷️', color: '' }
}

function BudgetCategoryCard({ item, onClick }: { item: BudgetCategoryItem; onClick?: () => void }) {
  const { icon } = IconForCategory(item.name)
  const progress = item.utilizationPercent !== null ? Math.min(item.utilizationPercent / 100, 1) : 0
  const statusColor = item.status === 'overBudget' ? '#C7745A'
    : item.status === 'warning' ? '#C49A5A'
    : item.status === 'safe' ? '#8CA37D'
    : '#9B8778'
  const statusLabel = item.status === 'overBudget' ? 'Over budget'
    : item.status === 'warning' ? ''
    : item.status === 'safe' ? 'On track'
    : 'No budget set'

  return (
    <div
      onClick={onClick}
      className={`bg-[#362D25] rounded-2xl p-3 border border-[#4C4036] flex flex-col items-center text-center gap-1.5 ${
        onClick ? 'cursor-pointer hover:border-[#C99152] transition-colors' : ''
      }`}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: `${statusColor}15` }}>
        {icon}
      </div>
      <p className="text-[#EDE1D1] text-xs font-medium truncate w-full">{item.name}</p>
      <div className="relative w-14 h-14">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#4C4036" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15" fill="none"
            stroke={statusColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 15 * progress} ${2 * Math.PI * 15 * (1 - progress)}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: statusColor }}>
          {item.utilizationPercent !== null ? `${Math.round(item.utilizationPercent)}%` : '—'}
        </span>
      </div>
      <p className="text-[#CBB9A7] text-[10px]">
        ${item.spent.toFixed(0)}{item.budget !== null ? ` / $${item.budget.toFixed(0)}` : ''}
      </p>
      {statusLabel && (
        <p className="text-[10px] font-medium" style={{ color: statusColor }}>{statusLabel}</p>
      )}
    </div>
  )
}

export default function MonthlyBudgetGrid({ items, summary, onCategoryClick }: MonthlyBudgetGridProps) {
  const summaryParts: string[] = []
  if (summary.overBudgetCount > 0) summaryParts.push(`${summary.overBudgetCount} over budget`)
  if (summary.warningCount > 0) summaryParts.push(`${summary.warningCount} close`)
  if (summary.onTrackCount > 0) summaryParts.push(`${summary.onTrackCount} on track`)
  const summaryText = summaryParts.join(' · ')

  if (items.length === 0) {
    return (
      <section>
        <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
          Monthly Budget
        </h3>
        <div className="bg-[#362D25] rounded-2xl p-6 border border-[#4C4036] text-center">
          <p className="text-[#9B8778] text-sm">No budget categories found</p>
          <p className="text-[#9B8778] text-xs mt-1">Add budget limits as a number column in your Notion category database</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider">
          Monthly Budget
        </h3>
        {summaryText && (
          <span className="text-[#9B8778] text-[10px]">{summaryText}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(item => (
          <BudgetCategoryCard
            key={item.categoryId || item.name}
            item={item}
            onClick={onCategoryClick ? () => onCategoryClick(item) : undefined}
          />
        ))}
      </div>
    </section>
  )
}

export type { BudgetCategoryItem, BudgetUtilizationSummary }
