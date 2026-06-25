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
  totalBudget?: number
  totalSpend?: number
  budgetProgress?: number | null
  budgetRemaining?: number | null
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
  const statusColor = item.status === 'overBudget' ? '#D8755D'
    : item.status === 'warning' ? '#D49A4A'
    : item.status === 'safe' ? '#93B889'
    : '#9B8778'

  const statusLabel = item.status === 'overBudget' ? 'Over budget'
    : item.status === 'warning' ? 'Near limit'
    : item.status === 'safe' ? 'On track'
    : 'No budget set'

  const remaining = item.budget !== null ? item.budget - item.spent : null
  const spentPct = item.utilizationPercent !== null ? Math.round(item.utilizationPercent) : null

  const bgTint = item.status === 'overBudget' ? 'bg-[#D8755D]/5'
    : item.status === 'warning' ? 'bg-[#D49A4A]/5'
    : 'bg-[#35281F]'

  return (
    <div
      onClick={onClick}
      className={`${bgTint} rounded-2xl p-4 border border-[#6B5847] flex flex-col gap-2.5 ${
        onClick ? 'cursor-pointer hover:border-[#D49A4A] transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0" style={{ backgroundColor: `${statusColor}18` }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[#F4EDE3] text-sm font-semibold truncate">{item.name}</p>
          <p className="text-[#B8A99A] text-[10px]">
            {item.budget !== null ? `Budget $${item.budget.toFixed(0)}` : 'No limit set'}
          </p>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0`} style={{ backgroundColor: `${statusColor}18`, color: statusColor }}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#6B5847" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={statusColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 15.5 * progress} ${2 * Math.PI * 15.5 * (1 - progress)}`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: statusColor }}>
            {spentPct !== null ? `${spentPct}%` : '—'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[#F4EDE3] text-sm font-bold">${item.spent.toFixed(0)}</span>
            {item.budget !== null && (
              <span className="text-[#B8A99A] text-[10px]">of ${item.budget.toFixed(0)}</span>
            )}
          </div>
          <div className="mt-1 w-full h-1.5 bg-[#6B5847] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(progress * 100, 100)}%`, backgroundColor: statusColor }}
            />
          </div>
          {remaining !== null && (
            <p className={`text-[10px] mt-0.5 font-medium ${remaining >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
              {remaining >= 0 ? `${remaining.toFixed(0)} remaining` : `${Math.abs(remaining).toFixed(0)} over`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MonthlyBudgetGrid({ items, summary, onCategoryClick, totalBudget, totalSpend, budgetProgress, budgetRemaining }: MonthlyBudgetGridProps) {
  const summaryParts: string[] = []
  if (summary.overBudgetCount > 0) summaryParts.push(`${summary.overBudgetCount} over budget`)
  if (summary.warningCount > 0) summaryParts.push(`${summary.warningCount} near limit`)
  if (summary.onTrackCount > 0) summaryParts.push(`${summary.onTrackCount} on track`)
  const summaryText = summaryParts.join(' · ')

  const healthColor = budgetProgress != null
    ? (budgetProgress > 100 ? '#D8755D' : budgetProgress >= 80 ? '#D49A4A' : '#93B889')
    : '#9B8778'

  if (items.length === 0) {
    return (
      <section>
        <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
          Monthly Budget
        </h3>
        <div className="bg-[#35281F] rounded-2xl p-6 border border-[#6B5847] text-center">
          <p className="text-[#B8A99A] text-sm">No budget categories found</p>
          <p className="text-[#B8A99A] text-xs mt-1">Add budget limits as a number column in your Notion category database</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider">
          Monthly Budget
        </h3>
        {summaryText && (
          <span className="text-[#B8A99A] text-[10px]">{summaryText}</span>
        )}
      </div>

      {/* Budget Health Summary */}
      {totalBudget !== undefined && totalBudget > 0 && (
        <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847] mb-4">
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="text-center">
              <p className="text-[#B8A99A] text-[10px]">Total Budget</p>
              <p className="text-[#F4EDE3] text-sm font-bold">${totalBudget.toFixed(0)}</p>
            </div>
            <div className="text-center">
              <p className="text-[#B8A99A] text-[10px]">Spent</p>
              <p className="text-[#D8755D] text-sm font-bold">${(totalSpend ?? 0).toFixed(0)}</p>
            </div>
            <div className="text-center">
              <p className="text-[#B8A99A] text-[10px]">Remaining</p>
              <p className={`text-sm font-bold ${(budgetRemaining ?? 0) >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
                ${(budgetRemaining ?? 0) >= 0 ? `${(budgetRemaining ?? 0).toFixed(0)}` : `${Math.abs(budgetRemaining ?? 0).toFixed(0)} over`}
              </p>
            </div>
          </div>
          <div className="w-full h-2 bg-[#6B5847] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((budgetProgress ?? 0), 100)}%`,
                backgroundColor: healthColor,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[#B8A99A] text-[10px]">0%</span>
            <span className="text-[#B8A99A] text-[10px]">{(budgetProgress != null ? Math.round(budgetProgress) : 0)}% used</span>
            <span className="text-[#B8A99A] text-[10px]">100%</span>
          </div>
        </div>
      )}

      {/* Budget Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
