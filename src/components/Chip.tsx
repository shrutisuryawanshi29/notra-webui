'use client'

import { ReactNode } from 'react'

interface ChipProps {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  variant?: 'default' | 'pending' | 'settled'
  className?: string
}

export default function Chip({
  children,
  selected = false,
  onClick,
  variant = 'default',
  className = '',
}: ChipProps) {
  const base = 'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer'

  const colors = {
    default: selected
      ? 'bg-[#D49A4A] text-white'
      : 'bg-[#403027] text-[#B8A99A] hover:text-[#F4EDE3]',
    pending: 'bg-[#D49A4A] text-[#F4EDE3]',
    settled: 'bg-[#93B889] text-white',
  }

  return (
    <span
      onClick={onClick}
      className={`${base} ${colors[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
