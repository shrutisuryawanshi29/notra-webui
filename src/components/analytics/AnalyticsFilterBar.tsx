'use client'

import { AnalyticsScope, getScopeLabel } from '@/lib/analytics'

interface AnalyticsFilterBarProps {
  scope: AnalyticsScope
  onScopeChange?: (scope: AnalyticsScope) => void
  availableMonthKeys?: string[]
  transactionCount: number
}

export default function AnalyticsFilterBar({
  scope,
  transactionCount,
}: AnalyticsFilterBarProps) {
  const scopeLabel = getScopeLabel(scope)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[#F4EDE3] text-lg font-bold">Overview</h2>
        <span className="text-[#9B8778] text-xs">{transactionCount} transactions</span>
      </div>
    </div>
  )
}

AnalyticsFilterBar.displayName = 'AnalyticsFilterBar'
