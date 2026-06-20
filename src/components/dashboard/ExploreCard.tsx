'use client'

import { ReactNode } from 'react'

interface ExploreCardProps {
  icon: ReactNode
  title: string
  subtitle: string
  iconBgClass?: string
  onClick?: () => void
}

export default function ExploreCard({ icon, title, subtitle, iconBgClass, onClick }: ExploreCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-[#362D25] rounded-2xl p-5 border border-[#4C4036] cursor-pointer hover:border-[#C99152] hover:bg-[#40342B] transition-all"
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-3 ${iconBgClass || 'bg-[#40342B]'}`}>
        {icon}
      </div>
      <p className="text-[#F4E9DA] text-sm font-semibold">{title}</p>
      <p className="text-[#9B8778] text-xs mt-1">{subtitle}</p>
    </div>
  )
}
