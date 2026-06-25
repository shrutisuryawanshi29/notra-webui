'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Card from '@/components/Card'
import { DailySummary, MonthlySummary, AnalyticsScope, formatShortDate, getMonthLabel, formatCurrency } from '@/lib/analytics'

interface IncomeVsExpenseChartProps {
  dailyData: DailySummary[]
  monthlyData: MonthlySummary[]
  scope: AnalyticsScope
}

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg shadow-lg p-3 text-xs" style={{ backgroundColor: '#35281F', border: '1px solid #6B5847', color: '#F4EDE3' }}>
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

const incomeColor = '#93B889'
const expenseColor = '#D8755D'

export default function IncomeVsExpenseChart({ dailyData, monthlyData, scope }: IncomeVsExpenseChartProps) {
  const isMonth = scope.type === 'month'

  const chartData = isMonth
    ? dailyData.slice(0, 31).map((d) => {
        const day = new Date(d.date + 'T12:00:00Z').getDate()
        return {
          label: String(day),
          tooltipLabel: formatShortDate(d.date),
          Income: d.income,
          Expenses: d.expense,
        }
      })
    : monthlyData.map((m) => ({
        label: m.label.replace(/ \d{4}/, ''),
        tooltipLabel: m.label,
        Income: m.income,
        Expenses: m.expense,
      }))

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-4">Income vs Expenses</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barGap={4} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#5A4638" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#B8A99A', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#B8A99A', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            labelFormatter={(_label: React.ReactNode, payload: ReadonlyArray<any>) => (payload[0]?.payload?.tooltipLabel ?? _label) as string}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => (
              <span style={{ color: '#F4EDE3', fontSize: 12 }}>{value}</span>
            )}
          />
          <Bar dataKey="Income" fill={incomeColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="Expenses" fill={expenseColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}
