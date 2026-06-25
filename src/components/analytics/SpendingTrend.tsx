'use client'

import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from 'recharts'
import Card from '@/components/Card'
import { DailySummary, MonthlySummary, AnalyticsScope, formatShortDate, getMonthLabel, formatCurrency } from '@/lib/analytics'

interface SpendingTrendProps {
  dailyData: DailySummary[]
  monthlyData: MonthlySummary[]
  scope: AnalyticsScope
  allExpenses: number
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
      <p style={{ color: '#D8755D' }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

interface DataPoint {
  label: string
  tooltipLabel: string
  expense: number
}

function CustomizedDot({ cx, cy, stroke, payload, maxExpense }: { cx?: number; cy?: number; stroke?: string; payload?: DataPoint; maxExpense: number }) {
  if (cx == null || cy == null || !payload || payload.expense !== maxExpense) return null
  return (
    <Dot cx={cx} cy={cy} r={4} fill="#D8755D" stroke="#F4EDE3" strokeWidth={2} />
  )
}

export default function SpendingTrend({ dailyData, monthlyData, scope, allExpenses }: SpendingTrendProps) {
  const isMonth = scope.type === 'month'

  const chartData: DataPoint[] = isMonth
    ? dailyData.slice(0, 31).map((d) => {
        const day = new Date(d.date + 'T12:00:00Z').getDate()
        return { label: String(day), tooltipLabel: formatShortDate(d.date), expense: d.expense }
      })
    : monthlyData.map((m) => ({
        label: m.label.replace(/ \d{4}/, ''),
        tooltipLabel: m.label,
        expense: m.expense,
      }))

  const maxPoint = chartData.reduce((max, p) => (p.expense > max.expense ? p : max), chartData[0] || { label: '', tooltipLabel: '', expense: 0 })
  const maxExpense = maxPoint.expense

  const insightText = isMonth
    ? `Highest spending day: ${maxPoint.tooltipLabel} (${formatCurrency(maxExpense)})`
    : `Highest spending month: ${maxPoint.tooltipLabel} (${formatCurrency(maxExpense)})`

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold tracking-wider mb-4">Spending Trend</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D8755D" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#D8755D" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            cursor={{ fill: 'transparent' }}
            labelFormatter={(_label: React.ReactNode, payload: ReadonlyArray<any>) => (payload[0]?.payload?.tooltipLabel ?? _label) as string}
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="#D8755D"
            strokeWidth={2}
            fill="url(#spendingGradient)"
            dot={<CustomizedDot maxExpense={maxExpense} />}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1">
        <p className="text-[#B8A99A] text-xs">{insightText}</p>
        <p className="text-[#B8A99A] text-xs">Total expenses: {formatCurrency(allExpenses)}</p>
      </div>
    </Card>
  )
}
