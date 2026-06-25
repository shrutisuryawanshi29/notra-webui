import { NormalizedTransaction } from '@/types/transaction'

export type AnalyticsScope = { type: 'all' } | { type: 'month'; year: number; month: number; monthKey: string }

export interface CategorySummary {
  name: string
  spent: number
  count: number
  percentage: number
}

export interface DailySummary {
  date: string
  income: number
  expense: number
  net: number
}

export interface MonthlySummary {
  monthKey: string
  label: string
  income: number
  expense: number
  net: number
}

export interface BiggestTransaction {
  title: string
  category: string | null
  amount: number
  date: string
}

export interface MoMComparison {
  previousMonthKey: string
  previousLabel: string
  expenseChange: number | null
  incomeChange: number | null
  savingsChange: number | null
  hasPreviousData: boolean
}

export const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return `${MONTH_LABELS[parseInt(m) - 1]} ${y}`
}

export function getScopeLabel(scope: AnalyticsScope): string {
  if (scope.type === 'all') return 'All Data'
  return getMonthLabel(scope.monthKey)
}

export function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`
}

export function formatCurrencySigned(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}${formatCurrency(amount)}`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function availableMonths(expenses: NormalizedTransaction[], incomes: NormalizedTransaction[]): string[] {
  const set = new Set<string>()
  for (const e of expenses) set.add(getMonthKey(e.date))
  for (const i of incomes) set.add(getMonthKey(i.date))
  return Array.from(set).sort()
}

export function getDefaultScope(expenses: NormalizedTransaction[], incomes: NormalizedTransaction[]): AnalyticsScope {
  const months = availableMonths(expenses, incomes)
  if (months.length === 0) return { type: 'all' }
  const latest = months[months.length - 1]
  const [y, m] = latest.split('-')
  return { type: 'month', year: parseInt(y), month: parseInt(m), monthKey: latest }
}

export function filterByScope(transactions: NormalizedTransaction[], scope: AnalyticsScope): NormalizedTransaction[] {
  if (scope.type === 'all') return transactions
  return transactions.filter(t => getMonthKey(t.date) === scope.monthKey)
}

export function totalIncome(transactions: NormalizedTransaction[]): number {
  return transactions.filter(t => t.databaseRole === 'income').reduce((s, t) => s + t.amount, 0)
}

export function totalExpenses(transactions: NormalizedTransaction[]): number {
  return transactions.filter(t => t.databaseRole === 'expense').reduce((s, t) => s + t.amount, 0)
}

export function netBalance(transactions: NormalizedTransaction[]): number {
  return totalIncome(transactions) - totalExpenses(transactions)
}

export function savingsRate(transactions: NormalizedTransaction[]): number | null {
  const inc = totalIncome(transactions)
  if (inc === 0) return null
  return (netBalance(transactions) / inc) * 100
}

export function totalTransactions(transactions: NormalizedTransaction[]): number {
  return transactions.length
}

export function daysInPeriod(scope: AnalyticsScope, allTxns: NormalizedTransaction[]): number {
  const now = new Date()
  if (scope.type === 'month') {
    const daysInMonth = new Date(scope.year, scope.month, 0).getDate()
    const isCurrentMonth = scope.year === now.getFullYear() && scope.month === now.getMonth() + 1
    return isCurrentMonth ? now.getDate() : daysInMonth
  }
  if (allTxns.length === 0) return 1
  const dates = allTxns.map(t => new Date(t.date + 'T12:00:00Z').getTime()).filter(d => !isNaN(d))
  if (dates.length === 0) return 1
  const firstDate = new Date(Math.min(...dates))
  const diffMs = now.getTime() - firstDate.getTime()
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 1)
}

export function averageDailySpend(transactions: NormalizedTransaction[], scope: AnalyticsScope, allTxns: NormalizedTransaction[]): number {
  const days = daysInPeriod(scope, allTxns)
  return totalExpenses(transactions) / days
}

