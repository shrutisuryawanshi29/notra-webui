'use client'

import { Receipt } from 'lucide-react'

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
  totalSpend: number
}

export default function ActivityAndCategoriesGrid({
  recentTransactions,
  expenseCategories,
  totalSpend,
}: ActivityAndCategoriesGridProps) {
  return (
    <section>
      <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
        Recent Activity
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div>
          {recentTransactions.length > 0 ? (
            <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847] space-y-0.5">
              {recentTransactions.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.databaseRole === 'expense' ? 'bg-[#D8755D]' : 'bg-[#93B889]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F4EDE3] text-sm truncate">{t.title}</p>
                    <p className="text-[#B8A99A] text-xs">
                      {t.category || 'Uncategorized'} · {new Date(t.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    </p>
                  </div>
                  <span className={`text-sm font-medium flex-shrink-0 ${t.databaseRole === 'expense' ? 'text-[#D8755D]' : 'text-[#93B889]'}`}>
                    {t.databaseRole === 'expense' ? '-' : '+'}${t.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847]">
              <p className="text-[#B8A99A] text-xs">No recent transactions</p>
            </div>
          )}
        </div>

        {/* Expense Categories */}
        <div>
          {expenseCategories.length > 0 ? (
            <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847]">
              <h4 className="text-[#D8755D] text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Receipt size={12} />
                Expenses
              </h4>
              <div className="space-y-2">
                {expenseCategories.map(cat => {
                  const pct = totalSpend > 0 ? (cat.spent! / totalSpend) * 100 : 0
                  return (
                    <div key={cat.name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-[#B8A99A]">{cat.name}</span>
                        <span className="text-[#D8755D]">
                          ${cat.spent!.toFixed(2)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#403027] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#D8755D] rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847]">
              <p className="text-[#B8A99A] text-xs">No expense category data</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
