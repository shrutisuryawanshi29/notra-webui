'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface StyledSelectOption {
  value: string
  label: string
}

interface StyledSelectProps {
  value: string
  onChange: (value: string) => void
  options: StyledSelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  triggerClassName?: string
}

const sizeStyles = {
  sm: 'px-1.5 py-1 text-[10px]',
  md: 'px-3 py-2.5 text-sm',
}

export default function StyledSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  size = 'md',
  triggerClassName = '',
}: StyledSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => o.value === value)
  const display = selected?.label || placeholder

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 bg-[#403027] text-[#F4EDE3] rounded-lg border border-[#6B5847] hover:border-[#D49A4A] focus:outline-none focus:border-[#D49A4A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizeStyles[size]} ${triggerClassName}`}
      >
        <span className={selected ? 'text-[#F4EDE3]' : 'text-[#9B8778]'}>{display}</span>
        <ChevronDown size={14} className={`text-[#9B8778] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[#2A1F18] border border-[#5A4638] rounded-xl shadow-xl overflow-hidden">
          {placeholder && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`w-full text-left transition-colors ${
                size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-sm'
              } ${
                value === ''
                  ? 'bg-[#D49A4A]/10 text-[#D49A4A]'
                  : 'text-[#9B8778] hover:bg-[#403027]'
              }`}
            >
              {placeholder}
            </button>
          )}
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left transition-colors ${
                size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-sm'
              } ${
                value === opt.value
                  ? 'bg-[#D49A4A]/10 text-[#D49A4A] font-medium'
                  : 'text-[#F4EDE3] hover:bg-[#403027]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
