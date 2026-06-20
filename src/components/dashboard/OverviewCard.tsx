'use client'

import { ReactNode } from 'react'

interface OverviewCardProps {
  icon: ReactNode
  label: string
  amount: string
  subtitle: string
  color: string
  bgClass?: string
  onClick?: () => void
}

export default function OverviewCard({
  icon,
  label,
  amount,
  subtitle,
  color,
  bgClass,
  onClick,
}: OverviewCardProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 bg-[#362D25] rounded-2xl p-4 border border-[#4C4036] ${
        onClick ? 'cursor-pointer hover:border-[#C99152] transition-colors' : ''
      }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${bgClass || 'bg-[#40342B]'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#9B8778] text-xs">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${color}`}>{amount}</p>
        <p className="text-[#9B8778] text-xs mt-0.5">{subtitle}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#4C4036] flex-shrink-0">
        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
