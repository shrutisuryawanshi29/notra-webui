'use client'

import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isSetupComplete, loadConfig, getExpenseMapping } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import LoadingSpinner from '@/components/LoadingSpinner'
import DashboardSection from '@/components/dashboard/DashboardSection'
import MonthlyBudgetGrid, { BudgetCategoryItem, BudgetUtilizationSummary } from '@/components/dashboard/MonthlyBudgetGrid'

import AnalyticsFilterBar from '@/components/analytics/AnalyticsFilterBar'
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
  getScopeLabel,
  getMonthLabel,
  filterByScope,
  totalIncome,
  totalExpenses,
  netBalance,
  savingsRate,
  totalTransactions,
  expensesByCategory,
  incomeByCategory,
  groupByDay,
  groupByMonth,
  biggestExpense,
  biggestIncome,
  topSpendingCategories,
  monthOverMonthComparison,
  generateInsights,
  formatCurrency,
  getMonthKey,
  AnalyticsScope,
} from '@/lib/analytics'

import { BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts'
import {
  Receipt,
  TrendingUp,
  RefreshCw,
  Users,
  Plus,
  DollarSign,
  Wallet,
  PieChart,
  ChevronRight,
  List,
} from 'lucide-react'

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

function OverviewStatCard({
  href,
  onClick,
  icon,
  label,
  value,
  subtitle,
  valueColor,
}: {
  href?: string
  onClick?: () => void
  icon: ReactNode
  label: string
  value: string
  subtitle?: string
  valueColor?: string
}) {
  const interactive = !!href || !!onClick
  const classes = interactive
    ? 'bg-[#2A1F18] rounded-xl p-3 md:p-4 border border-[#5A4638] shadow-sm flex flex-col gap-1 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D49A4A]/50 hover:shadow-[0_4px_12px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D49A4A] group cursor-pointer'
    : 'bg-[#2A1F18] rounded-xl p-3 md:p-4 border border-[#5A4638] shadow-sm flex flex-col gap-1 text-left'

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <span className="text-[#B8A99A] text-[11px] font-semibold truncate">{label}</span>
        </div>
        {interactive && <ChevronRight size={12} className="text-[#5A4638] group-hover:text-[#D49A4A] transition-colors shrink-0 ml-1" />}
      </div>
      <span className={`text-base md:text-lg font-bold tracking-tight ${valueColor || 'text-[#F4EDE3]'}`}>
        {value}
      </span>
      {subtitle && (
        <span className="text-[#9B8778] text-[11px]">{subtitle}</span>
      )}
    </>
  )

  if (onClick) {
    return <button type="button" onClick={onClick} className={classes}>{content}</button>
  }
  if (href) {
    return <Link href={href} className={classes}>{content}</Link>
  }
  return <div className={classes}>{content}</div>
}

