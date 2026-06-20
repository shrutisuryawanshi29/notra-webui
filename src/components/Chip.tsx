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
  const base = 'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer'

  const colors = {
    default: selected
      ? 'bg-[#C99152] text-white'
      : 'bg-[#40342B] text-[#9B8778] hover:text-[#CBB9A7]',
    pending: 'bg-[#C49A5A] text-white',
    settled: 'bg-[#8CA37D] text-[#F4E9DA]',
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
