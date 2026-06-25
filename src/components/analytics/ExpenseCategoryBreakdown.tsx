'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import Card from '@/components/Card'
import EmptyState from './EmptyState'
import { CategorySummary, formatCurrency } from '@/lib/analytics'

interface ExpenseCategoryBreakdownProps {
  categories: CategorySummary[]
  onCategoryClick?: (name: string) => void
}

interface TooltipPayloadEntry {
  name: string
  value: number
  payload: { percentage: number }
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
}

const COLORS = ['#D8755D', '#D49A4A', '#93B889', '#D49A4A', '#6B5847', '#B8A99A', '#C96F5A', '#7DA67A']

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg shadow-lg p-3 text-xs" style={{ backgroundColor: '#35281F', border: '1px solid #6B5847', color: '#F4EDE3' }}>
      <p className="font-medium mb-1">{p.name}</p>
      <p style={{ color: '#D8755D' }}>{formatCurrency(p.value)}</p>
      <p style={{ color: '#B8A99A' }}>{p.payload.percentage.toFixed(1)}%</p>
    </div>
  )
}

export default function ExpenseCategoryBreakdown({ categories, onCategoryClick }: ExpenseCategoryBreakdownProps) {
  if (categories.length === 0) {
    return <EmptyState title="No expense data for this period" />
  }

  const topCategories = categories.slice(0, 8)
  const totalExpenses = categories.reduce((s, c) => s + c.spent, 0)

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-0.5">Where is my money going?</h3>
      <p className="text-[#B8A99A] text-xs mb-4">Expense Category Breakdown</p>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-shrink-0 flex items-center justify-center">
          <ResponsiveContainer width={250} height={250}>
            <PieChart>
              <Pie
                data={topCategories}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="spent"
                nameKey="name"
                label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={true}
              >
                {topCategories.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2.5">
          {categories.map((cat, index) => (
            <button
              key={cat.name}
              onClick={() => onCategoryClick?.(cat.name)}
              className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#403027] transition-colors text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-[#F4EDE3] text-sm truncate">{cat.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[#D8755D] text-xs font-medium tracking-tight">{formatCurrency(cat.spent)}</span>
                <span className="text-[#B8A99A] text-xs">({cat.percentage.toFixed(1)}%)</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
