'use client'

import { useState, useRef, useEffect } from 'react'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface MonthOption {
  label: string
  value: string // "YYYY-MM"
}

interface MonthSelectorPillProps {
  months: MonthOption[]
  selectedMonth: string
  onChange: (value: string) => void
}

export default function MonthSelectorPill({ months, selectedMonth, onChange }: MonthSelectorPillProps) {
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

  const selected = months.find(m => m.value === selectedMonth)
  const displayLabel = selected?.label || MONTH_LABELS[new Date().getMonth()] + ' ' + new Date().getFullYear()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#40342B] text-[#C99152] text-xs font-medium hover:bg-[#4C4036] transition-colors"
      >
        {displayLabel}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-44 bg-[#362D25] border border-[#4C4036] rounded-xl shadow-xl z-50 overflow-hidden">
          {months.map(m => (
            <button
              key={m.value}
              onClick={() => { onChange(m.value); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                m.value === selectedMonth
                  ? 'bg-[#C99152]/10 text-[#C99152] font-medium'
                  : 'text-[#F4E9DA] hover:bg-[#40342B]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
