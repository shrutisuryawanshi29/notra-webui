'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { NormalizedTransaction } from '@/types/transaction'
import Card from '@/components/Card'
import LoadingSpinner from '@/components/LoadingSpinner'

interface CategorySummary {
  name: string
  spent: number
  count: number
}

interface MonthlySummary {
  month: string
  spend: number
  income: number
  net: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { state } = useCache()

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const categoryData = useMemo(() => {
    const map = new Map<string, { spent: number; count: number }>()
    for (const e of state.expenses) {
      const cat = e.category || 'Uncategorized'
      const existing = map.get(cat) || { spent: 0, count: 0 }
      existing.spent += e.amount
      existing.count += 1
      map.set(cat, existing)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spent - a.spent)
  }, [state.expenses])

  const incomeCategoryData = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const i of state.incomes) {
      const cat = i.category || 'Uncategorized'
      const existing = map.get(cat) || { total: 0, count: 0 }
      existing.total += i.amount
      existing.count += 1
      map.set(cat, existing)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [state.incomes])

  const monthlyData = useMemo(() => {
    const map = new Map<string, { spend: number; income: number }>()

    const getMonthKey = (dateStr: string) => {
      const d = new Date(dateStr + 'T12:00:00Z')
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    for (const e of state.expenses) {
      const key = getMonthKey(e.date)
      const existing = map.get(key) || { spend: 0, income: 0 }
      existing.spend += e.amount
      map.set(key, existing)
    }
    for (const i of state.incomes) {
      const key = getMonthKey(i.date)
      const existing = map.get(key) || { spend: 0, income: 0 }
      existing.income += i.amount
      map.set(key, existing)
    }

    return Array.from(map.entries())
      .map(([month, data]) => ({
        month,
        ...data,
        net: data.income - data.spend,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [state.expenses, state.incomes])

  const totalSpend = state.expenses.reduce((s, e) => s + e.amount, 0)
  const totalIncome = state.incomes.reduce((s, e) => s + e.amount, 0)
  const totalExpenseCount = state.expenses.length
  const totalIncomeCount = state.incomes.length

  if (state.loading && state.expenses.length === 0 && state.incomes.length === 0) {
    return (
      <div className="p-5 max-w-5xl mx-auto">
        <h1 className="text-[#EDE1D1] text-2xl font-bold mb-6">Analytics</h1>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <h1 className="text-[#EDE1D1] text-2xl font-bold mb-6">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-[#CBB9A7] text-xs">Total Spend</p>
          <p className="text-[#C7745A] text-xl font-bold mt-1">
            ${totalSpend.toFixed(2)}
          </p>
          <p className="text-[#9B8778] text-xs">{totalExpenseCount} txns</p>
        </Card>
        <Card>
          <p className="text-[#CBB9A7] text-xs">Total Income</p>
          <p className="text-[#8CA37D] text-xl font-bold mt-1">
            ${totalIncome.toFixed(2)}
          </p>
          <p className="text-[#9B8778] text-xs">{totalIncomeCount} txns</p>
        </Card>
        <Card>
          <p className="text-[#CBB9A7] text-xs">Net Balance</p>
          <p className={`text-xl font-bold mt-1 ${totalIncome - totalSpend >= 0 ? 'text-[#8CA37D]' : 'text-[#C7745A]'}`}>
            ${(totalIncome - totalSpend).toFixed(2)}
          </p>
        </Card>
        <Card>
          <p className="text-[#CBB9A7] text-xs">Avg Expense</p>
          <p className="text-[#F4E9DA] text-xl font-bold mt-1">
            ${totalExpenseCount > 0 ? (totalSpend / totalExpenseCount).toFixed(2) : '0.00'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-[#F4E9DA] text-sm font-semibold mb-3">
            Expenses by Category
          </h2>
          {categoryData.length === 0 ? (
            <p className="text-[#9B8778] text-xs">No expense data</p>
          ) : (
            <div className="space-y-2">
              {categoryData.slice(0, 8).map((cat) => {
                const pct = totalSpend > 0 ? (cat.spent / totalSpend) * 100 : 0
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-[#CBB9A7]">{cat.name}</span>
                      <span className="text-[#C7745A]">
                        ${cat.spent.toFixed(2)} ({pct.toFixed(0)}%)
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
          )}
        </Card>

        <Card>
          <h2 className="text-[#F4E9DA] text-sm font-semibold mb-3">
            Income by Category
          </h2>
          {incomeCategoryData.length === 0 ? (
            <p className="text-[#9B8778] text-xs">No income data</p>
          ) : (
            <div className="space-y-2">
              {incomeCategoryData.slice(0, 8).map((cat) => {
                const pct = totalIncome > 0 ? (cat.total / totalIncome) * 100 : 0
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-[#CBB9A7]">{cat.name}</span>
                      <span className="text-[#8CA37D]">
                        ${cat.total.toFixed(2)} ({pct.toFixed(0)}%)
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
          )}
        </Card>
      </div>

      <Card>
        <h2 className="text-[#F4E9DA] text-sm font-semibold mb-3">
          Monthly Summary
        </h2>
        {monthlyData.length === 0 ? (
          <p className="text-[#9B8778] text-xs">No data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#9B8778] border-b border-[#4C4036]">
                  <th className="text-left py-2 pr-3">Month</th>
                  <th className="text-right py-2 px-3">Spend</th>
                  <th className="text-right py-2 px-3">Income</th>
                  <th className="text-right py-2 pl-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m) => {
                  const [y, mo] = m.month.split('-')
                  const date = new Date(parseInt(y), parseInt(mo) - 1)
                  const label = date.toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })
                  return (
                    <tr key={m.month} className="border-b border-[#4C4036]/50">
                      <td className="py-2 pr-3 text-[#CBB9A7]">{label}</td>
                      <td className="py-2 px-3 text-right text-[#C7745A]">
                        ${m.spend.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-[#8CA37D]">
                        ${m.income.toFixed(2)}
                      </td>
                      <td className={`py-2 pl-3 text-right font-medium ${m.net >= 0 ? 'text-[#8CA37D]' : 'text-[#C7745A]'}`}>
                        ${m.net.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
