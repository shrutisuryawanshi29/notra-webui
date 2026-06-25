'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isSetupComplete, loadConfig, getExpenseMapping } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import LoadingSpinner from '@/components/LoadingSpinner'
import MonthlyBudgetGrid, { BudgetCategoryItem, BudgetUtilizationSummary } from '@/components/dashboard/MonthlyBudgetGrid'
import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts'
import {
  Receipt,
  TrendingUp,
  BarChart3,
  RefreshCw,
  DollarSign,
  Users,
  Plus,
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

function getMonthRange(monthKey: string): { monthFrom: string; monthTo: string } {
  const [y, m] = monthKey.split('-')
  const year = parseInt(y)
  const month = parseInt(m) - 1
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    monthFrom: `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`,
    monthTo: `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`,
  }
}

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`
}

function AtAGlanceCard({ items: facts }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847]">
      <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
        This Month at a Glance
      </h3>
      {facts.length === 0 ? (
        <p className="text-[#B8A99A] text-xs py-4 text-center">No data yet this month</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {facts.map((fact, i) => (
            <div key={i} className="bg-[#403027] rounded-xl p-3">
              <p className="text-[#B8A99A] text-[10px]">{fact.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${fact.color}`}>{fact.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { state, loadData } = useCache()
  const { expenses, incomes, loading } = state
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false)

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  useEffect(() => {
    if (expenses.length === 0 && incomes.length === 0 && !loading && !initialLoadAttempted) {
      setInitialLoadAttempted(true)
      loadData()
    }
  }, [expenses.length, incomes.length, loading, initialLoadAttempted, loadData])

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const monthKeys = useMemo(() => {
    const set = new Set<string>()
    for (const e of expenses) set.add(getMonthKey(e.date))
    for (const i of incomes) set.add(getMonthKey(i.date))
    return Array.from(set).sort()
  }, [expenses, incomes])

  const activeMonth = useMemo(() => {
    if (monthKeys.includes(currentMonthKey)) return currentMonthKey
    if (monthKeys.length > 0) return monthKeys[monthKeys.length - 1]
    return currentMonthKey
  }, [monthKeys, currentMonthKey])

  const monthRange = useMemo(() => getMonthRange(activeMonth), [activeMonth])

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
  const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100) : null
  const transactionCount = filteredExpenses.length + filteredIncomes.length

  // Daily chart data for mini cashflow
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const e of filteredExpenses) {
      const existing = map.get(e.date) || { income: 0, expense: 0 }
      existing.expense += e.amount
      map.set(e.date, existing)
    }
    for (const i of filteredIncomes) {
      const existing = map.get(i.date) || { income: 0, expense: 0 }
      existing.income += i.amount
      map.set(i.date, existing)
    }
    const daysInMonth = new Date(parseInt(activeMonth.split('-')[0]), parseInt(activeMonth.split('-')[1]), 0).getDate()
    const data: { day: number; income: number; expense: number }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${activeMonth}-${String(d).padStart(2, '0')}`
      const entry = map.get(dateStr) || { income: 0, expense: 0 }
      data.push({ day: d, income: entry.income, expense: entry.expense })
    }
    return data
  }, [filteredExpenses, filteredIncomes, activeMonth])

  // Recent transactions
  const recentTransactions = useMemo(
    () => [...filteredExpenses, ...filteredIncomes]
      .filter(t => t.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [filteredExpenses, filteredIncomes]
  )

  // Top 3 expense categories
  const topExpenseCategories = useMemo(() => {
    const map = new Map<string, { spent: number }>()
    for (const e of filteredExpenses) {
      const cat = e.category || 'Uncategorized'
      const existing = map.get(cat) || { spent: 0 }
      existing.spent += e.amount
      map.set(cat, existing)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 3)
  }, [filteredExpenses])

  // Budget computation
  const budgetItems = useMemo<BudgetCategoryItem[]>(() => {
    const config = loadConfig()
    if (!config) return []
    const expenseMapping = getExpenseMapping(config)
    const categoryType = expenseMapping?.categoryType
    const categoryColumnName = expenseMapping?.columnMapping?.categoryColumn
    const budgetLookup = state.expenseBudgetLookup
    const relationLookup = state.expenseRelationCategoryLookup

    const spendByCategory = new Map<string, { spent: number; name: string }>()

    for (const expense of filteredExpenses) {
      if (categoryType === 'relation' && categoryColumnName && expense.rawProperties) {
        const catProp = (expense.rawProperties as Record<string, unknown>)[categoryColumnName] as Record<string, unknown> | undefined
        const relationArr = (catProp?.relation as Array<{ id: string }> | undefined)
        const categoryId = relationArr?.[0]?.id
        if (categoryId) {
          const entry = spendByCategory.get(categoryId) || { spent: 0, name: '' }
          entry.spent += expense.amount
          const nameFromLookup = budgetLookup?.[categoryId]?.name || relationLookup?.[categoryId]
          entry.name = nameFromLookup || expense.category || 'Unknown'
          spendByCategory.set(categoryId, entry)
        }
      } else if (expense.category) {
        const entry = spendByCategory.get(expense.category) || { spent: 0, name: expense.category }
        entry.spent += expense.amount
        spendByCategory.set(expense.category, entry)
      }
    }

    const items: BudgetCategoryItem[] = []

    if (budgetLookup && categoryType === 'relation' && Object.keys(budgetLookup).length > 0) {
      const seenIds = new Set<string>()
      for (const [catId, data] of spendByCategory) {
        const budgetInfo = budgetLookup[catId]
        const budget = budgetInfo?.budget ?? null
        const name = budgetInfo?.name || data.name
        const pct = budget !== null && budget > 0 ? (data.spent / budget) * 100 : null
        const status = pct !== null
          ? (pct > 100 ? 'overBudget' as const : pct >= 80 ? 'warning' as const : 'safe' as const)
          : 'noBudget' as const
        items.push({ name, spent: data.spent, budget, utilizationPercent: pct, status, categoryId: catId })
        seenIds.add(catId)
      }
      for (const [catId, info] of Object.entries(budgetLookup)) {
        if (!seenIds.has(catId)) {
          items.push({
            name: info.name,
            spent: 0,
            budget: info.budget,
            utilizationPercent: info.budget !== null && info.budget > 0 ? 0 : null,
            status: 'safe',
            categoryId: catId,
          })
        }
      }
    } else {
      for (const [catId, data] of spendByCategory) {
        const name = relationLookup?.[catId] || data.name
        items.push({ name, spent: data.spent, budget: null, utilizationPercent: null, status: 'noBudget', categoryId: catId })
      }
    }

    items.sort((a, b) => {
      const statusOrder = { overBudget: 0, warning: 1, safe: 2, noBudget: 3 }
      const orderDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
      if (orderDiff !== 0) return orderDiff
      const pctA = a.utilizationPercent ?? -1
      const pctB = b.utilizationPercent ?? -1
      if (pctA !== pctB) return pctB - pctA
      return a.name.localeCompare(b.name)
    })

    return items
  }, [filteredExpenses, state.expenseBudgetLookup, state.expenseRelationCategoryLookup])

  const budgetSummary = useMemo<BudgetUtilizationSummary>(() => {
    const budgetedItems = budgetItems.filter(i => i.budget !== null && i.budget > 0)
    return {
      overBudgetCount: budgetedItems.filter(i => i.status === 'overBudget').length,
      warningCount: budgetedItems.filter(i => i.status === 'warning').length,
      onTrackCount: budgetedItems.filter(i => i.status === 'safe').length,
      noBudgetCount: budgetItems.filter(i => i.status === 'noBudget').length,
    }
  }, [budgetItems])

  const totalBudget = useMemo(
    () => budgetItems.reduce((sum, item) => sum + (item.budget || 0), 0),
    [budgetItems]
  )
  const remainingBudget = totalBudget - totalSpend
  const budgetProgress = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : null
  const budgetRemaining = totalBudget > 0 ? remainingBudget : null

  // At a Glance facts
  const atGlanceOverBudgetCount = budgetSummary.overBudgetCount
  const glanceFacts = useMemo(() => {
    const facts: { label: string; value: string; color: string }[] = []
    facts.push({ label: 'Total Spent', value: formatCurrency(totalSpend), color: 'text-[#D8755D]' })

    const totalBud = budgetItems.reduce((s, i) => s + (i.budget || 0), 0)
    const remain = totalBud - totalSpend
    if (totalBud > 0) {
      facts.push({
        label: 'Remaining Budget',
        value: remain >= 0 ? formatCurrency(remain) : `${formatCurrency(Math.abs(remain))} over`,
        color: remain >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]',
      })
    }

    if (topExpenseCategories.length > 0) {
      facts.push({ label: 'Top Category', value: topExpenseCategories[0].name, color: 'text-[#F4EDE3]' })
    }

    const highest = filteredExpenses.reduce((max, e) => (e.amount > max ? e.amount : max), 0)
    if (highest > 0) {
      facts.push({ label: 'Highest', value: formatCurrency(highest), color: 'text-[#D49A4A]' })
    }

    const dayCounts = new Map<string, number>()
    let maxDay = 0
    let maxDayLabel = ''
    for (const e of filteredExpenses) {
      const day = parseInt(e.date.split('-')[2])
      const c = (dayCounts.get(e.date) || 0) + 1
      dayCounts.set(e.date, c)
      if (c > maxDay) { maxDay = c; maxDayLabel = String(day) }
    }
    if (maxDay > 0) {
      facts.push({ label: 'Busiest Day', value: `Day ${maxDayLabel}`, color: 'text-[#D49A4A]' })
    }

    if (atGlanceOverBudgetCount > 0) {
      facts.push({
        label: 'Over Budget',
        value: `${atGlanceOverBudgetCount} categ.`,
        color: 'text-[#D8755D]',
      })
    }

    return facts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSpend, filteredExpenses, topExpenseCategories, atGlanceOverBudgetCount])

  const getGreeting = () => {
    const hour = now.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // Hero summary sentence
  const summarySentence = useMemo(() => {
    if (savingsRate !== null && savingsRate > 0) {
      return `You saved ${savingsRate.toFixed(1)}% of your income this month.`
    }
    if (budgetRemaining !== null && budgetRemaining > 0 && totalSpend > 0) {
      return `You are ${formatCurrency(budgetRemaining)} under budget this month.`
    }
    if (netBalance < 0) {
      return `You spent ${formatCurrency(Math.abs(netBalance))} more than you earned this month.`
    }
    if (totalIncome === 0 && totalSpend > 0) {
      return 'No income recorded yet this month.'
    }
    if (totalIncome === 0 && totalSpend === 0) {
      return 'No transactions yet this month.'
    }
    if (savingsRate !== null && savingsRate <= 0) {
      return `Your spending exceeded income by ${formatCurrency(Math.abs(netBalance))} this month.`
    }
    return `${getMonthLabel(activeMonth)} at a glance.`
  }, [savingsRate, budgetRemaining, netBalance, totalIncome, totalSpend, activeMonth])

  if ((loading || !initialLoadAttempted) && expenses.length === 0 && incomes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1F1712]">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1F1712]">
      {/* ===== HERO SECTION ===== */}
      <div className="bg-gradient-to-r from-[#2A201A] to-[#6F4D2A] relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-white/3 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/3 blur-3xl" />
        <div className="absolute top-6 right-1/3 w-40 h-40 rounded-full bg-white/3 blur-2xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 relative z-10">
          {/* Two-column desktop layout */}
          <div className="md:grid md:grid-cols-5 md:gap-8 md:items-start">

            {/* LEFT COLUMN — Greeting, summary, actions */}
            <div className="md:col-span-3 space-y-3">
              <h1 className="text-[#F4EDE3] text-2xl md:text-3xl font-bold tracking-tight">
                {getGreeting()} <span className="text-[#F4EDE3]">👋</span>
              </h1>

              <p className="text-[#B8A99A] text-sm font-medium">
                {summarySentence}
              </p>

              <p className="text-[#B8A99A] text-xs">
                {getMonthLabel(activeMonth)}
                {transactionCount > 0 && ` · ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}`}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={loadData}
                  className="w-9 h-9 rounded-full bg-white/3 backdrop-blur-sm hover:bg-[#F4EDE3]/30 flex items-center justify-center text-[#B8A99A] transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw size={16} />
                </button>
                <Link
                  href="/add?role=expense"
                  className="flex items-center gap-1.5 bg-[#D49A4A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#C1883A] transition-colors shadow-sm"
                >
                  <Plus size={16} />
                  Add Transaction
                </Link>
              </div>
            </div>

            {/* RIGHT COLUMN — Monthly Health Card */}
            <div className="md:col-span-2 mt-5 md:mt-0">
              <div className="bg-[#35281F]/90 backdrop-blur-sm rounded-2xl p-5 border border-[#5A4638] shadow-md">
                <h3 className="text-[#B8A99A] text-[10px] font-semibold uppercase tracking-wider mb-4 text-center">
                  Monthly Health
                </h3>

                {/* Savings Rate Ring */}
                <div className="flex flex-col items-center mb-4">
                  <div className="relative w-24 h-24">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#6B5847" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none"
                        stroke={savingsRate !== null && savingsRate >= 0 ? '#93B889' : '#D8755D'}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={savingsRate !== null
                          ? `${2 * Math.PI * 15.5 * Math.min(Math.abs(savingsRate) / 100, 1)} ${2 * Math.PI * 15.5 * (1 - Math.min(Math.abs(savingsRate) / 100, 1))}`
                          : `0 ${2 * Math.PI * 15.5}`}
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${savingsRate !== null && savingsRate >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
                      {savingsRate !== null ? `${savingsRate.toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                  <p className="text-[#B8A99A] text-[11px] mt-1">Savings Rate</p>
                </div>

                {/* Health details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1.5 px-3 bg-[#403027] rounded-xl">
                    <span className="text-[#B8A99A] text-xs">Saved</span>
                    <span className={`text-sm font-bold ${netBalance >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
                      {netBalance >= 0 ? '+' : '-'}{formatCurrency(netBalance)}
                    </span>
                  </div>

                  {budgetRemaining !== null ? (
                    <>
                      <div className="flex items-center justify-between py-1.5 px-3 bg-[#403027] rounded-xl">
                        <span className="text-[#B8A99A] text-xs">Budget Left</span>
                        <span className={`text-sm font-bold ${budgetRemaining >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
                          {budgetRemaining >= 0 ? formatCurrency(budgetRemaining) : `${formatCurrency(Math.abs(budgetRemaining))} over`}
                        </span>
                      </div>

                      <div className="py-1.5 px-3 bg-[#403027] rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[#B8A99A] text-xs">Budget Used</span>
                          <span className={`text-xs font-semibold ${budgetProgress !== null && budgetProgress > 100 ? 'text-[#D8755D]' : budgetProgress !== null && budgetProgress >= 80 ? 'text-[#D49A4A]' : 'text-[#93B889]'}`}>
                            {budgetProgress !== null ? `${Math.round(budgetProgress)}%` : '—'}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#6B5847] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(budgetProgress ?? 0, 100)}%`,
                              backgroundColor: budgetProgress !== null && budgetProgress > 100 ? '#D8755D'
                                : budgetProgress !== null && budgetProgress >= 80 ? '#D49A4A'
                                : '#93B889',
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 px-3 bg-[#403027] rounded-xl text-center">
                      <p className="text-[#B8A99A] text-xs">No budget set for this month</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT PANEL ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 pb-8 md:pb-12">
        <div className="bg-[#2A201A] border border-[#5A4638] rounded-2xl shadow-lg p-5 md:p-8 space-y-7">

          {/* Section: Overview Cards */}
          <div>
            <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
              Overview
            </h3>

            {/* Row 1: Large balance + income/expense stack */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
              {/* Large Balance Card */}
              <div className="md:col-span-3 bg-[#35281F] rounded-2xl p-5 border border-[#6B5847] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[#B8A99A] text-xs font-medium">Current Balance</p>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${netBalance >= 0 ? 'bg-[#93B889]/10' : 'bg-[#D8755D]/10'}`}>
                    <DollarSign size={20} className={netBalance >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'} />
                  </div>
                </div>
                <p className={`text-3xl font-bold tracking-tight ${netBalance >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
                  {netBalance >= 0 ? '+' : '-'}${Math.abs(netBalance).toFixed(2)}
                </p>
                <p className="text-[#B8A99A] text-xs mt-1">
                  {netBalance >= 0 ? 'You\u2019re in the green this month' : 'Overspending this month'}
                </p>
              </div>

              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#93B889]/8 rounded-2xl p-4 border border-[#6B5847]">
                  <div className="w-9 h-9 rounded-xl bg-[#93B889]/12 flex items-center justify-center mb-2">
                    <TrendingUp size={18} className="text-[#93B889]" />
                  </div>
                  <p className="text-[#B8A99A] text-xs">Monthly Income</p>
                  <p className="text-lg font-bold text-[#93B889] mt-0.5">+${totalIncome.toFixed(2)}</p>
                  <p className="text-[#B8A99A] text-[10px] mt-0.5">
                    {filteredIncomes.length} transaction{filteredIncomes.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => router.push(`/income?monthFrom=${monthRange.monthFrom}&monthTo=${monthRange.monthTo}`)}
                    className="text-[#D49A4A] text-[10px] font-medium hover:underline mt-1"
                  >
                    View details →
                  </button>
                </div>

                <div className="bg-[#D8755D]/8 rounded-2xl p-4 border border-[#6B5847]">
                  <div className="w-9 h-9 rounded-xl bg-[#D8755D]/12 flex items-center justify-center mb-2">
                    <Receipt size={18} className="text-[#D8755D]" />
                  </div>
                  <p className="text-[#B8A99A] text-xs">Monthly Expenses</p>
                  <p className="text-lg font-bold text-[#D8755D] mt-0.5">-${totalSpend.toFixed(2)}</p>
                  <p className="text-[#B8A99A] text-[10px] mt-0.5">
                    {filteredExpenses.length} transaction{filteredExpenses.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => router.push(`/expenses?monthFrom=${monthRange.monthFrom}&monthTo=${monthRange.monthTo}`)}
                    className="text-[#D49A4A] text-[10px] font-medium hover:underline mt-1"
                  >
                    View details →
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Three smaller cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#7DA67A]/8 rounded-2xl p-4 border border-[#6B5847]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#93B889]/12 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93B889" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#B8A99A] text-xs">Savings</p>
                    <p className={`text-lg font-bold ${savingsRate !== null && savingsRate >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
                      {savingsRate !== null ? `${savingsRate.toFixed(1)}%` : 'N/A'}
                    </p>
                    <p className="text-[#B8A99A] text-[10px] mt-0.5">
                      {savingsRate !== null ? (savingsRate >= 0 ? 'of income saved' : 'overspending') : 'No income'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#D49A4A]/8 rounded-2xl p-4 border border-[#6B5847]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D49A4A]/12 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D49A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#B8A99A] text-xs">Budget Remaining</p>
                    <p className={`text-lg font-bold ${budgetRemaining !== null && budgetRemaining >= 0 ? 'text-[#93B889]' : 'text-[#F4EDE3]'}`}>
                      {budgetRemaining !== null ? `$${budgetRemaining.toFixed(0)}` : '—'}
                    </p>
                    <p className="text-[#B8A99A] text-[10px] mt-0.5">
                      {budgetProgress !== null ? `${Math.round(budgetProgress)}% used` : 'No budget set'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#D49A4A]/8 rounded-2xl p-4 border border-[#6B5847]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D49A4A]/12 flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D49A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#B8A99A] text-xs">This Month</p>
                    <p className="text-lg font-bold text-[#F4EDE3]">{transactionCount}</p>
                    <p className="text-[#B8A99A] text-[10px] mt-0.5">
                      {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}, {filteredIncomes.length} income
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: This Month at a Glance + Mini Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AtAGlanceCard items={glanceFacts} />

            {/* Mini Cash Flow Chart */}
            <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider">
                  Cash Flow This Month
                </h3>
                <Link
                  href="/analytics"
                  className="text-[#D49A4A] text-[10px] font-medium hover:underline"
                >
                  View Analytics →
                </Link>
              </div>
              {dailyChartData.some(d => d.income > 0 || d.expense > 0) ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dailyChartData} barGap={2} barCategoryGap="8%">
                    <XAxis
                      dataKey="day"
                      tick={{ fill: '#9B8778', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <Bar dataKey="income" fill="#93B889" radius={[3, 3, 0, 0]} maxBarSize={12} />
                    <Bar dataKey="expense" fill="#D8755D" radius={[3, 3, 0, 0]} maxBarSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[140px]">
                  <p className="text-[#B8A99A] text-xs">No daily data yet this month</p>
                </div>
              )}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#93B889]" />
                  <span className="text-[#B8A99A] text-[10px]">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#D8755D]" />
                  <span className="text-[#B8A99A] text-[10px]">Expenses</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Monthly Budget */}
          <MonthlyBudgetGrid
            items={budgetItems}
            summary={budgetSummary}
            onCategoryClick={(item) => router.push(
              `/expenses?monthFrom=${monthRange.monthFrom}&monthTo=${monthRange.monthTo}&category=${encodeURIComponent(item.name)}`
            )}
            totalBudget={totalBudget}
            totalSpend={totalSpend}
            budgetProgress={budgetProgress}
            budgetRemaining={budgetRemaining}
          />

          {/* Section: Recent Activity + Top Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity Timeline */}
            <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider">
                  Recent Activity
                </h3>
                <button
                  onClick={() => router.push('/expenses')}
                  className="text-[#D49A4A] text-xs font-medium hover:underline"
                >
                  View all
                </button>
              </div>
              {recentTransactions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[#B8A99A] text-xs">No transactions yet this month</p>
                  <Link
                    href="/add?role=expense"
                    className="inline-block mt-2 text-[#D49A4A] text-xs font-medium hover:underline"
                  >
                    Add your first →
                  </Link>
                </div>
              ) : (
                <div className="space-y-0">
                  {recentTransactions.map((txn, idx) => {
                    const isExpense = txn.databaseRole === 'expense'
                    return (
                      <div key={txn.id} className="flex items-start gap-3 py-2.5 relative">
                        {idx < recentTransactions.length - 1 && (
                          <div className="absolute left-[11px] top-8 bottom-0 w-px bg-[#6B5847]" />
                        )}
                        <div
                          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isExpense ? 'bg-[#D8755D]/12' : 'bg-[#93B889]/12'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${isExpense ? 'bg-[#D8755D]' : 'bg-[#93B889]'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-[#F4EDE3] text-sm font-medium truncate">{txn.title}</p>
                            <span
                              className={`text-sm font-bold shrink-0 ml-2 ${
                                isExpense ? 'text-[#D8755D]' : 'text-[#93B889]'
                              }`}
                            >
                              {isExpense ? '-' : '+'}${txn.amount.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-[#B8A99A] text-[11px] mt-0.5">
                            {txn.category || 'Uncategorized'}
                            <span className="mx-1">·</span>
                            {new Date(txn.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top Categories Preview */}
            <div className="bg-[#35281F] rounded-2xl p-4 border border-[#6B5847]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider">
                  Top Categories
                </h3>
                <Link
                  href="/analytics"
                  className="text-[#D49A4A] text-xs font-medium hover:underline"
                >
                  Full analytics →
                </Link>
              </div>
              {topExpenseCategories.length === 0 ? (
                <p className="text-[#B8A99A] text-xs py-8 text-center">No expenses this month</p>
              ) : (
                <div className="space-y-4">
                  {topExpenseCategories.map((cat, index) => {
                    const pct = totalSpend > 0 ? (cat.spent / totalSpend) * 100 : 0
                    const colors = ['#D8755D', '#D49A4A', '#D49A4A']
                    const color = colors[index]
                    return (
                      <div key={cat.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: color }}>
                              {index + 1}
                            </span>
                            <span className="text-[#F4EDE3] text-sm font-medium truncate">{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[#F4EDE3] text-sm font-bold">${cat.spent.toFixed(0)}</span>
                            <span className="text-[#B8A99A] text-[10px]">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-[#6B5847] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section: Quick Actions */}
          <div className="bg-[#403027] rounded-2xl p-5 border border-[#6B5847]">
            <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-4 text-center">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/add?role=expense"
                className="flex items-center gap-2 bg-[#D8755D] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                <Receipt size={16} />
                Add Expense
              </Link>
              <Link
                href="/add?role=income"
                className="flex items-center gap-2 bg-[#93B889] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                <TrendingUp size={16} />
                Add Income
              </Link>
              <Link
                href="/analytics"
                className="flex items-center gap-2 bg-[#D49A4A] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                <BarChart3 size={16} />
                View Analytics
              </Link>
              <Link
                href="/split-tracker"
                className="flex items-center gap-2 bg-[#D49A4A] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#C1883A] transition-opacity shadow-sm"
              >
                <Users size={16} />
                Split Tracker
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
