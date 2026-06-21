'use client'

import { Receipt, TrendingUp } from 'lucide-react'

interface ActivityItem {
  id: string
  title: string
  amount: number
  category: string | null
  date: string
  databaseRole: 'expense' | 'income'
}

interface CategoryItem {
  name: string
  spent?: number
  total?: number
  count: number
}

interface ActivityAndCategoriesGridProps {
  recentTransactions: ActivityItem[]
  expenseCategories: CategoryItem[]
  incomeCategories: CategoryItem[]
  totalSpend: number
  totalIncome: number
}

export default function ActivityAndCategoriesGrid({
  recentTransactions,
  expenseCategories,
  incomeCategories,
  totalSpend,
  totalIncome,
}: ActivityAndCategoriesGridProps) {
  return (
    <section>
      <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
        Recent Activity
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div>
          {recentTransactions.length > 0 ? (
            <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036] space-y-0.5">
              {recentTransactions.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.databaseRole === 'expense' ? 'bg-[#C7745A]' : 'bg-[#8CA37D]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F4E9DA] text-sm truncate">{t.title}</p>
                    <p className="text-[#9B8778] text-xs">
                      {t.category || 'Uncategorized'} · {new Date(t.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    </p>
                  </div>
                  <span className={`text-sm font-medium flex-shrink-0 ${t.databaseRole === 'expense' ? 'text-[#C7745A]' : 'text-[#8CA37D]'}`}>
                    {t.databaseRole === 'expense' ? '-' : '+'}${t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036]">
              <p className="text-[#9B8778] text-xs">No recent transactions</p>
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          {(expenseCategories.length > 0 || incomeCategories.length > 0) ? (
            <div className="space-y-3">
              {expenseCategories.length > 0 && (
                <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036]">
                  <h4 className="text-[#C7745A] text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <Receipt size={12} />
                    Expenses
                  </h4>
                  <div className="space-y-2">
                    {expenseCategories.map(cat => {
                      const pct = totalSpend > 0 ? (cat.spent! / totalSpend) * 100 : 0
                      return (
                        <div key={cat.name}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-[#CBB9A7]">{cat.name}</span>
                            <span className="text-[#C7745A]">
                              ${cat.spent!.toFixed(2)} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#40342B] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#C7745A] rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {incomeCategories.length > 0 && (
                <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036]">
                  <h4 className="text-[#8CA37D] text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <TrendingUp size={12} />
                    Income
                  </h4>
                  <div className="space-y-2">
                    {incomeCategories.map(cat => {
                      const pct = totalIncome > 0 ? (cat.total! / totalIncome) * 100 : 0
                      return (
                        <div key={cat.name}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-[#CBB9A7]">{cat.name}</span>
                            <span className="text-[#8CA37D]">
                              ${cat.total!.toFixed(2)} ({pct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#40342B] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#8CA37D] rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036]">
              <p className="text-[#9B8778] text-xs">No category data</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
