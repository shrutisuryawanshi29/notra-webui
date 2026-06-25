'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import LoadingSpinner from '@/components/LoadingSpinner'
import IconButton from '@/components/dashboard/IconButton'
import { ArrowLeft, RefreshCw } from 'lucide-react'

import AnalyticsFilterBar from '@/components/analytics/AnalyticsFilterBar'
import SummaryCards from '@/components/analytics/SummaryCards'
import IncomeVsExpenseChart from '@/components/analytics/IncomeVsExpenseChart'
import ExpenseCategoryBreakdown from '@/components/analytics/ExpenseCategoryBreakdown'
import IncomeCategoryBreakdown from '@/components/analytics/IncomeCategoryBreakdown'
import SpendingTrend from '@/components/analytics/SpendingTrend'
import TopSpendingCategories from '@/components/analytics/TopSpendingCategories'
import BiggestTransactions from '@/components/analytics/BiggestTransactions'
import MonthOverMonthComparison from '@/components/analytics/MonthOverMonthComparison'
import SmartInsights from '@/components/analytics/SmartInsights'
import FilteredTransactionsTable from '@/components/analytics/FilteredTransactionsTable'

import {
  availableMonths,
  getDefaultScope,
  filterByScope,
  totalIncome,
  totalExpenses,
  netBalance,
  savingsRate,
  totalTransactions,
  averageDailySpend,
  expensesByCategory,
  incomeByCategory,
  groupByDay,
  groupByMonth,
  biggestExpense,
  biggestIncome,
  topSpendingCategories,
  monthOverMonthComparison,
  generateInsights,
  AnalyticsScope,
} from '@/lib/analytics'

export default function AnalyticsPage() {
  const router = useRouter()
  const { state } = useCache()
  const { expenses, incomes, loading } = state

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const allTransactions = useMemo(() => [...expenses, ...incomes], [expenses, incomes])

  const monthKeys = useMemo(() => availableMonths(expenses, incomes), [expenses, incomes])

  const [scope, setScope] = useState<AnalyticsScope>({ type: 'all' })
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  useEffect(() => {
    if (scope.type === 'all' && monthKeys.length > 0) {
      setScope(getDefaultScope(expenses, incomes))
    }
  }, [monthKeys.length, expenses, incomes])

  const initialLoadDone = useMemo(
    () => scope.type !== 'all' || monthKeys.length === 0,
    [scope, monthKeys]
  )

  const filteredTransactions = useMemo(() => filterByScope(allTransactions, scope), [allTransactions, scope])

  const filteredWithCategory = useMemo(() => {
    if (!categoryFilter) return filteredTransactions
    return filteredTransactions.filter(t => t.category === categoryFilter)
  }, [filteredTransactions, categoryFilter])

  const inc = useMemo(() => totalIncome(filteredTransactions), [filteredTransactions])
  const exp = useMemo(() => totalExpenses(filteredTransactions), [filteredTransactions])
  const net = useMemo(() => netBalance(filteredTransactions), [filteredTransactions])
  const sr = useMemo(() => savingsRate(filteredTransactions), [filteredTransactions])
  const txnCount = useMemo(() => totalTransactions(filteredTransactions), [filteredTransactions])
  const avgDaily = useMemo(() => averageDailySpend(filteredTransactions, scope, allTransactions), [filteredTransactions, scope, allTransactions])

  const expCategories = useMemo(() => expensesByCategory(filteredTransactions), [filteredTransactions])
  const incCategories = useMemo(() => incomeByCategory(filteredTransactions), [filteredTransactions])
  const dailyData = useMemo(() => groupByDay(filteredTransactions), [filteredTransactions])
  const monthlyData = useMemo(() => groupByMonth(allTransactions), [allTransactions])
  const biggestExp = useMemo(() => biggestExpense(filteredTransactions), [filteredTransactions])
  const biggestInc = useMemo(() => biggestIncome(filteredTransactions), [filteredTransactions])
  const topCategories = useMemo(() => topSpendingCategories(filteredTransactions, 5), [filteredTransactions])
  const momComparison = useMemo(() => monthOverMonthComparison(allTransactions, scope), [allTransactions, scope])
  const insights = useMemo(() => generateInsights(allTransactions, scope, allTransactions), [allTransactions, scope])

  const tableIncome = useMemo(() => totalIncome(filteredWithCategory), [filteredWithCategory])
  const tableExpenses = useMemo(() => totalExpenses(filteredWithCategory), [filteredWithCategory])

  if (loading && allTransactions.length === 0) {
    return (
      <div className="min-h-screen bg-[#1F1712] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1F1712]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-28 md:pb-8 space-y-6 md:space-y-8">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-9 h-9 rounded-full bg-[#403027] flex items-center justify-center text-[#B8A99A] hover:text-[#F4EDE3] hover:bg-[#6B5847] transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          </div>
          <IconButton onClick={() => window.location.reload()}>
            <RefreshCw size={18} />
          </IconButton>
        </div>

        <AnalyticsFilterBar
          scope={scope}
          onScopeChange={(s) => { setScope(s); setCategoryFilter(null) }}
          availableMonthKeys={monthKeys}
          transactionCount={txnCount}
        />

        <SummaryCards
          totalIncome={inc}
          totalExpenses={exp}
          netBalance={net}
          savingsRate={sr}
          totalTransactions={txnCount}
          averageDailySpend={avgDaily}
          scope={scope}
        />

        <IncomeVsExpenseChart
          dailyData={dailyData}
          monthlyData={monthlyData}
          scope={scope}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <ExpenseCategoryBreakdown
            categories={expCategories}
            onCategoryClick={(name) => setCategoryFilter(name === categoryFilter ? null : name)}
          />
          <IncomeCategoryBreakdown
            categories={incCategories}
            totalIncome={inc}
            onCategoryClick={(name) => setCategoryFilter(name === categoryFilter ? null : name)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <SpendingTrend
            dailyData={dailyData}
            monthlyData={monthlyData}
            scope={scope}
            allExpenses={exp}
          />
          <TopSpendingCategories
            categories={topCategories}
            totalExpenses={exp}
          />
        </div>

        <BiggestTransactions
          biggestExpense={biggestExp}
          biggestIncome={biggestInc}
        />

        <MonthOverMonthComparison
          comparison={momComparison}
        />

        <SmartInsights
          insights={insights}
        />

        <FilteredTransactionsTable
          transactions={filteredWithCategory}
          activeCategoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
          totalIncome={tableIncome}
          totalExpenses={tableExpenses}
        />

      </div>
    </div>
  )
}
