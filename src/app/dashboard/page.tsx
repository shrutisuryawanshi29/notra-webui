'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import LoadingSpinner from '@/components/LoadingSpinner'
import IconButton from '@/components/dashboard/IconButton'
import MonthSelectorPill, { MonthOption } from '@/components/dashboard/MonthSelectorPill'
import OverviewCard from '@/components/dashboard/OverviewCard'
import ExploreCard from '@/components/dashboard/ExploreCard'
import FloatingActionButton from '@/components/dashboard/FloatingActionButton'
import {
  Settings,
  RefreshCw,
  Receipt,
  TrendingUp,
  BarChart3,
  Users,
} from 'lucide-react'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(value: string): string {
  const [y, m] = value.split('-')
  return `${MONTH_LABELS[parseInt(m) - 1]} ${y}`
}

export default function DashboardPage() {
  const router = useRouter()
  const { state, loadData } = useCache()
  const { expenses, incomes, loading } = state
  const syncedTime = (() => {
    const n = new Date()
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
  })()

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const availableMonths = useMemo(() => {
    const set = new Set<string>()
    for (const e of expenses) set.add(getMonthKey(e.date))
    for (const i of incomes) set.add(getMonthKey(i.date))
    if (set.size === 0) set.add(currentMonth)
    const keys = Array.from(set).sort()
    return keys.map(k => ({ label: getMonthLabel(k), value: k } as MonthOption))
  }, [expenses, incomes, currentMonth])

  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const activeMonth = selectedMonth || (availableMonths.length > 0 ? availableMonths[availableMonths.length - 1].value : currentMonth)

  const filteredExpenses = useMemo(
    () => expenses.filter(e => getMonthKey(e.date) === activeMonth),
    [expenses, activeMonth]
  )

  const filteredIncomes = useMemo(
    () => incomes.filter(i => getMonthKey(i.date) === activeMonth),
    [incomes, activeMonth]
  )

  const totalSpend = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalIncome = filteredIncomes.reduce((sum, e) => sum + e.amount, 0)
  const netBalance = totalIncome - totalSpend
  const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100) : 0

  const largestExpense = useMemo(() => {
    if (filteredExpenses.length === 0) return null
    return filteredExpenses.reduce((max, e) => e.amount > max.amount ? e : max, filteredExpenses[0])
  }, [filteredExpenses])

  const mostUsedCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of filteredExpenses) {
      const cat = e.category || 'Uncategorized'
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    let maxCat: string | null = null
    let maxCount = 0
    for (const [cat, count] of counts) {
      if (count > maxCount) { maxCat = cat; maxCount = count }
    }
    return maxCat ? { name: maxCat, count: maxCount } : null
  }, [filteredExpenses])

  const uncategorizedCount = useMemo(
    () => filteredExpenses.filter(e => !e.category).length,
    [filteredExpenses]
  )

  const recentTransactions = useMemo(
    () => [...filteredExpenses, ...filteredIncomes]
      .filter(t => t.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [filteredExpenses, filteredIncomes]
  )

  const expenseCategories = useMemo(() => {
    const map = new Map<string, { spent: number; count: number }>()
    for (const e of filteredExpenses) {
      const cat = e.category || 'Uncategorized'
      const existing = map.get(cat) || { spent: 0, count: 0 }
      existing.spent += e.amount
      existing.count += 1
      map.set(cat, existing)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5)
  }, [filteredExpenses])

  const incomeCategories = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const i of filteredIncomes) {
      const cat = i.category || 'Uncategorized'
      const existing = map.get(cat) || { total: 0, count: 0 }
      existing.total += i.amount
      existing.count += 1
      map.set(cat, existing)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filteredIncomes])

  if (loading && expenses.length === 0 && incomes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#2B241E]">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
        <div className="flex items-center justify-between mb-2">
          <IconButton onClick={() => router.push('/settings')}>
            <Settings size={18} />
          </IconButton>
          <h1 className="text-[#EDE1D1] text-lg font-semibold">Dashboard</h1>
          <IconButton onClick={loadData}>
            <RefreshCw size={18} />
          </IconButton>
        </div>

        <div className="mt-8 mb-2">
          <h2 className="text-[#EDE1D1] text-3xl font-bold">Your Finances</h2>
          <p className="text-[#9B8778] text-xs mt-1">
            Last synced at {syncedTime || '...'}
          </p>
        </div>

        <div className="mt-4 mb-8">
          <MonthSelectorPill
            months={availableMonths}
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>

        <div className="mb-8">
          <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
            Overview
          </h3>
          <div className="space-y-3">
            <OverviewCard
              icon={<Receipt size={20} className="text-[#C7745A]" />}
              label="Total Spent"
              amount={`-$${totalSpend.toFixed(2)}`}
              subtitle={`${filteredExpenses.length} transactions`}
              color="text-[#C7745A]"
              bgClass="bg-[#C7745A]/10"
            />
            <OverviewCard
              icon={<TrendingUp size={20} className="text-[#8CA37D]" />}
              label="Total Income"
              amount={`+$${totalIncome.toFixed(2)}`}
              subtitle={`${filteredIncomes.length} transactions`}
              color="text-[#8CA37D]"
              bgClass="bg-[#8CA37D]/10"
            />
            <OverviewCard
              icon={
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  netBalance >= 0 ? 'border-[#8CA37D] text-[#8CA37D]' : 'border-[#C7745A] text-[#C7745A]'
                }`}>
                  $
                </div>
              }
              label="Net Balance"
              amount={`${netBalance >= 0 ? '+' : '-'}$${Math.abs(netBalance).toFixed(2)}`}
              subtitle={netBalance >= 0 ? 'Positive' : 'Negative'}
              color={netBalance >= 0 ? 'text-[#8CA37D]' : 'text-[#C7745A]'}
              bgClass={netBalance >= 0 ? 'bg-[#8CA37D]/10' : 'bg-[#C7745A]/10'}
            />
          </div>
        </div>

        {/* This Month Status */}
        <div className="mb-8">
          <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
            This Month Status
          </h3>
          <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036] space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[#CBB9A7] text-xs">Savings Rate</span>
              <span className={`text-sm font-bold ${savingsRate >= 0 ? 'text-[#8CA37D]' : 'text-[#C7745A]'}`}>
                {savingsRate.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-[#40342B] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${savingsRate >= 0 ? 'bg-[#8CA37D]' : 'bg-[#C7745A]'}`}
                style={{ width: `${Math.min(Math.abs(savingsRate), 100)}%` }}
              />
            </div>
            <p className="text-[#9B8778] text-xs">
              {netBalance >= 0
                ? `You saved $${netBalance.toFixed(2)} this month`
                : `You overspent by $${Math.abs(netBalance).toFixed(2)} this month`
              }
            </p>
          </div>
        </div>

        {/* Quick Checks */}
        <div className="mb-8">
          <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
            Quick Checks
          </h3>
          <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C7745A]/10 flex items-center justify-center">
                <Receipt size={14} className="text-[#C7745A]" />
              </div>
              <div className="flex-1">
                <p className="text-[#CBB9A7] text-xs">Largest Expense</p>
                <p className="text-[#F4E9DA] text-sm font-medium">
                  {largestExpense
                    ? `$${largestExpense.amount.toFixed(2)} — ${largestExpense.title || 'Untitled'}`
                    : 'No expenses'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C99152]/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C99152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[#CBB9A7] text-xs">Most Used Category</p>
                <p className="text-[#F4E9DA] text-sm font-medium">
                  {mostUsedCategory ? `${mostUsedCategory.name} (${mostUsedCategory.count}x)` : 'No expenses'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#9B8778]/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B8778" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[#CBB9A7] text-xs">Uncategorized</p>
                <p className="text-[#F4E9DA] text-sm font-medium">
                  {uncategorizedCount > 0 ? `${uncategorizedCount} transactions` : 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {recentTransactions.length > 0 && (
          <div className="mb-8">
            <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
              Recent Activity
            </h3>
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
          </div>
        )}

        {(expenseCategories.length > 0 || incomeCategories.length > 0) && (
          <div className="mb-8">
            <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
              Categories
            </h3>
            <div className="space-y-3">
              {expenseCategories.length > 0 && (
                <div className="bg-[#362D25] rounded-2xl p-4 border border-[#4C4036]">
                  <h4 className="text-[#C7745A] text-xs font-semibold mb-3 flex items-center gap-1.5">
                    <Receipt size={12} />
                    Expenses
                  </h4>
                  <div className="space-y-2">
                    {expenseCategories.map(cat => {
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
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
            Explore
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <ExploreCard
              icon={<Receipt size={22} className="text-[#C7745A]" />}
              title="Expenses"
              subtitle="View spending"
              iconBgClass="bg-[#C7745A]/10"
              onClick={() => router.push('/expenses')}
            />
            <ExploreCard
              icon={<TrendingUp size={22} className="text-[#8CA37D]" />}
              title="Income"
              subtitle="View earnings"
              iconBgClass="bg-[#8CA37D]/10"
              onClick={() => router.push('/income')}
            />
            <ExploreCard
              icon={<BarChart3 size={22} className="text-[#C99152]" />}
              title="Analytics"
              subtitle="See insights"
              iconBgClass="bg-[#C99152]/10"
              onClick={() => router.push('/analytics')}
            />
            <ExploreCard
              icon={<Users size={22} className="text-[#C49A5A]" />}
              title="Split Tracker"
              subtitle="View settlements"
              iconBgClass="bg-[#C49A5A]/10"
              onClick={() => router.push('/split-tracker')}
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-24 md:bottom-8 right-6 z-50">
        <FloatingActionButton onClick={() => router.push('/add')} />
      </div>
    </div>
  )
}