function AtAGlanceCard({ items: facts }: { items: { label: string; value: string; color: string }[] }) {
  return (
    <div className="bg-n-surface rounded-2xl p-4 border border-n-border-soft">
      <h3 className="text-n-text-muted text-xs font-semibold uppercase tracking-wider mb-3">
        This Month at a Glance
      </h3>
      {facts.length === 0 ? (
        <p className="text-n-text-muted text-xs py-4 text-center">No data yet this month</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {facts.map((fact, i) => (
            <div key={i} className="bg-n-surface-2 rounded-xl p-3">
              <p className="text-n-text-muted text-xs">{fact.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${fact.color}`}>{fact.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScopeDropdown({
  scope,
  onScopeChange,
  monthKeys,
}: {
  scope: AnalyticsScope
  onScopeChange: (scope: AnalyticsScope) => void
  monthKeys: string[]
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})

  useEffect(() => {
    if (!open) return
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const gap = 8
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const maxH = Math.min(288, Math.max(spaceBelow, spaceAbove, 120))
    const openUp = spaceBelow < 120 && spaceAbove >= spaceBelow
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
      minWidth: Math.max(rect.width, 176),
      maxHeight: maxH,
    })
  }, [open, monthKeys.length])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const scopeLabel = getScopeLabel(scope)

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-[#2A1F18] text-[#D49A4A] text-sm rounded-lg px-3.5 py-1.5 font-semibold border border-[#5A4638] shadow-sm hover:bg-[#35281F] hover:border-[#D49A4A]/40 transition-colors"
      >
        {scopeLabel}
        <svg width="12" height="12" viewBox="0 0 10 10" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="bg-[#35281F] border border-[#6B5847] rounded-xl shadow-xl z-[9999] overflow-y-auto py-1"
          style={menuStyle}
        >
          <button
            onClick={() => { onScopeChange({ type: 'all' }); setOpen(false) }}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
              scope.type === 'all'
                ? 'bg-[#D49A4A]/10 text-[#D49A4A] font-medium'
                : 'text-[#F4EDE3] hover:bg-[#403027]'
            }`}
          >
            All Data
          </button>
          {monthKeys.map(key => {
            const [y, m] = key.split('-')
            return (
              <button
                key={key}
                onClick={() => { onScopeChange({ type: 'month', year: parseInt(y), month: parseInt(m), monthKey: key }); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  scope.type === 'month' && scope.monthKey === key
                    ? 'bg-[#D49A4A]/10 text-[#D49A4A] font-medium'
                    : 'text-[#F4EDE3] hover:bg-[#403027]'
                }`}
              >
                {getMonthLabel(key)}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { state, loadData } = useCache()
  const { expenses, incomes, loading } = state
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const now = new Date()
  const allTransactions = useMemo(() => [...expenses, ...incomes], [expenses, incomes])
  const monthKeys = useMemo(() => availableMonths(expenses, incomes), [expenses, incomes])

  const [scope, setScope] = useState<AnalyticsScope>({ type: 'all' })

  if (scope.type === 'all' && monthKeys.length > 0) {
    setScope(getDefaultScope(expenses, incomes))
  }

  const filteredTransactions = useMemo(() => filterByScope(allTransactions, scope), [allTransactions, scope])

  const filteredIncomes = useMemo(
    () => filteredTransactions.filter(t => t.databaseRole === 'income'),
    [filteredTransactions]
  )

  const inc = useMemo(() => totalIncome(filteredTransactions), [filteredTransactions])
  const exp = useMemo(() => totalExpenses(filteredTransactions), [filteredTransactions])
  const net = useMemo(() => netBalance(filteredTransactions), [filteredTransactions])
  const sr = useMemo(() => savingsRate(filteredTransactions), [filteredTransactions])
  const txnCount = useMemo(() => totalTransactions(filteredTransactions), [filteredTransactions])
  const incomeCount = filteredIncomes.length
  const expenseCount = filteredTransactions.length - incomeCount

  const scrollToBudget = () => {
    document.getElementById('monthly-budget')?.scrollIntoView({ behavior: 'smooth' })
  }

  const dailyData = useMemo(() => groupByDay(filteredTransactions), [filteredTransactions])
  const monthlyData = useMemo(() => groupByMonth(allTransactions), [allTransactions])
  const expCategories = useMemo(() => expensesByCategory(filteredTransactions), [filteredTransactions])
  const incCategories = useMemo(() => incomeByCategory(filteredTransactions), [filteredTransactions])
  const biggestExp = useMemo(() => biggestExpense(filteredTransactions), [filteredTransactions])
  const biggestInc = useMemo(() => biggestIncome(filteredTransactions), [filteredTransactions])
  const topCategories = useMemo(() => topSpendingCategories(filteredTransactions, 5), [filteredTransactions])
  const momComparison = useMemo(() => monthOverMonthComparison(allTransactions, scope), [allTransactions, scope])
  const insights = useMemo(() => generateInsights(allTransactions, scope, allTransactions), [allTransactions, scope])

  const tableIncome = useMemo(() => totalIncome(filteredTransactions), [filteredTransactions])
  const tableExpenses = useMemo(() => totalExpenses(filteredTransactions), [filteredTransactions])

  // Budget computation (from dashboard)
  const activeMonth = useMemo(() => {
    if (scope.type === 'month') return scope.monthKey
    if (monthKeys.length > 0) return monthKeys[monthKeys.length - 1]
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [scope, monthKeys])

  const monthBudgetExpenses = useMemo(
    () => expenses.filter(e => getMonthKey(e.date) === activeMonth),
    [expenses, activeMonth]
  )

  const monthRange = useMemo(() => getMonthRange(activeMonth), [activeMonth])

  const totalSpend = monthBudgetExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalIncomeBudget = filteredIncomes.reduce((sum, e) => sum + e.amount, 0)

  const budgetItems = useMemo<BudgetCategoryItem[]>(() => {
    const config = loadConfig()
    if (!config) return []
    const expenseMapping = getExpenseMapping(config)
    const categoryType = expenseMapping?.categoryType
    const categoryColumnName = expenseMapping?.columnMapping?.categoryColumn
    const budgetLookup = state.expenseBudgetLookup
    const relationLookup = state.expenseRelationCategoryLookup

    const spendByCategory = new Map<string, { spent: number; name: string }>()

    for (const expense of monthBudgetExpenses) {
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
        items.push({ name, spent: data.spent, budget, utilizationPercent: pct, status, categoryId: catId, icon: budgetInfo?.icon ?? null })
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
            icon: info.icon ?? null,
          })
        }
      }
    } else {
      for (const [catId, data] of spendByCategory) {
        const name = relationLookup?.[catId] || data.name
        items.push({ name, spent: data.spent, budget: null, utilizationPercent: null, status: 'noBudget', categoryId: catId, icon: null })
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
  }, [monthBudgetExpenses, state.expenseBudgetLookup, state.expenseRelationCategoryLookup])

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

    const top3 = [...expCategories].slice(0, 3)
    if (top3.length > 0) {
      facts.push({ label: 'Top Category', value: top3[0].name, color: 'text-[#F4EDE3]' })
    }

    const highest = monthBudgetExpenses.reduce((max, e) => (e.amount > max ? e.amount : max), 0)
    if (highest > 0) {
      facts.push({ label: 'Highest', value: formatCurrency(highest), color: 'text-[#D49A4A]' })
    }

    const dayCounts = new Map<string, number>()
    let maxDay = 0
    let maxDayLabel = ''
    for (const e of monthBudgetExpenses) {
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
  }, [totalSpend, monthBudgetExpenses, budgetItems, expCategories, atGlanceOverBudgetCount])

  const getGreeting = () => {
    const hour = now.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const summarySentence = useMemo(() => {
    if (sr !== null && sr > 0) {
      return `You saved ${sr.toFixed(1)}% of your income this period.`
    }
    if (budgetRemaining !== null && budgetRemaining > 0 && totalSpend > 0) {
      return `You are ${formatCurrency(budgetRemaining)} under budget this month.`
    }
    if (net < 0) {
      return `You spent ${formatCurrency(Math.abs(net))} more than you earned this period.`
    }
    if (totalIncomeBudget === 0 && totalSpend > 0) {
      return 'No income recorded yet this period.'
    }
    if (totalIncomeBudget === 0 && totalSpend === 0) {
      return 'No transactions yet this period.'
    }
    if (sr !== null && sr <= 0) {
      return `Your spending exceeded income by ${formatCurrency(Math.abs(net))} this period.`
    }
    return 'Here\u2019s your financial overview.'
  }, [sr, budgetRemaining, net, totalIncomeBudget, totalSpend])

  // Daily chart data for mini cashflow (for active month)
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const e of monthBudgetExpenses) {
      const existing = map.get(e.date) || { income: 0, expense: 0 }
      existing.expense += e.amount
      map.set(e.date, existing)
    }
    for (const i of filteredIncomes) {
      if (getMonthKey(i.date) !== activeMonth) continue
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
  }, [monthBudgetExpenses, filteredIncomes, activeMonth])

  if (loading && expenses.length === 0 && incomes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-n-bg">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-n-bg">
      {/* ===== HERO ===== */}
      <div className="bg-gradient-to-r from-[#2A201A] to-[#6F4D2A] relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-white/3 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/3 blur-3xl" />
          <div className="absolute top-6 right-1/3 w-40 h-40 rounded-full bg-white/3 blur-2xl" />
        </div>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-6 pb-8 md:pb-10 relative z-10">
          {/* Greeting + Month selector + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 md:mb-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-[#F4EDE3] text-xl md:text-2xl font-bold tracking-tight">
                  {getGreeting()} <span>👋</span>
                </h1>
              </div>
              <p className="text-[#B8A99A] text-sm font-medium">
                {summarySentence}
              </p>
              <div className="flex items-center gap-3">
                <ScopeDropdown
                  scope={scope}
                  onScopeChange={(s) => { setScope(s); setCategoryFilter(null) }}
                  monthKeys={monthKeys}
                />
                <span className="text-[#9B8778] text-xs">{txnCount} transactions</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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

          {/* Overview stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <OverviewStatCard
              label="Current Balance"
              value={formatCurrency(net)}
              subtitle={net >= 0 ? 'Positive' : 'Negative'}
              valueColor={net >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}
              icon={<DollarSign size={14} className={net >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'} />}
            />
            <OverviewStatCard
              href={`/income?monthFrom=${monthRange.monthFrom}&monthTo=${monthRange.monthTo}`}
              label="Monthly Income"
              value={formatCurrency(inc)}
              subtitle={`${incomeCount} transaction${incomeCount !== 1 ? 's' : ''}`}
              valueColor="text-[#93B889]"
              icon={<TrendingUp size={14} className="text-[#93B889]" />}
            />
            <OverviewStatCard
              href={`/expenses?monthFrom=${monthRange.monthFrom}&monthTo=${monthRange.monthTo}`}
              label="Monthly Expenses"
              value={formatCurrency(exp)}
              subtitle={`${expenseCount} transaction${expenseCount !== 1 ? 's' : ''}`}
              valueColor="text-[#D8755D]"
              icon={<Receipt size={14} className="text-[#D8755D]" />}
            />
            <OverviewStatCard
              onClick={budgetRemaining !== null ? scrollToBudget : undefined}
              label={budgetRemaining !== null ? 'Budget Left' : 'Balance'}
              value={budgetRemaining !== null ? formatCurrency(budgetRemaining) : formatCurrency(net)}
              subtitle={getMonthLabel(activeMonth)}
              valueColor={budgetRemaining !== null ? (budgetRemaining >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]') : net >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}
              icon={<Wallet size={14} className={budgetRemaining !== null && budgetRemaining >= 0 ? 'text-[#93B889]' : budgetRemaining !== null ? 'text-[#D8755D]' : 'text-[#D49A4A]'} />}
            />
            <OverviewStatCard
              label="Savings Rate"
              value={sr !== null ? `${sr.toFixed(0)}%` : 'N/A'}
              subtitle="of income saved"
              valueColor={sr !== null && sr >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'}
              icon={<PieChart size={14} className={sr !== null && sr >= 0 ? 'text-[#93B889]' : 'text-[#D8755D]'} />}
            />
            <OverviewStatCard
              href={`/expenses?monthFrom=${monthRange.monthFrom}&monthTo=${monthRange.monthTo}`}
              label="Transactions"
              value={txnCount.toString()}
              subtitle={getMonthLabel(activeMonth)}
              valueColor="text-[#F4EDE3]"
              icon={<List size={14} className="text-[#D49A4A]" />}
            />
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT PANEL ===== */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-4 md:-mt-6 pb-8 md:pb-12 relative z-20">
        <div className="bg-n-panel rounded-t-3xl md:rounded-t-[40px] border-t border-n-border-soft shadow-[0_-4px_28px_rgba(0,0,0,0.4)] pt-6 md:pt-10 pb-8 md:pb-12 px-5 md:px-8 lg:px-10 space-y-6 md:space-y-8">

          {/* Month selector */}
          <AnalyticsFilterBar
            scope={scope}
            onScopeChange={(s) => { setScope(s); setCategoryFilter(null) }}
            availableMonthKeys={monthKeys}
            transactionCount={txnCount}
          />

          {/* Income vs Expense Chart */}
          <IncomeVsExpenseChart
            dailyData={dailyData}
            monthlyData={monthlyData}
            scope={scope}
          />

          {/* At a Glance + Mini Cashflow */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AtAGlanceCard items={glanceFacts} />
            <div className="bg-n-surface rounded-2xl p-4 border border-n-border-soft">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-n-text-muted text-xs font-semibold uppercase tracking-wider">
                  Cash Flow This Month
                </h3>
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
                  <p className="text-n-text-muted text-xs">No daily data yet this month</p>
                </div>
              )}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-n-income" />
                  <span className="text-n-text-muted text-xs">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-n-expense" />
                  <span className="text-n-text-muted text-xs">Expenses</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Budget */}
          <DashboardSection title="Monthly Budget" id="monthly-budget">
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
          </DashboardSection>

          {/* Category Breakdowns */}
          <DashboardSection title="Spending Breakdown" subtitle="Expenses and income by category">
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
          </DashboardSection>

          {/* Spending Trend + Top Categories */}
          <DashboardSection title="Trends">
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
          </DashboardSection>

          {/* Biggest Transactions + MoM */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            <BiggestTransactions
              biggestExpense={biggestExp}
              biggestIncome={biggestInc}
            />
            <MonthOverMonthComparison
              comparison={momComparison}
            />
          </div>

          {/* Insights */}
          <DashboardSection title="Insights">
            <SmartInsights
              insights={insights}
            />
          </DashboardSection>

          {/* Transactions Table */}
          <DashboardSection title="Transactions">
            <FilteredTransactionsTable
              transactions={filteredTransactions}
              activeCategoryFilter={categoryFilter}
              onCategoryFilter={setCategoryFilter}
              totalIncome={tableIncome}
              totalExpenses={tableExpenses}
            />
          </DashboardSection>

          {/* Quick Actions */}
          <DashboardSection title="Quick Actions">
            <div className="bg-n-surface-2 rounded-2xl p-5 border border-n-border-soft">
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  href="/add?role=expense"
                  className="flex items-center gap-2 bg-n-expense text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  <Receipt size={16} />
                  Add Expense
                </Link>
                <Link
                  href="/add?role=income"
                  className="flex items-center gap-2 bg-n-income text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  <TrendingUp size={16} />
                  Add Income
                </Link>
                <Link
                  href="/split-tracker"
                  className="flex items-center gap-2 bg-n-accent text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-n-accent-hover transition-opacity shadow-sm"
                >
                  <Users size={16} />
                  Split Tracker
                </Link>
              </div>
            </div>
          </DashboardSection>

        </div>
      </div>
    </div>
  )
}
