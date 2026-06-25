'use client'

import { useState, useRef, useEffect } from 'react'
import { AnalyticsScope, getMonthLabel, getScopeLabel } from '@/lib/analytics'

interface AnalyticsFilterBarProps {
  scope: AnalyticsScope
  onScopeChange: (scope: AnalyticsScope) => void
  availableMonthKeys: string[]
  transactionCount: number
}

export default function AnalyticsFilterBar({
  scope,
  onScopeChange,
  availableMonthKeys,
  transactionCount,
}: AnalyticsFilterBarProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const scopeLabel = getScopeLabel(scope)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[#F4EDE3] text-lg font-bold">Analytics</h2>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 bg-[#403027] text-[#D49A4A] text-xs rounded-full px-4 py-1.5 font-medium hover:bg-[#6B5847] transition-colors"
          >
            {scopeLabel}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 mt-1 w-44 bg-[#35281F] border border-[#6B5847] rounded-xl shadow-xl z-50 overflow-hidden">
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
              {availableMonthKeys.map(key => {
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
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[#B8A99A] text-xs">Showing: {scopeLabel}</span>
        <span className="text-[#B8A99A] text-xs">·</span>
        <span className="text-[#B8A99A] text-xs">{transactionCount} transactions</span>
      </div>
    </div>
  )
}

AnalyticsFilterBar.displayName = 'AnalyticsFilterBar'
