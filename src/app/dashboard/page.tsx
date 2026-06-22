'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete, loadConfig, getExpenseConfig, getExpenseMapping } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import LoadingSpinner from '@/components/LoadingSpinner'
import MonthSelectorPill, { MonthOption } from '@/components/dashboard/MonthSelectorPill'
import FloatingActionButton from '@/components/dashboard/FloatingActionButton'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import OverviewGrid from '@/components/dashboard/OverviewGrid'
import StatusAndChecksGrid from '@/components/dashboard/StatusAndChecksGrid'
import ActivityAndCategoriesGrid from '@/components/dashboard/ActivityAndCategoriesGrid'
import ExploreGrid from '@/components/dashboard/ExploreGrid'
import MonthlyBudgetGrid, { BudgetCategoryItem, BudgetUtilizationSummary } from '@/components/dashboard/MonthlyBudgetGrid'

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
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false)
  const syncedTime = (() => {
    const n = new Date()
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
  })()

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

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Budget] lookup=${state.expenseBudgetLookup ? Object.keys(state.expenseBudgetLookup).length + ' cats' : 'null'} filtered=${filteredExpenses.length} txns`)
  }

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

  if ((loading || !initialLoadAttempted) && expenses.length === 0 && incomes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#2B241E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-8">

        <DashboardHeader
          onSettings={() => router.push('/settings')}
          onRefresh={loadData}
        />

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mt-6 mb-8">
          <div>
            <h2 className="text-[#EDE1D1] text-3xl font-bold">Your Finances</h2>
            <p className="text-[#9B8778] text-xs mt-1">
              Last synced at {syncedTime || '...'}
            </p>
          </div>
          <MonthSelectorPill
            months={availableMonths}
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>

        <div className="space-y-6 md:space-y-8">
          <OverviewGrid
            totalSpend={totalSpend}
            totalIncome={totalIncome}
            netBalance={netBalance}
            expenseCount={filteredExpenses.length}
            incomeCount={filteredIncomes.length}
          />

          <StatusAndChecksGrid
            savingsRate={savingsRate}
            netBalance={netBalance}
            expenseCount={filteredExpenses.length}
            incomeCount={filteredIncomes.length}
            largestExpense={largestExpense ? { title: largestExpense.title, amount: largestExpense.amount } : null}
            mostUsedCategory={mostUsedCategory}
            uncategorizedCount={uncategorizedCount}
          />

          <MonthlyBudgetGrid items={budgetItems} summary={budgetSummary} />

          <ActivityAndCategoriesGrid
            recentTransactions={recentTransactions}
            expenseCategories={expenseCategories}
            totalSpend={totalSpend}
          />

          <ExploreGrid
            onExpenses={() => router.push('/expenses')}
            onIncome={() => router.push('/income')}
            onAnalytics={() => router.push('/analytics')}
            onSplitTracker={() => router.push('/split-tracker')}
          />
        </div>

      </div>

      <div className="fixed bottom-24 md:bottom-8 right-6 z-50">
        <FloatingActionButton onClick={() => router.push('/add?role=expense')} />
      </div>
    </div>
  )
}