export function expensesByCategory(transactions: NormalizedTransaction[]): CategorySummary[] {
  const totalExp = totalExpenses(transactions)
  const map = new Map<string, { spent: number; count: number }>()
  for (const t of transactions) {
    if (t.databaseRole !== 'expense') continue
    const cat = t.category || 'Uncategorized'
    const existing = map.get(cat) || { spent: 0, count: 0 }
    existing.spent += t.amount
    existing.count += 1
    map.set(cat, existing)
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data, percentage: totalExp > 0 ? (data.spent / totalExp) * 100 : 0 }))
    .sort((a, b) => b.spent - a.spent)
}

export function incomeByCategory(transactions: NormalizedTransaction[]): CategorySummary[] {
  const totalInc = totalIncome(transactions)
  const map = new Map<string, { spent: number; count: number }>()
  for (const t of transactions) {
    if (t.databaseRole !== 'income') continue
    const cat = t.category || 'Uncategorized'
    const existing = map.get(cat) || { spent: 0, count: 0 }
    existing.spent += t.amount
    existing.count += 1
    map.set(cat, existing)
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data, percentage: totalInc > 0 ? (data.spent / totalInc) * 100 : 0 }))
    .sort((a, b) => b.spent - a.spent)
}

export function groupByDay(transactions: NormalizedTransaction[]): DailySummary[] {
  const map = new Map<string, { income: number; expense: number }>()
  for (const t of transactions) {
    const key = t.date
    const existing = map.get(key) || { income: 0, expense: 0 }
    if (t.databaseRole === 'income') existing.income += t.amount
    else existing.expense += t.amount
    map.set(key, existing)
  }
  return Array.from(map.entries())
    .map(([date, data]) => ({ date, ...data, net: data.income - data.expense }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function groupByMonth(transactions: NormalizedTransaction[]): MonthlySummary[] {
  const map = new Map<string, { income: number; expense: number }>()
  for (const t of transactions) {
    const key = getMonthKey(t.date)
    const existing = map.get(key) || { income: 0, expense: 0 }
    if (t.databaseRole === 'income') existing.income += t.amount
    else existing.expense += t.amount
    map.set(key, existing)
  }
  return Array.from(map.entries())
    .map(([monthKey, data]) => ({ monthKey, label: getMonthLabel(monthKey), ...data, net: data.income - data.expense }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
}

export function biggestExpense(transactions: NormalizedTransaction[]): BiggestTransaction | null {
  const expenses = transactions.filter(t => t.databaseRole === 'expense')
  if (expenses.length === 0) return null
  const biggest = expenses.reduce((max, t) => t.amount > max.amount ? t : max, expenses[0])
  return { title: biggest.title, category: biggest.category, amount: biggest.amount, date: biggest.date }
}

export function biggestIncome(transactions: NormalizedTransaction[]): BiggestTransaction | null {
  const incomes = transactions.filter(t => t.databaseRole === 'income')
  if (incomes.length === 0) return null
  const biggest = incomes.reduce((max, t) => t.amount > max.amount ? t : max, incomes[0])
  return { title: biggest.title, category: biggest.category, amount: biggest.amount, date: biggest.date }
}

export function topSpendingCategories(transactions: NormalizedTransaction[], n: number = 5): CategorySummary[] {
  return expensesByCategory(transactions).slice(0, n)
}

export function monthOverMonthComparison(transactions: NormalizedTransaction[], scope: AnalyticsScope): MoMComparison | null {
  if (scope.type !== 'month') return null
  const [yStr, mStr] = scope.monthKey.split('-')
  let year = parseInt(yStr)
  let month = parseInt(mStr) - 1
  if (month === 0) { month = 12; year -= 1 }
  const prevKey = `${year}-${String(month).padStart(2, '0')}`

  const currentTxns = filterByScope(transactions, scope)
  const prevTxns = transactions.filter(t => getMonthKey(t.date) === prevKey)

  if (prevTxns.length === 0) {
    return {
      previousMonthKey: prevKey,
      previousLabel: getMonthLabel(prevKey),
      expenseChange: null,
      incomeChange: null,
      savingsChange: null,
      hasPreviousData: false,
    }
  }

  const curExp = totalExpenses(currentTxns)
  const prevExp = totalExpenses(prevTxns)
  const curInc = totalIncome(currentTxns)
  const prevInc = totalIncome(prevTxns)
  const curSav = netBalance(currentTxns)
  const prevSav = netBalance(prevTxns)

  const expenseChange = prevExp !== 0 ? ((curExp - prevExp) / prevExp) * 100 : null
  const incomeChange = prevInc !== 0 ? ((curInc - prevInc) / prevInc) * 100 : null
  const savingsChange = prevSav !== 0 ? ((curSav - prevSav) / Math.abs(prevSav)) * 100 : null

  return { previousMonthKey: prevKey, previousLabel: getMonthLabel(prevKey), expenseChange, incomeChange, savingsChange, hasPreviousData: true }
}

export interface Insight {
  type: 'positive' | 'negative' | 'neutral'
  text: string
}

export function generateInsights(transactions: NormalizedTransaction[], scope: AnalyticsScope, allTxns: NormalizedTransaction[]): Insight[] {
  const insights: Insight[] = []
  const filtered = filterByScope(transactions, scope)
  const exp = totalExpenses(filtered)
  const inc = totalIncome(filtered)
  const net = netBalance(filtered)
  const sr = savingsRate(filtered)
  const avgDaily = averageDailySpend(filtered, scope, allTxns)
  const expCat = expensesByCategory(filtered)
  const incCat = incomeByCategory(filtered)
  const mom = scope.type === 'month' ? monthOverMonthComparison(transactions, scope) : null

  if (expCat.length > 0) {
    insights.push({ type: 'neutral', text: `You spent the most on ${expCat[0].name} this period (${formatCurrency(expCat[0].spent)}).` })
  }

  if (mom?.hasPreviousData && mom.expenseChange !== null) {
    const direction = mom.expenseChange > 0 ? 'higher' : mom.expenseChange < 0 ? 'lower' : 'about the same as'
    insights.push({
      type: mom.expenseChange > 0 ? 'negative' : mom.expenseChange < 0 ? 'positive' : 'neutral',
      text: `Your expenses are ${direction} last month (${formatPercent(Math.abs(mom.expenseChange))} ${mom.expenseChange > 0 ? 'increase' : 'decrease'}).`,
    })
  }

  if (sr !== null) {
    insights.push({
      type: sr >= 20 ? 'positive' : sr >= 0 ? 'neutral' : 'negative',
      text: sr >= 0
        ? `You saved ${formatPercent(sr)} of your income this period.`
        : `Your spending exceeded income by ${formatPercent(Math.abs(sr))} this period.`,
    })
  }

  if (avgDaily > 0) {
    insights.push({ type: 'neutral', text: `Your average daily spending is ${formatCurrency(avgDaily)}.` })
  }

  if (mom?.hasPreviousData && expCat.length > 1) {
    const prevTxns = transactions.filter(t => getMonthKey(t.date) === mom.previousMonthKey)
    const prevCats = expensesByCategory(prevTxns)
    for (const cat of expCat.slice(0, 3)) {
      const prev = prevCats.find(c => c.name === cat.name)
      if (prev && prev.spent > 0) {
        const change = ((cat.spent - prev.spent) / prev.spent) * 100
        if (Math.abs(change) >= 10) {
          insights.push({
            type: change > 0 ? 'negative' : 'positive',
            text: `${cat.name} expenses ${change > 0 ? 'increased' : 'decreased'} by ${formatPercent(Math.abs(change))} compared to last month.`,
          })
        }
      }
    }
  }

  if (net < 0) {
    insights.push({ type: 'negative', text: 'Your net balance is negative for this period.' })
  }

  if (inc === 0 && exp > 0) {
    insights.push({ type: 'negative', text: 'No income recorded yet this period.' })
  }

  if (exp === 0 && inc > 0) {
    insights.push({ type: 'positive', text: 'No expenses recorded yet this period.' })
  }

  return insights
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
